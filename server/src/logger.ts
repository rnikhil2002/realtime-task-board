import pino from "pino";

// Structured JSON logs, so CloudWatch (or any log tool) can search by field.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
});
