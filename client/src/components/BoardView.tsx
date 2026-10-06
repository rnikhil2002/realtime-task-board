import { DragEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { connectBoard } from "../api/realtime";
import { applyEvent } from "../boardReducer";
import { Board, BoardEvent, Card, User } from "../types";
import CardModal from "./CardModal";

type Status = "connecting" | "live" | "offline";

export default function BoardView({ boardId, user }: { boardId: string; user: User }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Card | null>(null);
  const [newList, setNewList] = useState("");
  const [invite, setInvite] = useState({ email: "", role: "member" });

  const load = useCallback(() => api.board(boardId).then(setBoard).catch((e) => setError(e.message)), [boardId]);
  const apply = (e: BoardEvent) => setBoard((b) => (b ? applyEvent(b, e) : b));

  useEffect(() => {
    load();
    return connectBoard(boardId, apply, setStatus, load);
  }, [boardId, load]);

  // Keep the open card in sync if someone else edits it while the modal is open.
  useEffect(() => {
    if (!editing || !board) return;
    const fresh = board.lists.flatMap((l) => l.cards).find((c) => c.id === editing.id);
    if (!fresh) setEditing(null);
  }, [board]);

  if (error) return <div className="center error">{error}</div>;
  if (!board) return <div className="center">Loading board...</div>;

  const role = board.members.find((m) => m.userId === user.id)?.role ?? "viewer";
  const canCards = role !== "viewer";
  const canLists = role === "owner" || role === "admin";

  // Every action applies the returned event right away so the UI feels instant.
  // The same event also arrives over the socket; the reducer ignores duplicates.
  const run = async (fn: () => Promise<unknown>) => {
    try {
      const event = (await fn()) as BoardEvent | undefined;
      if (event && "type" in event) apply(event);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) load();
      setError(e instanceof Error ? e.message : "Something went wrong");
      setTimeout(() => setError(""), 3000);
    }
  };

  const onDrop = (e: DragEvent, listId: string, position: number) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/card");
    if (cardId) run(() => api.moveCard(board.id, cardId, listId, position));
  };

  const addList = (e: FormEvent) => {
    e.preventDefault();
    if (!newList.trim()) return;
    run(() => api.createList(board.id, newList.trim()));
    setNewList("");
  };

  const sendInvite = (e: FormEvent) => {
    e.preventDefault();
    run(() => api.addMember(board.id, invite.email, invite.role));
    setInvite({ email: "", role: "member" });
  };

  return (
    <main className="board">
      <div className="board-head">
        <h2>{board.name}</h2>
        <span className={`status ${status}`}>{status === "live" ? "Live" : status === "offline" ? "Reconnecting..." : "Connecting..."}</span>
        <span className="muted">You are {role}</span>
        <div className="spacer" />
        {canLists && (
          <form className="inline" onSubmit={sendInvite}>
            <input placeholder="Invite by email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
              {role === "owner" && <option value="admin">Admin</option>}
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
            <button>Invite</button>
          </form>
        )}
      </div>

      <div className="columns">
        {board.lists.map((list) => (
          <section key={list.id} className="column" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, list.id, list.cards.length)}>
            <div className="column-head">
              <h3>{list.title}</h3>
              <span className="muted">{list.cards.length}</span>
              {canLists && (
                <button className="icon" title="Delete list" onClick={() => run(() => api.deleteList(board.id, list.id))}>×</button>
              )}
            </div>
            {list.cards.map((card, i) => (
              <article
                key={card.id}
                className="card"
                draggable={canCards}
                onDragStart={(e) => e.dataTransfer.setData("text/card", card.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation();
                  onDrop(e, list.id, i);
                }}
                onClick={() => setEditing(card)}
              >
                {card.title}
                {card.description && <span className="has-desc">≡</span>}
              </article>
            ))}
            {canCards && <AddCard onAdd={(title) => run(() => api.createCard(board.id, list.id, title))} />}
          </section>
        ))}
        {canLists && (
          <form className="column add-list" onSubmit={addList}>
            <input placeholder="+ Add a list" value={newList} onChange={(e) => setNewList(e.target.value)} />
          </form>
        )}
      </div>

      {error && <div className="toast">{error}</div>}
      {editing && (
        <CardModal
          card={board.lists.flatMap((l) => l.cards).find((c) => c.id === editing.id) ?? editing}
          readOnly={!canCards}
          onClose={() => setEditing(null)}
          onSave={(changes, version) => run(() => api.updateCard(board.id, editing.id, changes, version))}
          onDelete={() => {
            run(() => api.deleteCard(board.id, editing.id));
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

function AddCard({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onAdd(title.trim());
        setTitle("");
      }}
    >
      <input className="add-card" placeholder="+ Add a card" value={title} onChange={(e) => setTitle(e.target.value)} />
    </form>
  );
}
