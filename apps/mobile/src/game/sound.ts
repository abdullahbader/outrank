import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { storage } from '../storage';
import type { LiveView } from '../useGame';

/** Countdown music (composed for Outrank, see assets/sounds). */
const SOURCES = {
  beat: require('../../assets/sounds/beat.wav'),
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
 * While someone is answering, the host's phone and the answering player's phone play a tense
 * beat with a clock tick each second; in the last 10 seconds the tick gets sharper, comes every
 * half second and the beat gets louder; at zero a buzzer. Every other phone stays quiet.
 */
export function useCountdownSound(view: LiveView, enabled: boolean) {
  const players = useRef<Partial<Record<Name, AudioPlayer>>>({});
  const lastHalf = useRef<number | null>(null);
  const buzzed = useRef<string | null>(null);

  const tm = view.timer;
  const listener = view.role === 'host' || !!view.me?.isMyTurn;
  const active = enabled && listener && view.phase === 'question' && !view.paused && tm?.kind === 'answer' && tm.deadline != null;
  const key = `${view.turnSerial}`;

  const get = (n: Name) => {
    if (!players.current[n]) {
      const p = createAudioPlayer(SOURCES[n]);
      if (n === 'beat') p.loop = true;
      players.current[n] = p;
    }
    return players.current[n]!;
  };
  const shot = (n: Name, volume: number) => {
    try { const p = get(n); p.volume = volume; p.seekTo(0); p.play(); } catch {}
  };

  // Start / stop the beat with the answer countdown.
  useEffect(() => {
    if (!modeSet) { modeSet = true; setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }
    if (!active) {
      try { players.current.beat?.pause(); players.current.beat?.seekTo(0); } catch {}
      lastHalf.current = null;
      return;
    }
    try { const b = get('beat'); b.volume = 0.45; b.play(); } catch {}
    const offset = view.clockOffset ?? 0;
    const deadline = tm!.deadline!;
    const id = setInterval(() => {
      const left = deadline - (Date.now() + offset);
      if (left <= 0) {
        if (buzzed.current !== key) { buzzed.current = key; shot('buzzer', 0.9); }
        try { players.current.beat?.pause(); } catch {}
        return;
      }
      const half = Math.ceil(left / 500); // counts half-seconds left
      if (half === lastHalf.current) return;
      lastHalf.current = half;
      const secs = half / 2;
      if (secs <= 10) {
        shot('tickhi', 0.55 + (10 - secs) * 0.04);
        try { if (players.current.beat) players.current.beat.volume = 0.6 + (10 - secs) * 0.03; } catch {}
      } else if (Number.isInteger(secs)) {
        shot('tick', 0.35);
      }
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
