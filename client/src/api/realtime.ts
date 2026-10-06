import { BoardEvent } from "../types";
import { getToken } from "./client";

type Status = "connecting" | "live" | "offline";

// Keeps one socket open for the board and reconnects with backoff if the connection drops.
// After a reconnect we ask the caller to refetch, since we may have missed events while offline.
export function connectBoard(
  boardId: string,
  onEvent: (e: BoardEvent) => void,
  onStatus: (s: Status) => void,
  onResync: () => void
) {
  let ws: WebSocket | null = null;
  let attempts = 0;
  let closed = false;
  let timer: number | undefined;

  const open = () => {
    onStatus("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(getToken())}`);
    ws.onopen = () => ws!.send(JSON.stringify({ type: "subscribe", boardId }));
    ws.onmessage = (raw) => {
      const msg = JSON.parse(raw.data);
      if (msg.type === "subscribed") {
        if (attempts > 0) onResync();
        attempts = 0;
        onStatus("live");
      } else if (msg.type === "event") {
        onEvent(msg.event);
      }
    };
    ws.onclose = () => {
      if (closed) return;
      onStatus("offline");
      attempts += 1;
      const delay = Math.min(1000 * 2 ** attempts, 15000);
      timer = window.setTimeout(open, delay);
    };
  };

  open();
  return () => {
    closed = true;
    window.clearTimeout(timer);
    ws?.close();
  };
}
