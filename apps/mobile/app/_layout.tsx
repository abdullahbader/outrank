import { IBMPlexSansArabic_500Medium, IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic';
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, DirectionRoot, useApp } from '@/app-context';
import { color } from '@/theme';
import { Button, Gap, Loading, Txt } from '@/ui';
import { View } from 'react-native';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold, Sora_700Bold, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold,
    IBMPlexSansArabic_500Medium, IBMPlexSansArabic_700Bold,
  });
  return (
    <SafeAreaProvider style={{ backgroundColor: color.bg }}>
      <StatusBar style="light" />
      <AppProvider>
        {fontsLoaded ? <Root /> : <Loading />}
      </AppProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { ready, online, t, retry } = useApp();
  if (!ready) return <Loading />;
  if (!online) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Txt v="h2" center>{t('common.offline')}</Txt>
        <Gap />
        <Button label={t('common.retry')} icon="refresh-cw" onPress={retry} />
      </View>
    );
  }
  return (
    <DirectionRoot>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: 'fade' }} />
    </DirectionRoot>
  );
}
