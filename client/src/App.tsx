import { useEffect, useState } from "react";
import { api, setToken, getToken } from "./api/client";
import { User } from "./types";
import Login from "./components/Login";
import BoardList from "./components/BoardList";
import BoardView from "./components/BoardView";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(!!getToken());
  const [boardId, setBoardId] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    api.me().then(setUser).catch(() => setToken("")).finally(() => setChecking(false));
  }, []);

  const logout = () => {
    setToken("");
    setUser(null);
    setBoardId(null);
  };

  if (checking) return <div className="center">Loading...</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="app">
      <header className="topbar">
        <button className="link" onClick={() => setBoardId(null)}>Task Board</button>
        <div className="spacer" />
        <span className="muted">{user.name}</span>
        <button className="ghost" onClick={logout}>Log out</button>
      </header>
      {boardId ? <BoardView boardId={boardId} user={user} /> : <BoardList onOpen={setBoardId} />}
    </div>
  );
}
