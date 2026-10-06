import { Board, User } from "../types";

export interface StoredBoard extends Board {
  rev: number; // bumped on every write, used to reject stale writes
}

export interface Store {
  createUser(user: User): Promise<void>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;

  createBoard(board: StoredBoard): Promise<void>;
  getBoard(id: string): Promise<StoredBoard | null>;
  listBoardsForUser(userId: string): Promise<StoredBoard[]>;
  // Saves only if the stored rev still equals expectedRev. Returns false if someone else wrote first.
  saveBoard(board: StoredBoard, expectedRev: number): Promise<boolean>;
  deleteBoard(id: string): Promise<void>;
}
