import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from './ui';
import { radius } from './theme';

const SOURCE = require('../assets/video/hero.mp4');

/**
 * The Home hero's moving background: the owner's video, muted and looping, under a see-through
 * green wash so the white text stays readable. It pauses when Home is not on screen (battery),
 * picks up again if anything else pauses it while Home is showing, and stays still when the phone
 * asks for less motion.
 */
export function HeroVideo({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const focused = useRef(false);
  const player = useVideoPlayer(SOURCE, (p) => {
    p.loop = true;
    p.muted = true;
  });

  // Keep it playing while Home is on screen (Android may pause it when the view is re-attached).
  useEffect(() => {
    const sub = player.addListener('playingChange', (e: { isPlaying: boolean }) => {
      if (!e.isPlaying && focused.current && !reduced) setTimeout(() => { try { if (focused.current) player.play(); } catch {} }, 300);
    });
    return () => sub.remove();
  }, [player, reduced]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (!reduced) player.play();
    return () => { focused.current = false; player.pause(); };
  }, [player, reduced]));

  return (
    <View style={[{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#2F7A55' }, style]}>
      {/* textureView: on Android the default surface can be drawn behind the rounded card and vanish */}
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} surfaceType="textureView" />
      {/* see-through brand wash (plain rgba: reliable on Android, unlike 8-digit hex inside SVG) */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(47, 122, 85, 0.55)' }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: '50%', backgroundColor: 'rgba(94, 157, 179, 0.25)' }]} />
      {children}
    </View>
  );
}
