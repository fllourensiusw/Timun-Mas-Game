# Publish the game for internet play

## What is ready

The game is prepared as a Netlify static website plus a separate persistent Node.js room server. Netlify serves the browser files; the Node service owns room state and WebSocket multiplayer. Netlify alone cannot run this project's authoritative long-lived game server.

This package has **not** been published to a public URL, and play from two physical devices over the public internet has **not** been verified. A local two-client WebSocket test was previously used for room/start, shared pickup/use, defeat, and shared restart. That is not evidence of cross-device or public-network operation.

ChatGPT Sites is a real product, but the Sites publishing controls are not available in this task session, so no Sites deployment was made. Use the included deployment files below.

## A. Deploy the room server on Render

1. Unzip the complete `timun-mas-game` folder.
2. Put the folder contents in a GitHub repository. Keep `render.yaml` and `server.mjs` in the repository's top-level folder.
3. In Render, choose **New → Blueprint**, connect that repository, and apply the included `render.yaml`.
4. Wait for the service to finish deploying. Open its `https://...onrender.com` address once and confirm it responds.
5. Copy the service hostname. The WebSocket address is the same hostname with `wss://`, for example `wss://timun-mas-game-server.onrender.com`.

Render's free web services may sleep after inactivity. The first visit or WebSocket connection can take time to wake the server. Rooms are held in memory and are lost if the server restarts or redeploys. This prototype is intended for small playtests, not high-availability production.

## B. Deploy the game page on Netlify

1. In Netlify, choose **Add new project → Import an existing project**, then connect the same GitHub repository.
2. Leave the base directory at the repository root. The included `netlify.toml` sets the build command and publish folder.
3. Before the first successful build, add an environment variable named `GAME_SERVER_URL` with the server address from step A, e.g. `wss://timun-mas-game-server.onrender.com`.
4. Deploy. Netlify's production URL is the shareable game-page address. Invite links copied in the lobby use this page URL, while gameplay connects to the Render WebSocket service.

If the game server is redeployed to a different hostname, update `GAME_SERVER_URL` in Netlify and redeploy the site.

## Optional local Netlify folder

With Node.js installed, double-click `build-netlify.cmd` and enter the Render `wss://` address when prompted. Or open Command Prompt in this project folder and run:

```cmd
set GAME_SERVER_URL=wss://YOUR-RENDER-SERVICE.onrender.com && node build-netlify.mjs
```

The generated `dist` folder contains the static files to upload with Netlify Drop. Replace the example hostname first. This is useful for a manual static deploy; Git-based deploys are easier to update.

## C. Verify from different devices

Do this only after both services report a successful deployment:

1. On a computer, open the Netlify URL, create a room, and copy the invite link/code.
2. On a phone or a second computer, open that public invite link. For the strongest check, use a different network (for example, phone cellular data rather than the host's Wi-Fi).
3. Join with another name, mark both companions ready, and start the adventure.
4. Move both companions and confirm each screen shows the other's movement. Pick up an item on one device and confirm it disappears/updates on the other. Then try an item interaction, capture, and rescue.
5. If the server was sleeping, wait for it to wake and reload the page once. Do not announce the game as internet-ready unless this test succeeds.

The current code reconnects after an interrupted game connection, but it does not persist rooms across a server restart. The room server is single-instance/in-memory; do not scale it to multiple instances without adding shared authoritative state.

## What the deployment still needs

- A GitHub account/repository and Netlify and Render accounts to publish.
- A successful deployment on both providers.
- A real second device/network test before sharing the URL as a verified online multiplayer game.
- For a public production launch: persistent/shared room state, uptime monitoring, stronger rate/abuse controls, and more reconnect/connection-loss playtesting.
