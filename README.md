# Real-Time Collaborative Task Board

A Trello-style task board where several people can work on the same board at the same time and see each other's changes instantly.

Built with **React + TypeScript** on the frontend and **Node.js + TypeScript + WebSockets** on the backend, with **MongoDB** for storage and **Redis Pub/Sub** to keep multiple server instances in sync.

## Features

- Boards, lists and cards with drag and drop between lists
- Live updates over WebSockets, with automatic reconnect and resync after a dropped connection
- Works across multiple server instances: an edit on one server reaches users connected to any other server through Redis Pub/Sub
- JWT authentication and role-based access control with 4 roles (owner, admin, member, viewer), checked on every REST call **and** every socket subscription
- Safe concurrent editing:
  - each card has a version number, so two people editing the same card can't silently overwrite each other (the second save gets a 409 and the UI offers to load the newer version)
  - each board save uses optimistic locking, so parallel writes from different servers retry instead of losing data
- Structured JSON logging (pino), health checks, input validation with zod

## Architecture

```
 Browser (React)  ──REST──▶  ┌──────────┐      ┌─────────┐
        │                    │ server-1 │◀────▶│         │
        └──WebSocket────────▶│ server-2 │◀────▶│  Redis  │  Pub/Sub fan-out
                             └────┬─────┘      └─────────┘
                                  │
                              ┌───▼────┐
                              │MongoDB │
                              └────────┘
```

1. A user changes something through the REST API.
2. The server checks the user's role, applies the change and saves it with optimistic locking.
3. The server publishes the change to Redis.
4. Every server instance receives it and pushes it to the sockets watching that board.

## Run it locally

**With Docker (full stack, two API servers behind nginx):**

```bash
docker compose up --build
```

Open http://localhost:8080 in two different browsers, sign up as two users, invite one to the other's board, and edit cards side by side.

**Without Docker (single server, in-memory storage):**

```bash
cd server && npm install && STORE=memory npm run dev
cd client && npm install && npm run dev     # http://localhost:5173
```

## Tests

```bash
cd server && npm test
```

Covers RBAC rules, JWT handling, auth and board API routes, version conflicts, parallel writes with optimistic locking, and the WebSocket server (auth, subscriptions, live events).

## Deployment

- `k8s/` has manifests for Kubernetes (built with AWS EKS in mind): Deployment with readiness/liveness probes, Service, HorizontalPodAutoscaler (2 to 10 pods on CPU), and an ALB Ingress.
- `.github/workflows/ci.yml` type-checks and tests the server, builds the client and builds the Docker images on every push.

## Project structure

```
server/
  src/
    app.ts            Express app and error handling
    boardService.ts   Business logic, permissions, optimistic locking
    rbac.ts           Roles and permissions
    auth/             JWT signing and middleware
    realtime/         WebSocket server and Redis/local event bus
    store/            Storage interface with MongoDB and in-memory versions
  tests/
client/
  src/
    api/              REST client and reconnecting WebSocket
    boardReducer.ts   Applies live events to local state
    components/
k8s/
docker-compose.yml
```
