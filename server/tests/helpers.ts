import request from "supertest";
import { createApp } from "../src/app";
import { BoardService } from "../src/boardService";
import { MemoryStore } from "../src/store/memory";
import { LocalBus } from "../src/realtime/bus";
import { BoardEvent } from "../src/types";

export function setup() {
  const store = new MemoryStore();
  const bus = new LocalBus();
  const events: BoardEvent[] = [];
  bus.subscribe((e) => events.push(e));
  const service = new BoardService(store, bus);
  const app = createApp(store, service);
  return { store, bus, service, app, events };
}

let counter = 0;
export async function registerUser(app: any, name = "User") {
  counter += 1;
  const email = `${name.toLowerCase()}${counter}@example.com`;
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, name, password: "password123" });
  return { token: res.body.token as string, id: res.body.user.id as string, email };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
