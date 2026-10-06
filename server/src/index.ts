import http from "http";
import { config } from "./config";
import { createApp } from "./app";
import { BoardService } from "./boardService";
import { MongoStore } from "./store/mongo";
import { MemoryStore } from "./store/memory";
import { LocalBus, RedisBus, EventBus } from "./realtime/bus";
import { attachRealtime } from "./realtime/socket";
import { logger } from "./logger";
import { Store } from "./store/types";

async function main() {
  const store: Store =
    process.env.STORE === "memory" ? new MemoryStore() : await MongoStore.connect(config.mongoUrl);
  const bus: EventBus = config.redisUrl ? new RedisBus(config.redisUrl) : new LocalBus();
  const service = new BoardService(store, bus);

  const app = createApp(store, service, config.corsOrigin);
  const server = http.createServer(app);
  attachRealtime(server, service, bus);

  server.listen(config.port, () =>
    logger.info({ port: config.port, redis: !!config.redisUrl }, "task board server running")
  );

  const shutdown = async () => {
    logger.info("shutting down");
    server.close();
    await bus.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.error({ err }, "failed to start");
  process.exit(1);
});
