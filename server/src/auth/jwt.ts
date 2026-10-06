import jwt from "jsonwebtoken";
import { config } from "../config";

export interface TokenPayload {
  sub: string;
  email: string;
}

export function signToken(payload: TokenPayload, secret = config.jwtSecret): string {
  return jwt.sign(payload, secret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, secret = config.jwtSecret): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    if (typeof decoded.sub !== "string" || typeof decoded.email !== "string") return null;
    return { sub: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
}
