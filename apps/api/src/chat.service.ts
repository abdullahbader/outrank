import { Injectable } from '@nestjs/common';
import { GameError } from './auth';
import { PrismaService } from './prisma.service';
import { RealtimeService, type SocketIdentity } from './realtime.service';

/** One-tap reactions everyone sees float across their screen. Not stored. */
export const REACTIONS = ['😂', '🔥', '😱', '👏', '🤯', '😭', '🎯', '🙈'] as const;

export const CHAT_MAX_LENGTH = 200;
const CHAT_PER_10S = 5;
const REACTION_GAP_MS = 700;

export interface ChatMessage {
  id: number;
  role: 'host' | 'player';
  playerId: string | null;
  name: string;
  text: string;
  at: string;
}

/**
 * Game chat and reactions (owner's request after the brief). Only people in the game can read or
 * write; the host can delete any message and mute a player. Messages are plain text, limited in
 * length and rate; deleted ones are kept for the record but never sent to phones again.
 */
@Injectable()
export class ChatService {
  private sent = new Map<string, number[]>();
  private lastReaction = new Map<string, number>();

  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeService) {}

  private async author(id: SocketIdentity) {
    if (id.role === 'host') {
      const d = await this.prisma.device.findUnique({ where: { id: id.deviceId }, select: { displayName: true } });
      return { name: d?.displayName?.trim() || 'Host', muted: false };
    }
    const p = await this.prisma.gameParticipant.findFirst({ where: { gameId: id.gameId, playerId: id.playerId!, removedAt: null } });
    if (!p) throw new GameError('NOT_IN_GAME');
    return { name: p.displayName, muted: !!p.mutedAt };
  }

  async history(gameId: string): Promise<{ messages: ChatMessage[]; muted: string[] }> {
    const rows = await this.prisma.gameMessage.findMany({ where: { gameId, deletedAt: null }, orderBy: { id: 'desc' }, take: 100 });
    const muted = await this.prisma.gameParticipant.findMany({ where: { gameId, removedAt: null, mutedAt: { not: null } }, select: { playerId: true } });
    return { messages: rows.reverse().map(toMessage), muted: muted.map((m) => m.playerId) };
  }

  async send(id: SocketIdentity, raw: unknown): Promise<ChatMessage> {
    const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
    if (!text) throw new GameError('CHAT_EMPTY');
    if (text.length > CHAT_MAX_LENGTH) throw new GameError('CHAT_TOO_LONG');
    const now = Date.now();
    const recent = (this.sent.get(id.deviceId) ?? []).filter((t) => now - t < 10_000);
    if (recent.length >= CHAT_PER_10S) throw new GameError('CHAT_TOO_FAST');
    const a = await this.author(id);
    if (a.muted) throw new GameError('CHAT_MUTED');
    recent.push(now);
    this.sent.set(id.deviceId, recent);
    const row = await this.prisma.gameMessage.create({
      data: { gameId: id.gameId, deviceId: id.deviceId, role: id.role, playerId: id.playerId, name: a.name, text },
    });
    const msg = toMessage(row);
    this.realtime.server?.to(this.realtime.room(id.gameId)).emit('chat:message', msg);
    return msg;
  }

  async remove(id: SocketIdentity, messageId: unknown) {
    if (id.role !== 'host') throw new GameError('NOT_HOST');
    if (typeof messageId !== 'number') throw new GameError('INVALID_INPUT');
    const r = await this.prisma.gameMessage.updateMany({ where: { id: messageId, gameId: id.gameId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!r.count) throw new GameError('UNKNOWN_MESSAGE');
    this.realtime.server?.to(this.realtime.room(id.gameId)).emit('chat:deleted', { id: messageId });
  }

  async mute(id: SocketIdentity, playerId: unknown, muted: unknown) {
    if (id.role !== 'host') throw new GameError('NOT_HOST');
    if (typeof playerId !== 'string' || typeof muted !== 'boolean') throw new GameError('INVALID_INPUT');
    const r = await this.prisma.gameParticipant.updateMany({ where: { gameId: id.gameId, playerId, removedAt: null }, data: { mutedAt: muted ? new Date() : null } });
    if (!r.count) throw new GameError('UNKNOWN_PLAYER');
    this.realtime.server?.to(this.realtime.room(id.gameId)).emit('chat:muted', { playerId, muted });
  }

  async react(id: SocketIdentity, emoji: unknown) {
    if (typeof emoji !== 'string' || !(REACTIONS as readonly string[]).includes(emoji)) throw new GameError('INVALID_INPUT');
    const now = Date.now();
    if (now - (this.lastReaction.get(id.deviceId) ?? 0) < REACTION_GAP_MS) throw new GameError('CHAT_TOO_FAST');
    const a = await this.author(id);
    if (a.muted) throw new GameError('CHAT_MUTED');
    this.lastReaction.set(id.deviceId, now);
    this.realtime.server?.to(this.realtime.room(id.gameId)).emit('reaction', { emoji, role: id.role, playerId: id.playerId, name: a.name, at: now });
  }
}

function toMessage(r: { id: number; role: string; playerId: string | null; name: string; text: string; at: Date }): ChatMessage {
  return { id: r.id, role: r.role === 'host' ? 'host' : 'player', playerId: r.playerId, name: r.name, text: r.text, at: r.at.toISOString() };
}
