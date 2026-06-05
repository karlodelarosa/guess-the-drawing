# Guess the Drawing

A multiplayer drawing and guessing game similar to Scribble.io. Draw words, guess what others are drawing, and compete for the highest score!

## Tech Stack

- **Node.js** + **Express** — HTTP server
- **Socket.IO** — Real-time communication
- **Vanilla JavaScript** — Client-side logic
- **HTML + CSS** — UI (no frameworks)
- In-memory game state (no database)

## Features

- Create/join rooms with shareable URLs
- Up to 10 players per room
- Turn-based drawing with randomized player order
- Real-time canvas sync with brush sizes, undo, and clear
- 6 word categories: Animals, Objects, Food, Bible, Church, Music
- Auto-checked guesses with time-based scoring
- Round timer with automatic progression
- Spectator mode for late joiners
- Typing indicators, toast notifications, sound effects
- Reconnect handling
- Responsive mobile layout

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Cloudflare account](https://dash.cloudflare.com/) (for deployment)

### Install & Run Locally

```bash
# Install dependencies
npm install

# Option A: Node.js server
npm start

# Option B: Cloudflare Worker (local simulation)
npm run dev:worker
```

Open [http://localhost:3000](http://localhost:3000) (Node) or [http://localhost:8787](http://localhost:8787) (Wrangler).

### Deploy to Cloudflare

```bash
# Log in to Cloudflare (first time only)
npx wrangler login

# Deploy Worker + static assets
npm run deploy
```

Your game will be live at `https://guess-the-drawing.<your-subdomain>.workers.dev`.

### How to Play

1. **Enter your name** on the lobby screen.
2. **Create a room** or **join** with a room code.
3. **Share the invite link** with friends (copy button in waiting room).
4. **Host starts the game** when at least 2 players have joined.
5. Each player takes a turn **drawing** a random word while others **guess** in chat.
6. Faster guesses earn more points. The drawer earns points for each correct guess.
7. After everyone has drawn, **final rankings** are shown. Host can **Play Again**.

### Room URLs

Share a room link in either format:

- `http://localhost:3000?room=ABC123`
- `http://localhost:3000/room/ABC123`

## Project Structure

```
guess-the-drawing/
├── server/
│   ├── index.js              # Express + Socket.IO entry point
│   ├── constants.js          # Game configuration
│   ├── wordList.js           # Word categories and random selection
│   └── game/
│       ├── Player.js         # Player model
│       ├── Game.js           # Round/turn/scoring logic
│       ├── Room.js           # Room state and chat/drawing
│       └── RoomManager.js    # Room lifecycle and socket routing
├── public/
│   ├── index.html            # Single-page app shell
│   ├── css/styles.css        # All styles (responsive)
│   └── js/
│       ├── app.js            # Main client entry
│       ├── socket.js         # Socket.IO wrapper
│       ├── drawing/canvas.js # Canvas rendering and tools
│       ├── ui/               # Chat, toast, player list
│       ├── screens/          # Lobby, waiting, game, results
│       └── utils/            # Sounds, session storage
├── package.json
└── README.md
```

## Configuration

Edit `server/constants.js` to adjust:

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_PLAYERS` | 10 | Max players per room |
| `ROUND_DURATION_MS` | 80000 | Round timer (80 seconds) |
| `MIN_PLAYERS_TO_START` | 2 | Minimum players to start |
| `GUESSER_POINTS` | 100/75/50/25 | Points by time remaining |
| `DRAWER_POINTS_PER_GUESS` | 50 | Points per correct guess for drawer |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |

```bash
PORT=8080 npm start
```

## License

MIT
