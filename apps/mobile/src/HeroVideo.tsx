import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gradient, useReducedMotion } from './ui';
import { radius } from './theme';

const SOURCE = require('../assets/video/hero.mp4');

/**
 * The Home hero's moving background: the owner's video, muted and looping, under a green wash so
 * the white text stays readable. It pauses when Home is not on screen (battery) and stays still
 * when the phone asks for less motion.
 */
export function HeroVideo({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const player = useVideoPlayer(SOURCE, (p) => {
    p.loop = true;
    p.muted = true;
    if (!reduced) p.play(); // start straight away; focus changes pause/resume it below
  });

  useFocusEffect(useCallback(() => {
    if (!reduced) player.play();
    return () => player.pause();
  }, [player, reduced]));

  return (
    <View style={[{ borderRadius: radius.xl, overflow: 'hidden' }, style]}>
      {/* textureView: on Android the default surface can be drawn behind the rounded card and vanish */}
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} surfaceType="textureView" />
      {/* brand wash: green to blue, see-through so the video shows */}
      <Gradient from="#2F7A55C4" to="#5E9DB38C" radius={0} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}
