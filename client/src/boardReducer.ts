import { Board, BoardEvent } from "./types";

// Applies a server event to the local copy of the board. Pure function, so it is easy to reason about.
export function applyEvent(board: Board, e: BoardEvent): Board {
  if (e.boardId !== board.id) return board;
  const lists = board.lists.map((l) => ({ ...l, cards: [...l.cards] }));
  const listById = (id: string) => lists.find((l) => l.id === id);
  const withoutCard = (cardId: string) => lists.forEach((l) => (l.cards = l.cards.filter((c) => c.id !== cardId)));

  switch (e.type) {
    case "list.created":
      if (lists.some((l) => l.id === e.list.id)) return board;
      return { ...board, lists: [...lists, e.list] };
    case "list.deleted":
      return { ...board, lists: lists.filter((l) => l.id !== e.listId) };
    case "card.created": {
      const list = listById(e.listId);
      if (list && !list.cards.some((c) => c.id === e.card.id)) list.cards.push(e.card);
      return { ...board, lists };
    }
    case "card.updated": {
      const list = listById(e.listId);
      if (list) list.cards = list.cards.map((c) => (c.id === e.card.id ? e.card : c));
      return { ...board, lists };
    }
    case "card.moved": {
      withoutCard(e.card.id);
      const to = listById(e.toListId);
      if (to) to.cards.splice(e.card.position, 0, e.card);
      return { ...board, lists: lists.map((l) => ({ ...l, cards: l.cards.map((c, i) => ({ ...c, position: i })) })) };
    }
    case "card.deleted":
      withoutCard(e.cardId);
      return { ...board, lists };
    case "member.added":
      return { ...board, members: [...board.members, e.member] };
  }
}
