# Timun Mas: Escape the Giant Buto Ijo

A dependency-free, browser-based cooperative folklore adventure. The browser client is plain HTML, CSS, and JavaScript; `server.mjs` serves the game and is authoritative for room membership, movement, AI, item/objective state, captures, rescues, map transitions, and endings.

## Run locally

1. Install Node.js 20 or newer if it is not already available.
2. From this folder, run `node server.mjs`.
3. Open [http://localhost:4173](http://localhost:4173) in a modern browser.
4. Read or skip the opening story, enter a display name and outfit color, then choose **Create Room**.
5. Open a second browser tab or device, visit the same server address, enter the room code, and choose **Join Room**. Both companions must mark ready before the host can start.

No npm packages, account, or external assets are required. The game is designed for desktop keyboards and mobile touch controls.

## Invite companions on the same network

The room server listens on all network interfaces. On the host computer, open the page through `http://localhost:4173`; **Copy invite** uses the host's local network address when available. If needed, share `http://192.168.1.24:4173/?room=ABCDE` manually, replacing the example address and code. Companions need to be on the same Wi-Fi/LAN. Windows Firewall may need to allow Node.js on the private network. A room code only works while that server process is running.

## Public internet hosting

This folder does not include a public host or managed realtime service, so the room code is not reachable from the public internet by itself. See [NETLIFY-PUBLISH.md](NETLIFY-PUBLISH.md) for the prepared Netlify frontend + Render WebSocket server deployment. Netlify builds the static files using `GAME_SERVER_URL`; the browser connects to that secure `wss://` server, and invite links use the public game-page address. The current server stores rooms in memory, has no accounts or persistence, and loses all rooms when it stops or restarts.

The Netlify and Render package has not been publicly deployed from this workspace. Cross-device internet multiplayer still needs a successful test from a second physical device on a separate network after deployment.

## What's playable

- 2–4 human companions with display names, four outfit colors, room codes, ready states, host difficulty selection, invite links, reconnect tokens, and disconnect status.
- Five connected maps, with deterministic room-seeded item placement; Easy, Normal, and Hard tuning; shared NPC/enemy state; Timun Mas follow/flee behavior; Buto Ijo chase/capture; cages, dropped inventory, hold-to-rescue; a two-slot inventory; magical item guide; map objectives/transitions; final trap, victory and defeat screens; and randomized replay.
- A short, skippable story and control tutorial; responsive keyboard and touch controls; no player login.

The environments are readable illustrated playfields with marker-led objectives. They are not collision-heavy maze maps. There is no audio in this prototype. Mobile layout and touch controls are implemented, but should be checked on a real phone before public release.

## Reconnection

The browser saves a room token locally and attempts to restore that player if its connection drops. A disconnected companion remains visible for up to two minutes; the host role moves to another connected companion when needed. The host can continue or restart after a disconnect. Room state lives in server memory, so a server restart ends the room. For a local two-tab test in one browser profile, add `&newCompanion=1` to the second tab's room URL so it creates a second player instead of reconnecting the first browser's saved player.
