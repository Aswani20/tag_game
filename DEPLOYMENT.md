# Deploy Tag

## Render

1. Commit the workspace source, root lockfile, Dockerfile and `render.yaml` to a Git repository accessible to your Render account.
2. In Render, create a **Blueprint** from that repository and select the branch containing `render.yaml`. Review the web service and plan, then deploy it.
3. Keep **one running instance**. A single Node process owns the rooms. Its HTTP server serves the built game, Socket.IO polling, WebSocket upgrades and `/health` on Render's assigned port.
4. Open the service's public HTTPS URL. Visit `/health` and check for `"status":"ok"`. Create a room at the public URL, then use **Copy link**. A friend can open that link on another network and enter a nickname.
5. For a post-deploy check, ready both players and start a match. Confirm that both see the tag and timer, reload one browser tab, then finish the round and play again.

The included [Render Blueprint](render.yaml) configures Docker and the health endpoint. Render documents its [Blueprint setup](https://render.com/docs/blueprint-spec) and [WebSocket support](https://render.com/docs/websocket).

## Docker or another Node host

From the repository root:

```sh
docker build -t tag-game .
docker run --rm --name tag-game -p 3001:3001 tag-game
```

The container listens on port 3001 by default. On a public host, route a domain with HTTPS to this service.
Forward HTTP requests and WebSocket upgrades at `/socket.io/` to the same instance. Preserve the public
Host header or add the exact frontend origin to `CLIENT_ORIGIN`. Allow at least 75 seconds of proxy idle
time for Socket.IO heartbeats. Share invitations from the public domain.

For native Node hosting, use Node 22.12+ and npm. Build with `npm ci --include=dev && npm run build`,
then launch with `npm start`. The build produces compiled server and shared packages plus the static
client, with Brotli and gzip copies of its JS, CSS and SVG assets.

## Environment

For native production runs, copy [.env.example](.env.example) to `.env` at the repository root if
you want to override defaults. `npm start` reads that file. For Docker or Render, set variables
in the container environment or Render dashboard.

| Variable | When to set it |
| --- | --- |
| `PORT` | Backend listening port. Defaults to 3001. Accept the platform-assigned port on Render. |
| `HOST` | Bind address. Defaults to `0.0.0.0`. Use `127.0.0.1` for a loopback-only preview. |
| `CLIENT_ORIGIN` | Comma-separated exact frontend origins allowed to reach the backend, e.g. `https://play.example.com`. Include scheme and optional port, without path or trailing slash. Same-origin deployment can leave this empty. |
| `PUBLIC_SERVER_URL` | Public backend origin supplied to the browser at runtime when Node serves the frontend. Same-origin deployment can leave this empty. |
| `VITE_SERVER_URL` | Optional frontend build-time backend origin. The Docker build accepts `--build-arg VITE_SERVER_URL=https://api.example.com`. |

The client resolves its backend in this order: runtime `window.TAG_CONFIG.serverUrl`, build-time
`VITE_SERVER_URL`, then the frontend's own origin. A single service needs no URL overrides.

For separate static hosting, upload **apps/client/dist** after the build. Set `serverUrl` in the
deployed `tag-config.js` to the public HTTPS backend origin or supply `VITE_SERVER_URL` before building.
Set the backend's `CLIENT_ORIGIN` to the public frontend origin. Invitations use the frontend's
current public address. Cache the fingerprinted bundles long-term and revalidate `index.html` and
`tag-config.js` when deploying.

## Operating limits

Rooms are in memory. A deploy, restart, or sleeping host ends active rooms. A client disconnect
reserves its seat for 30 seconds while the same server process continues running. Use an always-on
single instance for uninterrupted matches. Playing requires a keyboard.
