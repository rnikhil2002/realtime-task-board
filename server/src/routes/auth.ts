import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { Store } from "../store/types";
import { signToken } from "../auth/jwt";
import { conflict, HttpError } from "../errors";
import { requireAuth } from "../auth/middleware";

const registerSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  name: z.string().min(1).max(80),
  password: z.string().min(8).max(128),
});
const loginSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  password: z.string().min(1),
});

export function authRoutes(store: Store) {
  const r = Router();

  r.post("/register", async (req, res, next) => {
    try {
      const body = registerSchema.parse(req.body);
      if (await store.findUserByEmail(body.email)) throw conflict("Email already registered");
      const user = {
        id: randomUUID(),
        email: body.email,
        name: body.name,
        passwordHash: await bcrypt.hash(body.password, 10),
      };
      await store.createUser(user);
      res.status(201).json({
        token: signToken({ sub: user.id, email: user.email }),
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (e) {
      next(e);
    }
  });

  r.post("/login", async (req, res, next) => {
    try {
      const body = loginSchema.parse(req.body);
      const user = await store.findUserByEmail(body.email);
      const ok = user && (await bcrypt.compare(body.password, user.passwordHash));
      if (!user || !ok) throw new HttpError(401, "Wrong email or password");
      res.json({
        token: signToken({ sub: user.id, email: user.email }),
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (e) {
      next(e);
    }
  });

  r.get("/me", requireAuth, async (req, res, next) => {
    try {
      const user = await store.findUserById(req.user!.sub);
      if (!user) throw new HttpError(401, "User no longer exists");
      res.json({ id: user.id, email: user.email, name: user.name });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
