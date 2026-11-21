import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API address. EXPO_PUBLIC_API_URL wins when set. Otherwise:
 * - web: the same computer that serves the page, port 3300;
 * - phone in Expo Go: the computer Expo is running on (its LAN IP), port 3300.
 */
function apiUrl(): string {
  const set = process.env.EXPO_PUBLIC_API_URL;
  if (set) return set.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:3300`;
  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const host = hostUri.split(':')[0];
  return `http://${host || '127.0.0.1'}:3300`;
}

export const API_URL = apiUrl();

/** Link a QR code points to. Opening it in the app (or scanning it) fills in the code. */
export const joinLink = (code: string) => `outrank://join?code=${code}`;

export function codeFromScan(data: string): string | null {
  const m = /[?&]code=([A-Za-z0-9]{6})/.exec(data) ?? /^([A-Za-z0-9]{6})$/.exec(data.trim());
  return m ? m[1].toUpperCase() : null;
}
