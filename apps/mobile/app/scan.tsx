import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useApp } from '@/app-context';
import { codeFromScan } from '@/config';
import { color, radius } from '@/theme';
import { Banner, Button, Gap, Screen, TopBar, Txt } from '@/ui';

export default function Scan() {
  const { t } = useApp();
  const router = useRouter();
  const [permission, request] = useCameraPermissions();
  const [bad, setBad] = useState(false);
  const done = useRef(false);

  return (
    <Screen scroll={false}>
      <TopBar title={t('scan.title')} onBack={() => router.back()} />
      {!permission?.granted ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Txt center dim>{t('scan.permission')}</Txt>
          <Gap />
          <Button label={t('scan.allow')} icon="camera" onPress={request} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ aspectRatio: 1, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 2, borderColor: color.accent }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (done.current) return;
                const code = codeFromScan(data);
                if (!code) { setBad(true); return; }
                done.current = true;
                router.replace({ pathname: '/join', params: { code } });
              }}
            />
          </View>
          <Gap />
          {bad ? <Banner tone="warn" text={t('scan.notGame')} /> : null}
        </View>
      )}
    </Screen>
  );
}
