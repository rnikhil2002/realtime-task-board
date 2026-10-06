import { BoardService } from "../src/boardService";
import { MemoryStore } from "../src/store/memory";
import { LocalBus } from "../src/realtime/bus";

describe("concurrent writes", () => {
  it("keeps every card when many writes hit the same board at once", async () => {
    const store = new MemoryStore();
    const service = new BoardService(store, new LocalBus());
    const board = await service.createBoard("owner", "Busy");
    const created = await service.createList("owner", board.id, "Inbox");
    const listId = (created as any).list.id;

    // 20 cards created in parallel. Some saves will collide and retry.
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => service.createCard("owner", board.id, listId, `Card ${i}`))
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const after = await service.getBoard("owner", board.id);
    expect(after.lists[0].cards).toHaveLength(ok);
    // positions stay 0..n-1 with no gaps or duplicates
    expect(after.lists[0].cards.map((c) => c.position)).toEqual([...Array(ok).keys()]);
  });

  it("rejects a stale save at the store level", async () => {
    const store = new MemoryStore();
    await store.createBoard({ id: "b", name: "x", members: [], lists: [], createdAt: "", rev: 0 });
    const a = (await store.getBoard("b"))!;
    const b = (await store.getBoard("b"))!;
    expect(await store.saveBoard({ ...a, name: "first" }, 0)).toBe(true);
    expect(await store.saveBoard({ ...b, name: "second" }, 0)).toBe(false);
    expect((await store.getBoard("b"))!.name).toBe("first");
  });
});
