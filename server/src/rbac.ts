import { Board, Role } from "./types";

export type Action =
  | "board:read"
  | "board:delete"
  | "member:manage"
  | "list:write"
  | "card:write";

// Each role gets everything the role below it has, plus a bit more.
const permissions: Record<Role, Action[]> = {
  viewer: ["board:read"],
  member: ["board:read", "card:write"],
  admin: ["board:read", "card:write", "list:write", "member:manage"],
  owner: ["board:read", "card:write", "list:write", "member:manage", "board:delete"],
};

export function roleOf(board: Board, userId: string): Role | null {
  return board.members.find((m) => m.userId === userId)?.role ?? null;
}

export function can(role: Role | null, action: Action): boolean {
  if (!role) return false;
  return permissions[role].includes(action);
}

// Admins can add members but cannot hand out owner or admin.
export function canAssignRole(actor: Role | null, target: Role): boolean {
  if (actor === "owner") return target !== "owner";
  if (actor === "admin") return target === "member" || target === "viewer";
  return false;
}
