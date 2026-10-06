import { can, canAssignRole, roleOf } from "../src/rbac";
import { Board } from "../src/types";

const board: Board = {
  id: "b1",
  name: "Test",
  createdAt: "",
  lists: [],
  members: [
    { userId: "o", role: "owner" },
    { userId: "a", role: "admin" },
    { userId: "m", role: "member" },
    { userId: "v", role: "viewer" },
  ],
};

describe("roleOf", () => {
  it("returns the member's role", () => {
    expect(roleOf(board, "a")).toBe("admin");
  });
  it("returns null for non-members", () => {
    expect(roleOf(board, "stranger")).toBeNull();
  });
});

describe("can", () => {
  it.each([
    ["viewer", "board:read", true],
    ["viewer", "card:write", false],
    ["member", "card:write", true],
    ["member", "list:write", false],
    ["admin", "list:write", true],
    ["admin", "member:manage", true],
    ["admin", "board:delete", false],
    ["owner", "board:delete", true],
  ] as const)("%s -> %s = %s", (role, action, expected) => {
    expect(can(role, action)).toBe(expected);
  });

  it("denies everything when there is no role", () => {
    expect(can(null, "board:read")).toBe(false);
  });
});

describe("canAssignRole", () => {
  it("owner can assign admin but not another owner", () => {
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("owner", "owner")).toBe(false);
  });
  it("admin can only assign member or viewer", () => {
    expect(canAssignRole("admin", "member")).toBe(true);
    expect(canAssignRole("admin", "viewer")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
  });
  it("members and viewers cannot assign roles", () => {
    expect(canAssignRole("member", "viewer")).toBe(false);
    expect(canAssignRole("viewer", "viewer")).toBe(false);
  });
});
