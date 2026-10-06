import request from "supertest";
import { setup, registerUser, auth } from "./helpers";

async function boardWithRoles() {
  const ctx = setup();
  const owner = await registerUser(ctx.app, "Owner");
  const admin = await registerUser(ctx.app, "Admin");
  const member = await registerUser(ctx.app, "Member");
  const viewer = await registerUser(ctx.app, "Viewer");
  const stranger = await registerUser(ctx.app, "Stranger");

  const board = (await request(ctx.app).post("/api/boards").set(auth(owner.token)).send({ name: "Sprint" })).body;
  for (const [u, role] of [[admin, "admin"], [member, "member"], [viewer, "viewer"]] as const) {
    await request(ctx.app)
      .post(`/api/boards/${board.id}/members`)
      .set(auth(owner.token))
      .send({ email: u.email, role });
  }
  const list = (await request(ctx.app).post(`/api/boards/${board.id}/lists`).set(auth(owner.token)).send({ title: "To do" })).body.list;
  return { ...ctx, owner, admin, member, viewer, stranger, board, list };
}

describe("boards", () => {
  it("creates a board with the creator as owner", async () => {
    const { board, owner } = await boardWithRoles();
    expect(board.members[0]).toEqual({ userId: owner.id, role: "owner" });
  });

  it("lists only boards the user belongs to", async () => {
    const { app, member, stranger } = await boardWithRoles();
    expect((await request(app).get("/api/boards").set(auth(member.token))).body).toHaveLength(1);
    expect((await request(app).get("/api/boards").set(auth(stranger.token))).body).toHaveLength(0);
  });

  it("hides boards from non-members with a 404", async () => {
    const { app, board, stranger } = await boardWithRoles();
    const res = await request(app).get(`/api/boards/${board.id}`).set(auth(stranger.token));
    expect(res.status).toBe(404);
  });

  it("validates board names", async () => {
    const { app, owner } = await boardWithRoles();
    const res = await request(app).post("/api/boards").set(auth(owner.token)).send({ name: "" });
    expect(res.status).toBe(400);
  });
});

describe("permissions", () => {
  it("viewer can read but not create cards", async () => {
    const { app, board, list, viewer } = await boardWithRoles();
    expect((await request(app).get(`/api/boards/${board.id}`).set(auth(viewer.token))).status).toBe(200);
    const res = await request(app)
      .post(`/api/boards/${board.id}/lists/${list.id}/cards`)
      .set(auth(viewer.token))
      .send({ title: "Nope" });
    expect(res.status).toBe(403);
  });

  it("member can create cards but not lists", async () => {
    const { app, board, list, member } = await boardWithRoles();
    const card = await request(app)
      .post(`/api/boards/${board.id}/lists/${list.id}/cards`)
      .set(auth(member.token))
      .send({ title: "Task" });
    expect(card.status).toBe(201);
    const newList = await request(app).post(`/api/boards/${board.id}/lists`).set(auth(member.token)).send({ title: "X" });
    expect(newList.status).toBe(403);
  });

  it("admin can add members but cannot make admins", async () => {
    const { app, board, admin, stranger } = await boardWithRoles();
    const asAdmin = await request(app)
      .post(`/api/boards/${board.id}/members`)
      .set(auth(admin.token))
      .send({ email: stranger.email, role: "admin" });
    expect(asAdmin.status).toBe(403);
    const asMember = await request(app)
      .post(`/api/boards/${board.id}/members`)
      .set(auth(admin.token))
      .send({ email: stranger.email, role: "member" });
    expect(asMember.status).toBe(201);
  });

  it("only the owner can delete a board", async () => {
    const { app, board, admin, owner } = await boardWithRoles();
    expect((await request(app).delete(`/api/boards/${board.id}`).set(auth(admin.token))).status).toBe(403);
    expect((await request(app).delete(`/api/boards/${board.id}`).set(auth(owner.token))).status).toBe(204);
  });

  it("rejects adding someone twice", async () => {
    const { app, board, owner, member } = await boardWithRoles();
    const res = await request(app)
      .post(`/api/boards/${board.id}/members`)
      .set(auth(owner.token))
      .send({ email: member.email, role: "viewer" });
    expect(res.status).toBe(409);
  });
});

describe("cards", () => {
  async function withCard() {
    const ctx = await boardWithRoles();
    const res = await request(ctx.app)
      .post(`/api/boards/${ctx.board.id}/lists/${ctx.list.id}/cards`)
      .set(auth(ctx.member.token))
      .send({ title: "Write tests" });
    return { ...ctx, card: res.body.card };
  }

  it("updates a card and bumps its version", async () => {
    const { app, board, card, member } = await withCard();
    const res = await request(app)
      .patch(`/api/boards/${board.id}/cards/${card.id}`)
      .set(auth(member.token))
      .send({ title: "Write more tests", version: card.version });
    expect(res.status).toBe(200);
    expect(res.body.card.title).toBe("Write more tests");
    expect(res.body.card.version).toBe(card.version + 1);
  });

  it("rejects an edit based on a stale version", async () => {
    const { app, board, card, member, owner } = await withCard();
    await request(app)
      .patch(`/api/boards/${board.id}/cards/${card.id}`)
      .set(auth(owner.token))
      .send({ title: "Owner edit", version: card.version });
    const stale = await request(app)
      .patch(`/api/boards/${board.id}/cards/${card.id}`)
      .set(auth(member.token))
      .send({ title: "Member edit", version: card.version });
    expect(stale.status).toBe(409);
  });

  it("moves a card to another list and reindexes positions", async () => {
    const { app, board, card, owner, list } = await withCard();
    const done = (await request(app).post(`/api/boards/${board.id}/lists`).set(auth(owner.token)).send({ title: "Done" })).body.list;
    const res = await request(app)
      .post(`/api/boards/${board.id}/cards/${card.id}/move`)
      .set(auth(owner.token))
      .send({ toListId: done.id, toPosition: 0 });
    expect(res.status).toBe(200);
    const full = (await request(app).get(`/api/boards/${board.id}`).set(auth(owner.token))).body;
    expect(full.lists.find((l: any) => l.id === list.id).cards).toHaveLength(0);
    expect(full.lists.find((l: any) => l.id === done.id).cards[0].id).toBe(card.id);
  });

  it("deletes a card", async () => {
    const { app, board, card, member } = await withCard();
    const res = await request(app).delete(`/api/boards/${board.id}/cards/${card.id}`).set(auth(member.token));
    expect(res.status).toBe(204);
  });

  it("returns 404 for a missing card", async () => {
    const { app, board, member } = await withCard();
    const res = await request(app)
      .patch(`/api/boards/${board.id}/cards/does-not-exist`)
      .set(auth(member.token))
      .send({ title: "x", version: 1 });
    expect(res.status).toBe(404);
  });
});

describe("events", () => {
  it("publishes an event for every change", async () => {
    const ctx = await boardWithRoles();
    const types = ctx.events.map((e) => e.type);
    expect(types).toEqual(["member.added", "member.added", "member.added", "list.created"]);
  });
});
