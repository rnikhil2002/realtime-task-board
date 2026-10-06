import { useEffect, useState } from "react";
import { Card } from "../types";

interface Props {
  card: Card;
  readOnly: boolean;
  onClose: () => void;
  onSave: (changes: { title: string; description: string }, version: number) => void;
  onDelete: () => void;
}

export default function CardModal({ card, readOnly, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [baseVersion, setBaseVersion] = useState(card.version);
  const changedElsewhere = card.version !== baseVersion;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadLatest = () => {
    setTitle(card.title);
    setDescription(card.description);
    setBaseVersion(card.version);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        {changedElsewhere && (
          <div className="warning">
            Someone just changed this card. <button className="link" onClick={loadLatest}>Load their version</button>
          </div>
        )}
        <input className="title-input" value={title} disabled={readOnly} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          rows={6}
          placeholder="Add a description..."
          value={description}
          disabled={readOnly}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="row">
          {!readOnly && (
            <>
              <button
                onClick={() => {
                  onSave({ title, description }, baseVersion);
                  onClose();
                }}
              >
                Save
              </button>
              <button className="danger" onClick={onDelete}>Delete</button>
            </>
          )}
          <div className="spacer" />
          <span className="muted">v{card.version}</span>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
