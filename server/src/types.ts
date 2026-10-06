export type Role = "owner" | "admin" | "member" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  position: number;
  version: number;
  updatedAt: string;
}

export interface List {
  id: string;
  title: string;
  position: number;
  cards: Card[];
}

export interface Member {
  userId: string;
  role: Role;
}

export interface Board {
  id: string;
  name: string;
  members: Member[];
  lists: List[];
  createdAt: string;
}

// Events broadcast to everyone viewing a board
export type BoardEvent =
  | { type: "list.created"; boardId: string; list: List }
  | { type: "list.deleted"; boardId: string; listId: string }
  | { type: "card.created"; boardId: string; listId: string; card: Card }
  | { type: "card.updated"; boardId: string; listId: string; card: Card }
  | { type: "card.moved"; boardId: string; fromListId: string; toListId: string; card: Card }
  | { type: "card.deleted"; boardId: string; listId: string; cardId: string }
  | { type: "member.added"; boardId: string; member: Member };
