import { Icon as Feather } from '@/icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/app-context';
import { color, shadow } from '@/theme';
import { Txt, type IconName } from '@/ui';

const ICONS: Record<string, IconName> = { index: 'home', rules: 'book-open', stats: 'bar-chart-2', profile: 'user' };

/**
 * Floating bottom bar with a raised centre "Join" button: joining a game (what most people do) is
 * one tap from anywhere. Home · How to play · [Join] · Stats · Profile. Hosting starts from Home.
 */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigateToTab?: (routeKey: string) => void; // navigation 8
  navigation?: { navigate: (name: string) => void }; // older navigation
}

function FloatingTabBar({ state, descriptors, navigateToTab, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', start: 0, end: 0, bottom: Math.max(insets.bottom, 10), alignItems: 'center' }}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: color.bgRaised, borderRadius: 34, height: 70, paddingHorizontal: 6, width: '92%', maxWidth: 520, borderWidth: 1, borderColor: color.line }, shadow.soft]}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const title = String(descriptors[route.key].options.title ?? '');
          if (route.name === 'play') {
            return (
              <View key={route.key} style={{ flex: 1, alignItems: 'center' }}>
                <Pressable
                  accessibilityRole="button" accessibilityLabel={title} onPress={() => router.push('/join')}
                  style={({ pressed }) => [{
                    width: 64, height: 64, borderRadius: 32, marginTop: -34, backgroundColor: color.accent,
                    alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: color.bg,
                  }, shadow.glow(color.accent), pressed && { transform: [{ scale: 0.94 }] }]}
                >
                  <Feather name="log-in" size={26} color={color.accentInk} />
                </Pressable>
                <Txt v="small" color={color.accent} style={{ fontSize: 11, lineHeight: 15, marginTop: 2 }}>{title}</Txt>
              </View>
            );
          }
          const onPress = () => {
            if (focused) return;
            if (navigateToTab) navigateToTab(route.key);
            else navigation?.navigate(route.name);
          };
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={title} accessibilityState={{ selected: focused }} onPress={onPress}
              style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999, backgroundColor: focused ? color.accent + '22' : 'transparent' }}>
                <Feather name={ICONS[route.name] ?? 'circle'} size={21} color={focused ? color.accent : color.textFaint} />
              </View>
              <Txt v="small" color={focused ? color.accent : color.textFaint} style={{ fontSize: 11, lineHeight: 15 }} numberOfLines={1}>{title}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useApp();
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...(props as unknown as TabBarProps)} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg } }}>
      <Tabs.Screen name="index" options={{ title: t('nav.home') }} />
      <Tabs.Screen name="rules" options={{ title: t('nav.rules') }} />
      <Tabs.Screen name="play" options={{ title: t('nav.play') }} />
      <Tabs.Screen name="stats" options={{ title: t('nav.stats') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile') }} />
    </Tabs>
  );
}
