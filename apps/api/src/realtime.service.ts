import { Injectable } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

export interface SocketIdentity { deviceId: string; gameId: string; role: 'host' | 'player'; playerId: string | null }

/** Who is connected to which game. In memory: it describes live sockets, not game state. */
@Injectable()
export class RealtimeService {
  server: Server | null = null;
  private hostTimers = new Map<string, NodeJS.Timeout>();

  room(gameId: string) { return `game:${gameId}`; }

  async socketsIn(gameId: string): Promise<{ socket: Socket; id: SocketIdentity }[]> {
    if (!this.server) return [];
    const sockets = await this.server.in(this.room(gameId)).fetchSockets();
    return sockets
      .map((s) => ({ socket: s as unknown as Socket, id: (s.data as { ident?: SocketIdentity }).ident }))
      .filter((x): x is { socket: Socket; id: SocketIdentity } => !!x.id && x.id.gameId === gameId);
  }

  async presence(gameId: string) {
    const list = await this.socketsIn(gameId);
    const online: Record<string, boolean> = {};
    let hostOnline = false;
    for (const { id } of list) {
      if (id.role === 'host') hostOnline = true;
      else if (id.playerId) online[id.playerId] = true;
    }
    return { hostOnline, online };
  }

  setHostTimer(gameId: string, ms: number, fn: () => void) {
    this.clearHostTimer(gameId);
    this.hostTimers.set(gameId, setTimeout(() => { this.hostTimers.delete(gameId); fn(); }, ms));
  }

  clearHostTimer(gameId: string) {
    const t = this.hostTimers.get(gameId);
    if (t) clearTimeout(t);
    this.hostTimers.delete(gameId);
  }
}
