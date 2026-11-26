import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { storage } from '../storage';
import type { LiveView } from '../useGame';

/** Simple countdown sounds (composed for Outrank, see assets/sounds). */
const SOURCES = {
  tick: require('../../assets/sounds/tick.wav'),
  tickhi: require('../../assets/sounds/tickhi.wav'),
  buzzer: require('../../assets/sounds/buzzer.wav'),
};
type Name = keyof typeof SOURCES;

const KEY = 'outrank.sound';

/** The phone's sound switch (on by default), remembered between games. */
export function useSoundSetting() {
  const [on, setOn] = useState(true);
  useEffect(() => { storage.get(KEY).then((v) => setOn(v !== 'off')); }, []);
  const toggle = () => setOn((v) => { storage.set(KEY, v ? 'off' : 'on'); return !v; });
  return { on, toggle };
}

let modeSet = false;

/**
 * While someone is answering, the host's phone and the answering player's phone play a soft
 * clock tick each second, a short beep for each of the last 5 seconds, and a gentle tone at
 * zero. Every other phone stays quiet.
 */
export function useCountdownSound(view: LiveView, enabled: boolean) {
  const players = useRef<Partial<Record<Name, AudioPlayer>>>({});
  const lastSec = useRef<number | null>(null);
  const buzzed = useRef<string | null>(null);

  const tm = view.timer;
  const listener = view.role === 'host' || !!view.me?.isMyTurn;
  const active = enabled && listener && view.phase === 'question' && !view.paused && tm?.kind === 'answer' && tm.deadline != null;
  const key = `${view.turnSerial}`;

  const get = (n: Name) => {
    if (!players.current[n]) {
      players.current[n] = createAudioPlayer(SOURCES[n]);
    }
    return players.current[n]!;
  };
  const shot = (n: Name, volume: number) => {
    try { const p = get(n); p.volume = volume; p.seekTo(0); p.play(); } catch {}
  };

  // Tick along with the answer countdown.
  useEffect(() => {
    if (!modeSet) { modeSet = true; setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }
    if (!active) {
      lastSec.current = null;
      return;
    }
    const offset = view.clockOffset ?? 0;
    const deadline = tm!.deadline!;
    const id = setInterval(() => {
      const left = deadline - (Date.now() + offset);
      if (left <= 0) {
        if (buzzed.current !== key) { buzzed.current = key; shot('buzzer', 0.8); }
        return;
      }
      const secs = Math.ceil(left / 1000); // whole seconds left
      if (secs === lastSec.current) return;
      lastSec.current = secs;
      if (secs <= 5) shot('tickhi', 0.6);
      else shot('tick', 0.35);
    }, 80);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, tm?.deadline]);

  // Release the sounds when leaving the game.
  useEffect(() => () => {
    for (const p of Object.values(players.current)) { try { p?.pause(); p?.remove(); } catch {} }
    players.current = {};
  }, []);
}
