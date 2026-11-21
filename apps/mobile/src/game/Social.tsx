import { Icon as Feather } from '../icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DirectionRoot, useApp } from '../app-context';
import { avatarColor, color, radius, space } from '../theme';
import { Avatar, IconButton, Row, Txt, useReducedMotion } from '../ui';
import { REACTIONS, type ChatMessage, type LiveView, type Reaction } from '../useGame';

type Res = Promise<{ ok: boolean; error?: string }>;
export interface ChatApi {
  messages: ChatMessage[];
  muted: string[];
  reactions: Reaction[];
  send: (text: string) => Res;
  remove: (id: number) => Res;
  mute: (playerId: string, on: boolean) => Res;
  react: (emoji: string) => Res;
}

const MAX = 200;
const native = Platform.OS !== 'web';

/**
 * Talk and react during the game: a chat everyone in the game sees (host included), one-tap
 * reactions that float across every screen, and host moderation (delete a message, mute a player).
 */
export function Social({ view, chat, onError, lift = 0 }: { view: LiveView; chat: ChatApi; onError: (code: string) => void; lift?: number }) {
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [seen, setSeen] = useState(chat.messages.length ? chat.messages[chat.messages.length - 1].id : 0);
  const myId = view.me?.playerId ?? null;
  const mine = (m: ChatMessage) => (view.role === 'host' ? m.role === 'host' : m.playerId === myId);
  const unread = chat.messages.filter((m) => m.id > seen && !mine(m)).length;
  const last = chat.messages[chat.messages.length - 1];

  useEffect(() => { if (open && last) setSeen(last.id); }, [open, last]);

  // A short preview of a new message while the chat is closed.
  const [preview, setPreview] = useState<ChatMessage | null>(null);
  useEffect(() => {
    if (!last || open || mine(last) || last.id <= seen) return;
    setPreview(last);
    const id = setTimeout(() => setPreview(null), 3500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id]);

  const react = async (e: string) => {
    const r = await chat.react(e);
    if (!r.ok && r.error && r.error !== 'CHAT_TOO_FAST') onError(r.error);
  };

  const bottom = insets.bottom + 96 + lift;
  const amMuted = !!myId && chat.muted.includes(myId);

  return (
    <>
      <FloatingReactions reactions={chat.reactions} />
      <View pointerEvents="box-none" style={[styles.dock, { bottom }]}>
        {preview ? (
          <Pressable onPress={() => { setPreview(null); setOpen(true); }} style={styles.preview} accessibilityRole="button">
            <Txt v="small" color={preview.role === 'host' ? color.gold : color.streak} numberOfLines={1}>{preview.name}</Txt>
            <Txt v="small" auto numberOfLines={2}>{preview.text}</Txt>
          </Pressable>
        ) : null}
        {picker ? (
          <View style={styles.picker}>
            {REACTIONS.map((e) => (
              <Pressable key={e} onPress={() => react(e)} accessibilityRole="button" accessibilityLabel={e} hitSlop={4} style={({ pressed }) => [styles.emojiBtn, { transform: [{ scale: pressed ? 1.25 : 1 }] }]}>
                <Text style={styles.emoji}>{e}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Row gap={2}>
          <Pressable onPress={() => setPicker((p) => !p)} accessibilityRole="button" accessibilityLabel={t('chat.react')} disabled={amMuted}
            style={[styles.fab, { backgroundColor: picker ? color.wild : color.surface2, opacity: amMuted ? 0.4 : 1 }]}>
            {picker ? <Feather name="x" size={22} color={color.accentInk} /> : <Text style={{ fontSize: 22 }}>😀</Text>}
          </Pressable>
          <Pressable onPress={() => { setPicker(false); setOpen(true); }} accessibilityRole="button" accessibilityLabel={t('chat.title')} style={[styles.fab, { backgroundColor: color.streak }]}>
            <Feather name="message-circle" size={22} color={color.accentInk} />
            {unread ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
          </Pressable>
        </Row>
      </View>
      <ChatSheet view={view} chat={chat} open={open} onClose={() => setOpen(false)} onError={onError} mine={mine} amMuted={amMuted} react={react} />
    </>
  );
}

function ChatSheet({ view, chat, open, onClose, onError, mine, amMuted, react }: {
  view: LiveView; chat: ChatApi; open: boolean; onClose: () => void; onError: (c: string) => void; mine: (m: ChatMessage) => boolean; amMuted: boolean; react: (e: string) => void;
}) {
  const { t, locale } = useApp();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<ChatMessage | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const host = view.role === 'host';

  useEffect(() => { if (open) setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50); }, [open, chat.messages.length]);

  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    const r = await chat.send(v);
    setBusy(false);
    if (r.ok) setText(''); else if (r.error) onError(r.error);
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-JO-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <DirectionRoot>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.sheet, { paddingBottom: insets.bottom + space(3) }]}>
          <Row style={{ justifyContent: 'space-between', marginBottom: space(2) }}>
            <Txt v="h2">{t('chat.title')}</Txt>
            <IconButton icon="x" label={t('common.close')} onPress={onClose} />
          </Row>
          <ScrollView ref={scroll} style={{ flexGrow: 0, maxHeight: 420 }} contentContainerStyle={{ gap: space(2), paddingVertical: space(2) }}>
            {!chat.messages.length ? <Txt dim center>{t('chat.empty')}</Txt> : null}
            {chat.messages.map((m) => {
              const me = mine(m);
              const tint = m.role === 'host' ? color.gold : avatarColor(m.playerId ?? m.name);
              const isMuted = !!m.playerId && chat.muted.includes(m.playerId);
              return (
                <Pressable key={m.id} onLongPress={host ? () => setMenu(m) : undefined} delayLongPress={350}
                  style={[styles.msgRow, me ? { flexDirection: 'row-reverse' } : null]}>
                  {!me ? <Avatar name={m.name} tint={tint} size={28} /> : null}
                  <View style={[styles.bubble, me ? styles.bubbleMe : null]}>
                    {!me ? (
                      <Row gap={1}>
                        <Txt v="small" color={tint}>{m.name}</Txt>
                        {m.role === 'host' ? <Txt v="small" color={color.gold}>· {t('common.host')}</Txt> : null}
                        {isMuted ? <Feather name="mic-off" size={12} color={color.textFaint} /> : null}
                      </Row>
                    ) : null}
                    <Txt auto color={me ? color.accentInk : color.text}>{m.text}</Txt>
                    <Txt v="small" color={me ? color.accentInk : color.textFaint} style={{ fontSize: 11, opacity: 0.8 }}>{time(m.at)}</Txt>
                  </View>
                  {host ? (
                    <Pressable onPress={() => setMenu(m)} accessibilityRole="button" accessibilityLabel={t('chat.options')} hitSlop={8} style={styles.more}>
                      <Feather name="more-horizontal" size={16} color={color.textFaint} />
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Row gap={1} style={{ justifyContent: 'center', marginVertical: space(2), opacity: amMuted ? 0.4 : 1 }}>
            {REACTIONS.map((e) => (
              <Pressable key={e} disabled={amMuted} onPress={() => react(e)} accessibilityRole="button" accessibilityLabel={e} style={styles.emojiSmall}><Text style={{ fontSize: 20 }}>{e}</Text></Pressable>
            ))}
          </Row>
          {amMuted ? (
            <Txt v="small" color={color.warn} center>{t('chat.youAreMuted')}</Txt>
          ) : (
            <Row gap={2}>
              <TextInput
                value={text} onChangeText={(v) => setText(v.slice(0, MAX))} placeholder={t('chat.placeholder')} placeholderTextColor={color.textFaint}
                onSubmitEditing={send} returnKeyType="send" maxLength={MAX} accessibilityLabel={t('chat.placeholder')}
                style={[styles.input, { textAlign: locale === 'ar' ? 'right' : 'left' }]}
              />
              <Pressable onPress={send} disabled={!text.trim() || busy} accessibilityRole="button" accessibilityLabel={t('chat.send')}
                style={[styles.send, { opacity: !text.trim() || busy ? 0.4 : 1 }]}>
                <Feather name="send" size={20} color={color.accentInk} style={locale === 'ar' ? { transform: [{ scaleX: -1 }] } : null} />
              </Pressable>
            </Row>
          )}
          {text.length > MAX - 30 ? <Txt v="small" faint>{text.length}/{MAX}</Txt> : null}
        </KeyboardAvoidingView>

        <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
          <DirectionRoot>
            <Pressable style={[styles.backdrop, { alignItems: 'center', justifyContent: 'center', padding: space(6) }]} onPress={() => setMenu(null)}>
              <View style={styles.menu}>
                <Txt v="small" dim numberOfLines={2}>{menu?.name}: {menu?.text}</Txt>
                <MenuItem icon="trash-2" label={t('chat.delete')} tint={color.bad} onPress={async () => { const m = menu; setMenu(null); if (m) { const r = await chat.remove(m.id); if (!r.ok && r.error) onError(r.error); } }} />
                {menu?.playerId ? (
                  chat.muted.includes(menu.playerId)
                    ? <MenuItem icon="mic" label={t('chat.unmute', { name: menu.name })} onPress={async () => { const m = menu; setMenu(null); if (m?.playerId) await chat.mute(m.playerId, false); }} />
                    : <MenuItem icon="mic-off" label={t('chat.mute', { name: menu.name })} onPress={async () => { const m = menu; setMenu(null); if (m?.playerId) await chat.mute(m.playerId, true); }} />
                ) : null}
                <MenuItem icon="x" label={t('common.cancel')} onPress={() => setMenu(null)} />
              </View>
            </Pressable>
          </DirectionRoot>
        </Modal>
      </DirectionRoot>
    </Modal>
  );
}

function MenuItem({ icon, label, onPress, tint = color.text }: { icon: string; label: string; onPress: () => void; tint?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}>
      <Feather name={icon} size={18} color={tint} />
      <Txt color={tint}>{label}</Txt>
    </Pressable>
  );
}

/** Reactions rise gently from the bottom of every screen with the sender's name. */
function FloatingReactions({ reactions }: { reactions: Reaction[] }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {reactions.map((r) => <Floater key={r.key} r={r} />)}
    </View>
  );
}

function Floater({ r }: { r: Reaction }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  const x = useMemo(() => 10 + Math.random() * 70, []);
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: reduced ? 2600 : 3000, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
  }, [v, reduced]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, reduced ? 0 : -360] });
  const opacity = v.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const scale = v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.6, 1.15, 1] });
  return (
    <Animated.View style={{ position: 'absolute', bottom: 170, left: `${x}%`, alignItems: 'center', opacity, transform: [{ translateY }, { scale: reduced ? 1 : scale }] }}>
      <Text style={{ fontSize: 40 }}>{r.emoji}</Text>
      <View style={styles.floaterName}><Text style={{ color: color.text, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{r.name}</Text></View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', end: space(4), alignItems: 'flex-end', gap: space(2) },
  fab: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#294638', shadowOpacity: 0.2, shadowRadius: 12, elevation: 6, borderWidth: 1, borderColor: color.line },
  badge: { position: 'absolute', top: -4, end: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: color.wild, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: color.accentInk, fontSize: 11, fontWeight: '800' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', width: 220, justifyContent: 'center', gap: 4, padding: space(2), borderRadius: radius.lg, backgroundColor: color.bgRaised, borderWidth: 1, borderColor: color.line },
  emojiBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  emojiSmall: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  preview: { maxWidth: 260, padding: space(3), borderRadius: radius.lg, borderBottomEndRadius: 4, backgroundColor: color.bgRaised, borderWidth: 1, borderColor: color.streak },
  backdrop: { flex: 1, backgroundColor: '#29463866' },
  sheet: { backgroundColor: color.bgRaised, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(4), borderTopWidth: 1, borderColor: color.line },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2) },
  bubble: { maxWidth: '78%', paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.lg, borderBottomStartRadius: 4, backgroundColor: color.surface2 },
  bubbleMe: { backgroundColor: color.accent, borderBottomStartRadius: radius.lg, borderBottomEndRadius: 4 },
  more: { padding: 4 },
  input: { flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, color: color.text, paddingHorizontal: space(4), fontSize: 16 },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  menu: { width: '100%', maxWidth: 360, backgroundColor: color.bgRaised, borderRadius: radius.xl, padding: space(4), gap: space(1), borderWidth: 1, borderColor: color.line },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  floaterName: { marginTop: 2, paddingHorizontal: 6, borderRadius: 6, backgroundColor: '#FFFFFFE6', maxWidth: 110 },
});
