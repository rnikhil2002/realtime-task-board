import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { authRoutes } from "./routes/auth";
import { boardRoutes } from "./routes/boards";
import { BoardService } from "./boardService";
import { Store } from "./store/types";
import { HttpError } from "./errors";
import { logger } from "./logger";

export function createApp(store: Store, service: BoardService, corsOrigin = "*") {
  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRoutes(store));
  app.use("/api/boards", boardRoutes(service));

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request", details: err.flatten().fieldErrors });
    }
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    logger.error({ err, path: req.path }, "unhandled error");
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
