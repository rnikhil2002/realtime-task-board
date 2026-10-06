import { Board, User } from "../types";

let token = localStorage.getItem("token") ?? "";
export const getToken = () => token;
export const setToken = (t: string) => {
  token = t;
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Request failed");
  return data as T;
}

type AuthResponse = { token: string; user: User };

export const api = {
  register: (email: string, name: string, password: string) =>
    call<AuthResponse>("POST", "/auth/register", { email, name, password }),
  login: (email: string, password: string) => call<AuthResponse>("POST", "/auth/login", { email, password }),
  me: () => call<User>("GET", "/auth/me"),
  boards: () => call<Board[]>("GET", "/boards"),
  createBoard: (name: string) => call<Board>("POST", "/boards", { name }),
  board: (id: string) => call<Board>("GET", `/boards/${id}`),
  createList: (boardId: string, title: string) => call("POST", `/boards/${boardId}/lists`, { title }),
  deleteList: (boardId: string, listId: string) => call("DELETE", `/boards/${boardId}/lists/${listId}`),
  createCard: (boardId: string, listId: string, title: string) =>
    call("POST", `/boards/${boardId}/lists/${listId}/cards`, { title }),
  updateCard: (boardId: string, cardId: string, changes: { title?: string; description?: string }, version: number) =>
    call("PATCH", `/boards/${boardId}/cards/${cardId}`, { ...changes, version }),
  moveCard: (boardId: string, cardId: string, toListId: string, toPosition: number) =>
    call("POST", `/boards/${boardId}/cards/${cardId}/move`, { toListId, toPosition }),
  deleteCard: (boardId: string, cardId: string) => call("DELETE", `/boards/${boardId}/cards/${cardId}`),
  addMember: (boardId: string, email: string, role: string) =>
    call("POST", `/boards/${boardId}/members`, { email, role }),
};
