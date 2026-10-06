import { signToken, verifyToken } from "../src/auth/jwt";

describe("jwt", () => {
  it("round-trips a payload", () => {
    const token = signToken({ sub: "u1", email: "a@b.com" });
    expect(verifyToken(token)).toEqual({ sub: "u1", email: "a@b.com" });
  });
  it("rejects a token signed with a different secret", () => {
    const token = signToken({ sub: "u1", email: "a@b.com" }, "other-secret");
    expect(verifyToken(token)).toBeNull();
  });
  it("rejects garbage", () => {
    expect(verifyToken("not.a.token")).toBeNull();
  });
});
