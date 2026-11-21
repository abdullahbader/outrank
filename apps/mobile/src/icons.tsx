import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

/**
 * One icon component for the whole app. Screens keep using short names ("home", "zap", "globe");
 * this maps them to fuller, recognisable icons from Material Community Icons (bundled with Expo,
 * no extra package). Any Material Community name also works directly ("soccer", "flask", "fire").
 */
const MAP: Record<string, string> = {
  // navigation & actions
  home: 'home-variant', 'book-open': 'book-open-page-variant', 'bar-chart-2': 'chart-bar', user: 'account-circle',
  users: 'account-group', 'user-check': 'account-check', 'user-x': 'account-remove', zap: 'lightning-bolt',
  'log-in': 'login-variant', 'log-out': 'logout-variant', maximize: 'qrcode-scan', camera: 'camera',
  'arrow-left': 'arrow-left', 'arrow-right': 'arrow-right', 'arrow-right-circle': 'arrow-right-circle',
  'chevron-left': 'chevron-left', 'chevron-right': 'chevron-right', 'chevron-up': 'chevron-up',
  check: 'check-bold', 'check-circle': 'check-circle', x: 'close-thick', copy: 'content-copy',
  'fast-forward': 'fast-forward', 'skip-forward': 'skip-next', flag: 'flag-checkered', key: 'key-variant',
  lock: 'lock', mail: 'email', 'message-circle': 'chat', mic: 'microphone', 'mic-off': 'microphone-off',
  'more-horizontal': 'dots-horizontal', 'more-vertical': 'dots-vertical', pause: 'pause', play: 'play',
  'pause-circle': 'pause-circle', 'play-circle': 'play-circle', 'refresh-cw': 'refresh', 'rotate-ccw': 'undo-variant',
  send: 'send', 'share-2': 'share-variant', 'trash-2': 'trash-can', 'wifi-off': 'wifi-off', info: 'information',
  'alert-triangle': 'alert', save: 'content-save', circle: 'circle-outline', star: 'star', globe: 'earth',
  // game ideas
  repeat: 'fire', award: 'trophy', 'trending-up': 'trending-up', grid: 'view-grid', percent: 'percent',
  activity: 'chart-line', hash: 'pound', list: 'format-list-numbered', layers: 'cards-playing',
  // older category names
  aperture: 'flask', cpu: 'laptop', film: 'movie-open', coffee: 'food-apple', feather: 'leaf',
};

export function Icon({ name, size = 20, color, style }: { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const mapped = MAP[name] ?? (name in MaterialCommunityIcons.glyphMap ? name : null);
  if (mapped) return <MaterialCommunityIcons name={mapped as never} size={size} color={color} style={style} />;
  return <Feather name={name as never} size={size} color={color} style={style} />;
}
