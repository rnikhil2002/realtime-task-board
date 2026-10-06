import { EventEmitter } from "events";
import Redis from "ioredis";
import { BoardEvent } from "../types";

export interface EventBus {
  publish(event: BoardEvent): Promise<void>;
  subscribe(handler: (event: BoardEvent) => void): void;
  close(): Promise<void>;
}

// Single-process bus. Good for tests and running one server locally.
export class LocalBus implements EventBus {
  private emitter = new EventEmitter();
  async publish(event: BoardEvent) {
    this.emitter.emit("event", event);
  }
  subscribe(handler: (event: BoardEvent) => void) {
    this.emitter.on("event", handler);
  }
  async close() {
    this.emitter.removeAllListeners();
  }
}

const CHANNEL = "board-events";

// Every server instance publishes to Redis and every instance (including the sender)
// receives the message and pushes it to its own connected sockets. This keeps users
// on different servers in sync.
export class RedisBus implements EventBus {
  private pub: Redis;
  private sub: Redis;
  private handlers: Array<(e: BoardEvent) => void> = [];

  constructor(url: string) {
    this.pub = new Redis(url);
    this.sub = new Redis(url);
    this.sub.subscribe(CHANNEL);
    this.sub.on("message", (_channel, raw) => {
      let event: BoardEvent;
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }
      for (const h of this.handlers) h(event);
    });
  }

  async publish(event: BoardEvent) {
    await this.pub.publish(CHANNEL, JSON.stringify(event));
  }
  subscribe(handler: (event: BoardEvent) => void) {
    this.handlers.push(handler);
  }
  async close() {
    await Promise.all([this.pub.quit(), this.sub.quit()]);
  }
}
