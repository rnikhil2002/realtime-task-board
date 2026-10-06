import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { Board } from "../types";

export default function BoardList({ onOpen }: { onOpen: (id: string) => void }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    api.boards().then(setBoards);
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const board = await api.createBoard(name.trim());
    setName("");
    onOpen(board.id);
  };

  return (
    <main className="boards">
      <h2>Your boards</h2>
      <div className="grid">
        {boards.map((b) => (
          <button key={b.id} className="board-tile" onClick={() => onOpen(b.id)}>
            <strong>{b.name}</strong>
            <span className="muted">{b.lists.reduce((n, l) => n + l.cards.length, 0)} cards</span>
          </button>
        ))}
        <form className="board-tile new" onSubmit={create}>
          <input placeholder="New board name" value={name} onChange={(e) => setName(e.target.value)} />
          <button>Create</button>
        </form>
      </div>
    </main>
  );
}
