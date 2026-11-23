import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { basePoints, RANKS } from '@outrank/shared';
import { useApp } from '@/app-context';
import { color, radius, rankColor, space } from '@/theme';
import { Card, FadeIn, Gap, IconPlate, ltr, Row, Screen, SectionTitle, Txt, TopBar } from '@/ui';

/** The rules on one page: scoring, cards, how a question runs, winning. */
export default function Rules() {
  const router = useRouter();
  const { t } = useApp();
  return (
    <Screen>
      <TopBar title={t('rules.title')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Gap h={1} />

      <FadeIn>
        <SectionTitle title={t('rules.scoring')} />
        <Card>
          <Txt v="small" dim>{t('rules.scoringHint')}</Txt>
          <Gap h={3} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {RANKS.map((r) => {
              const pts = basePoints(r);
              const tint = rankColor(r);
              return (
                <View key={r} style={{ width: '22%', flexGrow: 1, alignItems: 'center', paddingVertical: space(2), borderRadius: radius.md, backgroundColor: tint + (r >= 10 ? '30' : '14'), borderWidth: r >= 10 ? 1 : 0, borderColor: tint }}>
                  <Txt v="label" faint>#{r}</Txt>
                  <Txt v="number" color={tint}>{ltr(pts > 0 ? `+${pts}` : `${pts}`)}</Txt>
                </View>
              );
            })}
          </View>
          <Gap h={3} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.md, backgroundColor: color.gold + '22', borderWidth: 1, borderColor: color.gold }}>
            <Txt v="number" color={color.gold}>{ltr('11 + 12 = +20')}</Txt>
            <View style={{ flex: 1 }}><Txt v="small">{t('rules.combo')}</Txt></View>
          </View>
        </Card>
      </FadeIn>

      <Gap h={6} />
      <FadeIn index={1}>
        <SectionTitle title={t('rules.cards')} />
        <Row gap={3} style={{ alignItems: 'stretch' }}>
          {[
            { title: t('cards.wild'), body: t('cards.wildEffect'), tint: color.wild, icon: 'cards-playing', img: 'wild' },
            { title: t('cards.streak'), body: t('cards.streakEffect'), tint: color.streak, icon: 'fire', img: 'streak' },
          ].map((c) => (
            <Card key={c.title} style={{ flex: 1, borderColor: c.tint, backgroundColor: c.tint + '14' }}>
              <IconPlate icon={c.icon} img={c.img} tint={c.tint} size={56} solid />
              <Gap h={3} />
              <Txt v="h2">{c.title}</Txt>
              <Txt v="small" dim>{c.body}</Txt>
              <Gap h={2} />
              <Txt v="label" color={c.tint}>{t('rules.onceEach')}</Txt>
            </Card>
          ))}
        </Row>
      </FadeIn>

      <Gap h={6} />
      <FadeIn index={2}>
        <SectionTitle title={t('rules.flow')} />
        <Card>
          {[1, 2, 3, 4, 5].map((n) => (
            <Row key={n} gap={3} style={{ alignItems: 'flex-start', paddingVertical: space(2) }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Txt v="number" color={color.accentInk} style={{ fontSize: 13, lineHeight: 16 }}>{n}</Txt>
              </View>
              <View style={{ flex: 1 }}><Txt v="small">{t(`rules.flow${n}`)}</Txt></View>
            </Row>
          ))}
        </Card>
      </FadeIn>

      <Gap h={6} />
      <FadeIn index={3}>
        <SectionTitle title={t('rules.end')} />
        <Card glow={color.gold}>
          <Row gap={3} style={{ alignItems: 'flex-start' }}>
            <IconPlate icon="award" img="trophy" tint={color.gold} size={52} />
            <View style={{ flex: 1, gap: space(2) }}>
              <Txt v="small">{t('rules.end1')}</Txt>
              <Txt v="small">{t('rules.end2')}</Txt>
            </View>
          </Row>
        </Card>
      </FadeIn>
    </Screen>
  );
}
