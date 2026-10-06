import { User } from "../types";
import { Store, StoredBoard } from "./types";

const clone = <T>(v: T): T => structuredClone(v);

// Used by tests and for running the server without MongoDB.
export class MemoryStore implements Store {
  private users = new Map<string, User>();
  private boards = new Map<string, StoredBoard>();

  async createUser(user: User) {
    this.users.set(user.id, clone(user));
  }
  async findUserByEmail(email: string) {
    for (const u of this.users.values()) if (u.email === email) return clone(u);
    return null;
  }
  async findUserById(id: string) {
    const u = this.users.get(id);
    return u ? clone(u) : null;
  }
  async createBoard(board: StoredBoard) {
    this.boards.set(board.id, clone(board));
  }
  async getBoard(id: string) {
    const b = this.boards.get(id);
    return b ? clone(b) : null;
  }
  async listBoardsForUser(userId: string) {
    return [...this.boards.values()]
      .filter((b) => b.members.some((m) => m.userId === userId))
      .map(clone);
  }
  async saveBoard(board: StoredBoard, expectedRev: number) {
    const current = this.boards.get(board.id);
    if (!current || current.rev !== expectedRev) return false;
    this.boards.set(board.id, clone({ ...board, rev: expectedRev + 1 }));
    return true;
  }
  async deleteBoard(id: string) {
    this.boards.delete(id);
  }
}
