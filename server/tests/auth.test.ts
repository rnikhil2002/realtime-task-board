import request from "supertest";
import { setup, registerUser, auth } from "./helpers";

describe("auth routes", () => {
  const { app } = setup();

  it("registers and returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "New@Example.com", name: "New", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe("new@example.com");
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("rejects duplicate emails", async () => {
    const body = { email: "dup@example.com", name: "Dup", password: "password123" };
    await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(409);
  });

  it("rejects short passwords", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "short@example.com", name: "S", password: "123" });
    expect(res.status).toBe(400);
  });

  it("logs in with the right password and rejects the wrong one", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ email: "login@example.com", name: "L", password: "password123" });
    const ok = await request(app).post("/api/auth/login").send({ email: "login@example.com", password: "password123" });
    const bad = await request(app).post("/api/auth/login").send({ email: "login@example.com", password: "nope" });
    expect(ok.status).toBe(200);
    expect(bad.status).toBe(401);
  });

  it("returns the current user from /me", async () => {
    const u = await registerUser(app, "Me");
    const res = await request(app).get("/api/auth/me").set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(u.id);
  });

  it("blocks protected routes without a token", async () => {
    const res = await request(app).get("/api/boards");
    expect(res.status).toBe(401);
  });
});
