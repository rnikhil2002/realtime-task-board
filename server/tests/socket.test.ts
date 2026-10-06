import http from "http";
import { AddressInfo } from "net";
import WebSocket from "ws";
import { createApp } from "../src/app";
import { BoardService } from "../src/boardService";
import { MemoryStore } from "../src/store/memory";
import { LocalBus } from "../src/realtime/bus";
import { attachRealtime } from "../src/realtime/socket";
import { signToken } from "../src/auth/jwt";

function waitFor(ws: WebSocket, predicate: (m: any) => boolean, ms = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (predicate(msg)) {
        clearTimeout(timer);
        resolve(msg);
      }
    });
  });
}

describe("realtime socket", () => {
  let server: http.Server;
  let wss: any;
  let service: BoardService;
  let url: string;

  beforeAll((done) => {
    const store = new MemoryStore();
    const bus = new LocalBus();
    service = new BoardService(store, bus);
    server = http.createServer(createApp(store, service));
    wss = attachRealtime(server, service, bus);
    server.listen(0, () => {
      url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`;
      done();
    });
  });

  afterAll((done) => {
    wss.close();
    server.close(done);
  });

  const connect = (userId: string) =>
    new Promise<WebSocket>((resolve) => {
      const ws = new WebSocket(`${url}?token=${signToken({ sub: userId, email: `${userId}@x.com` })}`);
      ws.on("open", () => resolve(ws));
    });

  it("closes connections without a valid token", (done) => {
    const ws = new WebSocket(`${url}?token=bad`);
    ws.on("close", (code) => {
      expect(code).toBe(4401);
      done();
    });
  });

  it("pushes card events to subscribed users", async () => {
    const board = await service.createBoard("alice", "Live");
    const ws = await connect("alice");
    const subscribed = waitFor(ws, (m) => m.type === "subscribed");
    ws.send(JSON.stringify({ type: "subscribe", boardId: board.id }));
    await subscribed;

    const got = waitFor(ws, (m) => m.type === "event" && m.event.type === "list.created");
    await service.createList("alice", board.id, "From another tab");
    const msg = await got;
    expect(msg.event.list.title).toBe("From another tab");
    ws.close();
  });

  it("refuses to subscribe someone who is not on the board", async () => {
    const board = await service.createBoard("bob", "Private");
    const ws = await connect("eve");
    const err = waitFor(ws, (m) => m.type === "error");
    ws.send(JSON.stringify({ type: "subscribe", boardId: board.id }));
    expect((await err).error).toBe("Board not found");
    ws.close();
  });
});
