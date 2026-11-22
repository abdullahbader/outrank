import { Image, type ImageStyle, type StyleProp } from 'react-native';

/** Full-colour 3D icons (Microsoft Fluent Emoji, MIT — see assets/icons3d/LICENSE.md). */
const IMAGES = {
  geography: require('../assets/icons3d/geography.png'),
  history: require('../assets/icons3d/history.png'),
  sports: require('../assets/icons3d/sports.png'),
  science: require('../assets/icons3d/science.png'),
  technology: require('../assets/icons3d/technology.png'),
  entertainment: require('../assets/icons3d/entertainment.png'),
  food: require('../assets/icons3d/food.png'),
  business: require('../assets/icons3d/business.png'),
  nature: require('../assets/icons3d/nature.png'),
  general: require('../assets/icons3d/general.png'),
  wild: require('../assets/icons3d/wild.png'),
  streak: require('../assets/icons3d/streak.png'),
  trophy: require('../assets/icons3d/trophy.png'),
  stopwatch: require('../assets/icons3d/stopwatch.png'),
  microphone: require('../assets/icons3d/microphone.png'),
  party: require('../assets/icons3d/party.png'),
  sparkles: require('../assets/icons3d/sparkles.png'),
  boy: require('../assets/icons3d/boy.png'),
  runner: require('../assets/icons3d/runner.png'),
  nerd: require('../assets/icons3d/nerd.png'),
  gamepad: require('../assets/icons3d/gamepad.png'),
} as const;

export type Icon3DName = keyof typeof IMAGES;
export const has3D = (name: string): name is Icon3DName => name in IMAGES;

export function Icon3D({ name, size = 40, style }: { name: Icon3DName; size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={IMAGES[name]} style={[{ width: size, height: size }, style]} resizeMode="contain" accessibilityIgnoresInvertColors />;
}
