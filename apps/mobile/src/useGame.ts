import type { GameEvent, GameView } from '@outrank/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { getApiToken } from './api';
import { API_URL } from './config';

/** What the server sends: the engine view for this phone, plus who is online. */
export type LiveView = GameView & { gameId: string; code: string; version: number; hostOnline: boolean; online: Record<string, boolean> };

export type ActionInput = Record<string, unknown> & { type: string };
export type ActResult = { ok: true; version: number } | { ok: false; error: string };

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Live connection to one game. The server is the source of truth: the phone shows the newest
 * version it has received and never computes scores. On every (re)connect it asks for a fresh
 * snapshot, so a phone that missed events — or was in the background — catches up in one step.
 */
export function useGame(gameId: string | undefined) {
  const [view, setView] = useState<LiveView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvents, setLastEvents] = useState<{ id: number; events: GameEvent[] }>({ id: 0, events: [] });
  const socketRef = useRef<Socket | null>(null);
  const versionRef = useRef(0);

  const accept = useCallback((v: LiveView, events: GameEvent[] = []) => {
    if (v.version < versionRef.current) return; // older than what we show: ignore
    versionRef.current = v.version;
    setView(v);
    if (events.length) setLastEvents((old) => ({ id: old.id + 1, events }));
  }, []);

  useEffect(() => {
    if (!gameId) return;
    const socket = io(API_URL, { auth: { token: getApiToken() }, transports: ['websocket'], reconnectionDelay: 500, reconnectionDelayMax: 4000 });
    socketRef.current = socket;
    const subscribe = () => {
      socket.timeout(8000).emit('game:subscribe', { gameId }, (err: unknown, res: { ok: boolean; view?: LiveView; error?: string }) => {
        if (err) return;
        if (res?.ok && res.view) { setError(null); accept(res.view); } else setError(res?.error ?? 'ERROR');
      });
    };
    socket.on('connect', () => { setConnected(true); subscribe(); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('game:state', (m: { view: LiveView; events: GameEvent[] }) => accept(m.view, m.events));
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active' && socket.connected) subscribe(); });
    return () => { sub.remove(); socket.disconnect(); socketRef.current = null; };
  }, [gameId, accept]);

  const act = useCallback((action: ActionInput): Promise<ActResult> => {
    const socket = socketRef.current;
    if (!socket || !socket.connected || !gameId) return Promise.resolve({ ok: false, error: 'OFFLINE' });
    return new Promise((resolve) => {
      socket.timeout(8000).emit('game:action', { gameId, clientActionId: newId(), action }, (err: unknown, res: ActResult) => {
        resolve(err ? { ok: false, error: 'OFFLINE' } : res);
      });
    });
  }, [gameId]);

  return { view, connected, error, act, lastEvents };
}
