import { randomUUID } from "crypto";
import { Action, can, canAssignRole, roleOf } from "./rbac";
import { conflict, forbidden, HttpError, notFound } from "./errors";
import { EventBus } from "./realtime/bus";
import { Store, StoredBoard } from "./store/types";
import { Board, BoardEvent, Card, List, Role } from "./types";

const now = () => new Date().toISOString();
const MAX_RETRIES = 3;

export class BoardService {
  constructor(private store: Store, private bus: EventBus) {}

  async createBoard(userId: string, name: string): Promise<Board> {
    const board: StoredBoard = {
      id: randomUUID(),
      name,
      members: [{ userId, role: "owner" }],
      lists: [],
      createdAt: now(),
      rev: 0,
    };
    await this.store.createBoard(board);
    return publicBoard(board);
  }

  async listBoards(userId: string): Promise<Board[]> {
    return (await this.store.listBoardsForUser(userId)).map(publicBoard);
  }

  async getBoard(userId: string, boardId: string): Promise<Board> {
    const board = await this.load(boardId);
    this.authorize(board, userId, "board:read");
    return publicBoard(board);
  }

  async deleteBoard(userId: string, boardId: string) {
    const board = await this.load(boardId);
    this.authorize(board, userId, "board:delete");
    await this.store.deleteBoard(boardId);
  }

  async addMember(userId: string, boardId: string, email: string, role: Role) {
    const target = await this.store.findUserByEmail(email);
    if (!target) throw notFound("User");
    return this.mutate(boardId, userId, "member:manage", (board) => {
      if (!canAssignRole(roleOf(board, userId), role)) throw forbidden();
      if (board.members.some((m) => m.userId === target.id)) throw conflict("Already a member");
      const member = { userId: target.id, role };
      board.members.push(member);
      return { type: "member.added", boardId, member };
    });
  }

  async createList(userId: string, boardId: string, title: string) {
    return this.mutate(boardId, userId, "list:write", (board) => {
      const list: List = { id: randomUUID(), title, position: board.lists.length, cards: [] };
      board.lists.push(list);
      return { type: "list.created", boardId, list };
    });
  }

  async deleteList(userId: string, boardId: string, listId: string) {
    return this.mutate(boardId, userId, "list:write", (board) => {
      const idx = board.lists.findIndex((l) => l.id === listId);
      if (idx === -1) throw notFound("List");
      board.lists.splice(idx, 1);
      reindex(board.lists);
      return { type: "list.deleted", boardId, listId };
    });
  }

  async createCard(userId: string, boardId: string, listId: string, title: string, description = "") {
    return this.mutate(boardId, userId, "card:write", (board) => {
      const list = findList(board, listId);
      const card: Card = {
        id: randomUUID(),
        title,
        description,
        position: list.cards.length,
        version: 1,
        updatedAt: now(),
      };
      list.cards.push(card);
      return { type: "card.created", boardId, listId, card };
    });
  }

  // The client sends the card version it last saw. If someone else edited the card
  // in the meantime, we reject with 409 so the client can show the newer version.
  async updateCard(
    userId: string,
    boardId: string,
    cardId: string,
    changes: { title?: string; description?: string },
    expectedVersion: number
  ) {
    return this.mutate(boardId, userId, "card:write", (board) => {
      const { list, card } = findCard(board, cardId);
      if (card.version !== expectedVersion) {
        throw conflict("This card was changed by someone else. Refresh to see the latest version.");
      }
      if (changes.title !== undefined) card.title = changes.title;
      if (changes.description !== undefined) card.description = changes.description;
      card.version += 1;
      card.updatedAt = now();
      return { type: "card.updated", boardId, listId: list.id, card };
    });
  }

  async moveCard(userId: string, boardId: string, cardId: string, toListId: string, toPosition: number) {
    return this.mutate(boardId, userId, "card:write", (board) => {
      const { list: from, card } = findCard(board, cardId);
      const to = findList(board, toListId);
      from.cards = from.cards.filter((c) => c.id !== cardId);
      const pos = Math.max(0, Math.min(toPosition, to.cards.length));
      to.cards.splice(pos, 0, card);
      reindex(from.cards);
      reindex(to.cards);
      card.version += 1;
      card.updatedAt = now();
      return { type: "card.moved", boardId, fromListId: from.id, toListId: to.id, card };
    });
  }

  async deleteCard(userId: string, boardId: string, cardId: string) {
    return this.mutate(boardId, userId, "card:write", (board) => {
      const { list } = findCard(board, cardId);
      list.cards = list.cards.filter((c) => c.id !== cardId);
      reindex(list.cards);
      return { type: "card.deleted", boardId, listId: list.id, cardId };
    });
  }

  async canRead(userId: string, boardId: string): Promise<boolean> {
    const board = await this.store.getBoard(boardId);
    return !!board && can(roleOf(board, userId), "board:read");
  }

  // Load, check permission, apply the change, save with optimistic locking, then broadcast.
  // If two servers write the same board at once, the loser reloads and tries again.
  private async mutate(
    boardId: string,
    userId: string,
    action: Action,
    apply: (board: StoredBoard) => BoardEvent
  ): Promise<BoardEvent> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const board = await this.load(boardId);
      this.authorize(board, userId, action);
      const rev = board.rev;
      const event = apply(board);
      if (await this.store.saveBoard(board, rev)) {
        await this.bus.publish(event);
        return event;
      }
    }
    throw new HttpError(503, "Board is busy, please try again");
  }

  private async load(boardId: string) {
    const board = await this.store.getBoard(boardId);
    if (!board) throw notFound("Board");
    return board;
  }

  private authorize(board: Board, userId: string, action: Action) {
    const role = roleOf(board, userId);
    if (!role) throw notFound("Board"); // don't reveal boards you aren't on
    if (!can(role, action)) throw forbidden();
  }
}

function publicBoard(b: StoredBoard): Board {
  const { rev, ...board } = b;
  return board;
}

function findList(board: Board, listId: string) {
  const list = board.lists.find((l) => l.id === listId);
  if (!list) throw notFound("List");
  return list;
}

function findCard(board: Board, cardId: string) {
  for (const list of board.lists) {
    const card = list.cards.find((c) => c.id === cardId);
    if (card) return { list, card };
  }
  throw notFound("Card");
}

function reindex<T extends { position: number }>(items: T[]) {
  items.forEach((item, i) => (item.position = i));
}
