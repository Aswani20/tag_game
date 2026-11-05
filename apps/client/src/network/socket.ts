import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@tag/shared';
export function createSocket(): Socket<ServerToClientEvents,ClientToServerEvents> {
  // Same-origin by default: works through HTTPS/WSS proxies and the production Node server.
  const runtime = (window as Window & { TAG_CONFIG?: { serverUrl?: string } }).TAG_CONFIG;
  const origin = runtime?.serverUrl || import.meta.env.VITE_SERVER_URL || window.location.origin;
  return io(origin,{autoConnect:false,reconnection:true,reconnectionDelay:500,reconnectionDelayMax:3000});
}
