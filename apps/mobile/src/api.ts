import { API_URL } from './config';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

let token: string | null = null;
export const setApiToken = (t: string | null) => { token = t; };
export const getApiToken = () => token;

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Device ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('OFFLINE', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (json as { error?: string; message?: { error?: string } }).error ?? (json as { message?: { error?: string } }).message?.error ?? 'ERROR';
    throw new ApiError(typeof code === 'string' ? code : 'ERROR', res.status);
  }
  return json as T;
}

export interface Category { id: string; name: { en: string; ar: string }; icon: string; ready: number }
export interface Stats {
  gamesPlayed: number; gamesWon: number; winRate: number; highestScore: number; averageScore: number;
  recent: { gameId: string; at: string; score: number; rank: number; won: boolean }[];
}
export interface ActiveGame { gameId: string; code: string; status: string; role: 'host' | 'player' }
