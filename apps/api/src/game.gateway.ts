import { Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit,
  SubscribeMessage, WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { GameError, hashToken } from './auth';
import { GamesService } from './games.service';
import { PrismaService } from './prisma.service';
import { RealtimeService, type SocketIdentity } from './realtime.service';
import { actionMessage } from './schemas';

type Ack = (r: unknown) => void;

@WebSocketGateway({ cors: { origin: true }, pingInterval: 10_000, pingTimeout: 8_000 })
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger('Gateway');

  constructor(
    private readonly prisma: PrismaService,
    private readonly games: GamesService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) { this.realtime.server = server; }

  async handleConnection(socket: Socket) {
    const id = await this.deviceOf(socket);
    if (!id) { socket.emit('error', { error: 'UNKNOWN_DEVICE' }); socket.disconnect(true); }
  }

  /** Resolve the device once per socket. Messages can arrive before handleConnection finishes. */
  private deviceOf(socket: Socket): Promise<string | null> {
    if (!socket.data.devicePromise) {
      const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
      socket.data.devicePromise = (async () => {
        if (!token) return null;
        const d = await this.prisma.device.findUnique({ where: { tokenHash: hashToken(token) } });
        return d?.id ?? null;
      })();
    }
    return socket.data.devicePromise;
  }

  async handleDisconnect(socket: Socket) {
    const ident = socket.data.ident as SocketIdentity | undefined;
    if (!ident) return;
    // Let the room settle, then tell everyone who is online now.
    setTimeout(async () => {
      const p = await this.realtime.presence(ident.gameId);
      if (ident.role === 'host' && !p.hostOnline) await this.games.onHostPresence(ident.gameId, false);
      await this.games.broadcast(ident.gameId, [{ type: 'presence' }]);
    }, 50);
  }

  /** Join the game's live channel and get a fresh snapshot (also used after every reconnect). */
  @SubscribeMessage('game:subscribe')
  async subscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: { gameId?: string }) {
    try {
      const deviceId = await this.deviceOf(socket);
      if (!deviceId) return { ok: false, error: 'UNKNOWN_DEVICE' };
      if (typeof body?.gameId !== 'string') return { ok: false, error: 'INVALID_INPUT' };
      const { viewer } = await this.games.actorFor(body.gameId, deviceId);
      const prev = socket.data.ident as SocketIdentity | undefined;
      if (prev && prev.gameId !== body.gameId) await socket.leave(this.realtime.room(prev.gameId));
      socket.data.ident = {
        deviceId,
        gameId: body.gameId,
        role: viewer.role,
        playerId: viewer.role === 'player' ? viewer.playerId : null,
      } satisfies SocketIdentity;
      await socket.join(this.realtime.room(body.gameId));
      if (viewer.role === 'host') await this.games.onHostPresence(body.gameId, true);
      await this.games.broadcast(body.gameId, [{ type: 'presence' }]);
      const view = await this.games.view(body.gameId, viewer);
      return { ok: true, version: view.version, view };
    } catch (e) {
      return { ok: false, error: errorCode(e) };
    }
  }

  @SubscribeMessage('game:action')
  async action(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    try {
      const deviceId = await this.deviceOf(socket);
      if (!deviceId) return { ok: false, error: 'UNKNOWN_DEVICE' };
      const msg = actionMessage.safeParse(body);
      if (!msg.success) return { ok: false, error: 'INVALID_INPUT' };
      const { gameId, clientActionId, action } = msg.data;
      const { actor } = await this.games.actorFor(gameId, deviceId);
      return await this.games.runAction(gameId, actor, action as never, `${deviceId}:${clientActionId}`);
    } catch (e) {
      this.log.debug(`action failed: ${String(e)}`);
      return { ok: false, error: errorCode(e) };
    }
  }
}

function errorCode(e: unknown): string {
  if (e instanceof GameError) return ((e.getResponse() as { error?: string }).error) ?? 'ERROR';
  return 'SERVER_ERROR';
}
