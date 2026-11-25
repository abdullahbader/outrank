import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { catStyle } from './theme';

/** One real photo per category (Unsplash licence — credits in assets/photos/CREDITS.md). */
const PHOTOS: Record<string, number> = {
  geography: require('../assets/photos/geography.jpg'),
  history: require('../assets/photos/history.jpg'),
  sports: require('../assets/photos/sports.jpg'),
  science: require('../assets/photos/science.jpg'),
  technology: require('../assets/photos/technology.jpg'),
  entertainment: require('../assets/photos/entertainment.jpg'),
  food: require('../assets/photos/food.jpg'),
  business: require('../assets/photos/business.jpg'),
  nature: require('../assets/photos/nature.jpg'),
  general: require('../assets/photos/general.jpg'),
};

export const hasPhoto = (category: string) => category in PHOTOS;

/**
 * A category's photo as a background, with a dark wash so white text on top stays readable.
 * `shade` 0–1 sets how dark the wash is; `faded` shows the photo softly behind light content instead.
 */
export function CategoryPhoto({ category, children, style, radius = 0, shade = 0.55, faded }: {
  category: string; children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; shade?: number; faded?: boolean;
}) {
  const src = PHOTOS[category];
  // No photo yet (newer categories): the category's own colour, so white text on top stays readable.
  if (!src) return <View style={[{ overflow: 'hidden', borderRadius: radius, backgroundColor: faded ? catStyle(category).tint + '22' : catStyle(category).tint }, style]}>{children}</View>;
  return (
    <ImageBackground source={src} resizeMode="cover" style={[{ overflow: 'hidden', borderRadius: radius }, style]} imageStyle={{ borderRadius: radius, opacity: faded ? 0.28 : 1 }}>
      {!faded ? <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(25, 45, 35, ${shade})` }]} /> : null}
      {children}
    </ImageBackground>
  );
}
