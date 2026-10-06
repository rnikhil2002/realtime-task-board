import { Router } from "express";
import { z } from "zod";
import { BoardService } from "../boardService";
import { requireAuth } from "../auth/middleware";

const name = z.object({ name: z.string().min(1).max(100) });
const title = z.object({ title: z.string().min(1).max(200) });
const newCard = z.object({ title: z.string().min(1).max(200), description: z.string().max(5000).optional() });
const updateCard = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  version: z.number().int().positive(),
});
const moveCard = z.object({ toListId: z.string(), toPosition: z.number().int().min(0) });
const addMember = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  role: z.enum(["admin", "member", "viewer"]),
});

type Handler = (req: any, res: any) => Promise<unknown>;
const wrap = (fn: Handler) => (req: any, res: any, next: any) => fn(req, res).catch(next);

export function boardRoutes(service: BoardService) {
  const r = Router();
  r.use(requireAuth);
  const uid = (req: any) => req.user.sub as string;

  r.get("/", wrap(async (req, res) => res.json(await service.listBoards(uid(req)))));

  r.post("/", wrap(async (req, res) => {
    const body = name.parse(req.body);
    res.status(201).json(await service.createBoard(uid(req), body.name));
  }));

  r.get("/:boardId", wrap(async (req, res) => res.json(await service.getBoard(uid(req), req.params.boardId))));

  r.delete("/:boardId", wrap(async (req, res) => {
    await service.deleteBoard(uid(req), req.params.boardId);
    res.status(204).end();
  }));

  r.post("/:boardId/members", wrap(async (req, res) => {
    const body = addMember.parse(req.body);
    res.status(201).json(await service.addMember(uid(req), req.params.boardId, body.email, body.role));
  }));

  r.post("/:boardId/lists", wrap(async (req, res) => {
    const body = title.parse(req.body);
    res.status(201).json(await service.createList(uid(req), req.params.boardId, body.title));
  }));

  r.delete("/:boardId/lists/:listId", wrap(async (req, res) => {
    await service.deleteList(uid(req), req.params.boardId, req.params.listId);
    res.status(204).end();
  }));

  r.post("/:boardId/lists/:listId/cards", wrap(async (req, res) => {
    const body = newCard.parse(req.body);
    res.status(201).json(
      await service.createCard(uid(req), req.params.boardId, req.params.listId, body.title, body.description)
    );
  }));

  r.patch("/:boardId/cards/:cardId", wrap(async (req, res) => {
    const { version, ...changes } = updateCard.parse(req.body);
    res.json(await service.updateCard(uid(req), req.params.boardId, req.params.cardId, changes, version));
  }));

  r.post("/:boardId/cards/:cardId/move", wrap(async (req, res) => {
    const body = moveCard.parse(req.body);
    res.json(await service.moveCard(uid(req), req.params.boardId, req.params.cardId, body.toListId, body.toPosition));
  }));

  r.delete("/:boardId/cards/:cardId", wrap(async (req, res) => {
    await service.deleteCard(uid(req), req.params.boardId, req.params.cardId);
    res.status(204).end();
  }));

  return r;
}
