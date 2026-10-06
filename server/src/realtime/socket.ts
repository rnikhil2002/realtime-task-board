import { IncomingMessage, Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { verifyToken } from "../auth/jwt";
import { BoardService } from "../boardService";
import { EventBus } from "./bus";
import { logger } from "../logger";

interface Client extends WebSocket {
  userId: string;
  boards: Set<string>;
  alive: boolean;
}

type ClientMessage = { type: "subscribe"; boardId: string } | { type: "unsubscribe"; boardId: string };

const HEARTBEAT_MS = 30_000;

export function attachRealtime(server: Server, service: BoardService, bus: EventBus) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const rooms = new Map<string, Set<Client>>();

  const leave = (client: Client, boardId: string) => {
    client.boards.delete(boardId);
    rooms.get(boardId)?.delete(client);
    if (rooms.get(boardId)?.size === 0) rooms.delete(boardId);
  };

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const payload = verifyToken(url.searchParams.get("token") ?? "");
    if (!payload) {
      ws.close(4401, "Unauthorized");
      return;
    }
    const client = ws as Client;
    client.userId = payload.sub;
    client.boards = new Set();
    client.alive = true;

    client.on("pong", () => (client.alive = true));

    client.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return client.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      }
      if (msg.type === "subscribe") {
        // Same permission check as the REST API, so sockets can't be used to peek at boards.
        if (!(await service.canRead(client.userId, msg.boardId))) {
          return client.send(JSON.stringify({ type: "error", error: "Board not found" }));
        }
        client.boards.add(msg.boardId);
        if (!rooms.has(msg.boardId)) rooms.set(msg.boardId, new Set());
        rooms.get(msg.boardId)!.add(client);
        client.send(JSON.stringify({ type: "subscribed", boardId: msg.boardId }));
      } else if (msg.type === "unsubscribe") {
        leave(client, msg.boardId);
      }
    });

    client.on("close", () => {
      for (const boardId of [...client.boards]) leave(client, boardId);
    });
  });

  bus.subscribe((event) => {
    const room = rooms.get(event.boardId);
    if (!room) return;
    const data = JSON.stringify({ type: "event", event });
    for (const client of room) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  });

  // Drop connections that stopped answering pings (closed laptop, lost wifi).
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      const client = ws as Client;
      if (!client.alive) {
        client.terminate();
        continue;
      }
      client.alive = false;
      client.ping();
    }
  }, HEARTBEAT_MS);
  wss.on("close", () => clearInterval(timer));

  logger.info("realtime socket server attached at /ws");
  return wss;
}
