import { SOCKET_CONNECTED_KEY, SOCKET_URL_KEY, SOCKET_WS_PASSWORD_KEY, SOCKET_WS_USERNAME_KEY } from '@/constants/auth-storage';
import { buildWebSocketConnectUrl, stripSocketAuthQueryParams } from '@/constants/build-ws-connect-url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import useWebSocket, { ReadyState } from 'react-use-websocket';

type InboundPayloadFormat = 'json' | 'text' | 'binary' | 'empty';

type ChatMessage = {
  id: number;
  kind: 'sent' | 'received';
  text: string;
  inboundFormat?: InboundPayloadFormat;
};

const DEFAULT_WS_BASE_URL = 'ws://localhost:8080';
/** Upper bound on automatic reconnect tries (effectively unlimited). */
const CHAT_MAX_RECONNECT_ATTEMPTS = Number.MAX_SAFE_INTEGER;
const CHAT_RECONNECT_INTERVAL_MS = 3000;

export default function HomeScreen() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messageIdRef = useRef(0);
  const lastInboundEventTimeRef = useRef(0);
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [shouldConnect, setShouldConnect] = useState(false);
  const [wsBaseUrl, setWsBaseUrl] = useState(DEFAULT_WS_BASE_URL);
  const [wsUsername, setWsUsername] = useState('');
  const [wsPassword, setWsPassword] = useState('');
  const [isConnectionStateLoaded, setIsConnectionStateLoaded] = useState(false);

  const socketUrl = useMemo(
    () => buildWebSocketConnectUrl(wsBaseUrl, wsUsername, wsPassword),
    [wsBaseUrl, wsUsername, wsPassword]
  );

  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(width), [width]);

  const appendChatMessage = useCallback(
    (kind: ChatMessage['kind'], text: string, inboundFormat?: InboundPayloadFormat) => {
      setMessages((prev) => [
        ...prev,
        { id: messageIdRef.current++, kind, text, inboundFormat: kind === 'received' ? inboundFormat : undefined },
      ]);
    },
    []
  );

  const { sendMessage, lastMessage, readyState, getWebSocket } = useWebSocket(
    socketUrl,
    {
      retryOnError: true,
      shouldReconnect: () => shouldConnect && !isManuallyClosed,
      reconnectAttempts: CHAT_MAX_RECONNECT_ATTEMPTS,
      reconnectInterval: CHAT_RECONNECT_INTERVAL_MS,
    },
    shouldConnect
  );

  const latestInbound = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].kind === 'received') {
        const row = messages[i];
        return { text: row.text, format: row.inboundFormat ?? 'text' };
      }
    }
    return null;
  }, [messages]);
  const hasReceived = latestInbound != null;
  const isOpen = readyState === ReadyState.OPEN;
  const statusText = useMemo(() => getChatStatusText(readyState), [readyState]);

  useEffect(() => {
    const hydrateConnectionState = async () => {
      try {
        const [savedUrl, savedConnected, savedUser, savedPass] = await Promise.all([
          AsyncStorage.getItem(SOCKET_URL_KEY),
          AsyncStorage.getItem(SOCKET_CONNECTED_KEY),
          AsyncStorage.getItem(SOCKET_WS_USERNAME_KEY),
          AsyncStorage.getItem(SOCKET_WS_PASSWORD_KEY),
        ]);

        const nextBase = savedUrl?.trim() ? stripSocketAuthQueryParams(savedUrl) : DEFAULT_WS_BASE_URL;
        setWsBaseUrl(nextBase);
        setWsUsername(savedUser ?? '');
        setWsPassword(savedPass ?? '');

        const shouldAutoConnect = savedConnected === 'true';
        setShouldConnect(shouldAutoConnect);
        setIsManuallyClosed(!shouldAutoConnect);
      } finally {
        setIsConnectionStateLoaded(true);
      }
    };

    void hydrateConnectionState();
  }, []);

  useEffect(() => {
    if (!lastMessage) {
      return;
    }
    if (lastMessage.timeStamp === lastInboundEventTimeRef.current) {
      return;
    }
    lastInboundEventTimeRef.current = lastMessage.timeStamp;
    const { text, format } = formatInboundWebSocketData(lastMessage.data);
    appendChatMessage('received', text, format);
  }, [appendChatMessage, lastMessage]);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || !isOpen) {
      return;
    }

    sendMessage(trimmed);
    appendChatMessage('sent', trimmed);
    setMessage('');
  }, [appendChatMessage, isOpen, message, sendMessage]);

  const handleClose = useCallback(() => {
    setIsManuallyClosed(true);
    setShouldConnect(false);
    getWebSocket()?.close();
    void AsyncStorage.setItem(SOCKET_CONNECTED_KEY, 'false');
    router.replace('/login' as never);
  }, [getWebSocket]);

  const handleStart = useCallback(() => {
    setIsManuallyClosed(false);
    setShouldConnect(true);
    void AsyncStorage.setItem(SOCKET_CONNECTED_KEY, 'true');
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageContent}>
        <View style={styles.surfaceCard}>
          <View style={styles.hero}>
            <Text style={styles.heroKicker}>Live connection</Text>
            <Text style={styles.title}>WebSocket demo</Text>
            <View style={styles.titleUnderline} />
            <Text style={styles.heroSubtitle}>
              Send a payload to the server and read the latest inbound frame below.
            </Text>
          </View>

          <View style={[styles.statusPill, isOpen ? styles.statusPillOpen : styles.statusPillClosed]}>
            <View style={[styles.statusDot, isOpen ? styles.statusDotOpen : styles.statusDotClosed]} />
            <Text style={[styles.statusPillText, isOpen ? styles.statusPillTextOpen : styles.statusPillTextClosed]}>
              {statusText}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Outbound</Text>
          <Text style={styles.sectionHint}>Plain text or JSON — sent as a WebSocket message</Text>
          <TextInput
            multiline
            numberOfLines={4}
            style={styles.messageInput}
            placeholder="Type a message to send…"
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
            placeholderTextColor="#8a9390"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={[styles.primaryButton, !isOpen && styles.disabledButton]}
              onPress={handleSend}
              disabled={!isOpen}>
              <Text style={styles.primaryButtonText}>Send message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.secondaryButton}
              onPress={() => void handleClose()}>
              <Text style={styles.secondaryButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.receivedPanel}>
            <View style={styles.receivedHeader}>
              <View style={styles.receivedHeaderLeft}>
                <View style={[styles.receivedPulse, hasReceived && styles.receivedPulseActive]} />
                <Text style={styles.receivedTitle}>Inbound</Text>
              </View>
              {hasReceived ? (
                <View style={styles.receivedBadges}>
                  <View style={styles.receivedBadge}>
                    <Text style={styles.receivedBadgeText}>Latest</Text>
                  </View>
                  {latestInbound && latestInbound.format !== 'text' ? (
                    <View style={[styles.receivedBadge, styles.receivedFormatBadge]}>
                      <Text style={[styles.receivedBadgeText, styles.receivedFormatBadgeText]}>
                        {inboundFormatLabel(latestInbound.format)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <Text style={styles.receivedHint}>Latest frame from the server (pretty-printed when JSON)</Text>
            <View style={styles.receivedBodyWrap}>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator
                style={styles.receivedScroll}
                contentContainerStyle={styles.receivedScrollContent}>
                <Text
                  style={[
                    styles.receivedBodyBase,
                    hasReceived ? styles.receivedBodyMono : styles.receivedBodyPlaceholder,
                  ]}
                  selectable>
                  {hasReceived && latestInbound ? latestInbound.text : 'Waiting for the first message…'}
                </Text>
              </ScrollView>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (width: number) => {
  const scale = Math.min(Math.max(width / 390, 0.85), 1.35);
  const isCompact = width < 420;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: '#dce6dc',
    },
    pageContent: {
      paddingHorizontal: 16 * scale,
      paddingTop: 10 * scale,
      paddingBottom: 28 * scale,
      flexGrow: 1,
    },
    surfaceCard: {
      backgroundColor: '#fafaf8',
      borderRadius: 22 * scale,
      paddingHorizontal: 18 * scale,
      paddingTop: 22 * scale,
      paddingBottom: 20 * scale,
      borderWidth: 1,
      borderColor: 'rgba(47, 111, 47, 0.12)',
      ...Platform.select({
        ios: {
          shadowColor: '#1a2e1a',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.1,
          shadowRadius: 24,
        },
        android: { elevation: 4 },
        default: {},
      }),
    },
    hero: {
      marginBottom: 18 * scale,
    },
    heroKicker: {
      fontSize: 11 * scale,
      fontWeight: '700',
      letterSpacing: 1.4,
      color: '#5a7a5c',
      textTransform: 'uppercase',
      marginBottom: 6 * scale,
    },
    title: {
      fontSize: 28 * scale,
      fontWeight: '800',
      color: '#1c2b1e',
      letterSpacing: -0.5,
    },
    titleUnderline: {
      width: 48 * scale,
      height: 4 * scale,
      borderRadius: 2,
      backgroundColor: '#2f6f2f',
      marginTop: 8 * scale,
      marginBottom: 12 * scale,
    },
    heroSubtitle: {
      fontSize: 14 * scale,
      lineHeight: 21 * scale,
      color: '#5c6b5e',
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10 * scale,
      alignSelf: 'flex-start',
      paddingVertical: 10 * scale,
      paddingHorizontal: 14 * scale,
      borderRadius: 999,
      marginBottom: 22 * scale,
      maxWidth: '100%',
    },
    statusPillOpen: {
      backgroundColor: 'rgba(15, 127, 32, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(15, 127, 32, 0.22)',
    },
    statusPillClosed: {
      backgroundColor: 'rgba(182, 58, 42, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(182, 58, 42, 0.2)',
    },
    statusDot: {
      width: 8 * scale,
      height: 8 * scale,
      borderRadius: 4 * scale,
    },
    statusDotOpen: {
      backgroundColor: '#0f7f20',
    },
    statusDotClosed: {
      backgroundColor: '#c94a3d',
    },
    statusPillText: {
      fontSize: 13 * scale,
      fontWeight: '600',
      flexShrink: 1,
    },
    statusPillTextOpen: {
      color: '#0d5a18',
    },
    statusPillTextClosed: {
      color: '#8b2f24',
    },
    sectionLabel: {
      fontSize: 12 * scale,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: '#2f4a32',
      textTransform: 'uppercase',
      marginBottom: 4 * scale,
    },
    sectionHint: {
      fontSize: 12 * scale,
      color: '#6f7d71',
      marginBottom: 10 * scale,
    },
    divider: {
      height: 1,
      backgroundColor: 'rgba(47, 111, 47, 0.1)',
      marginVertical: 22 * scale,
    },
    receivedPanel: {
      marginTop: 0,
      marginBottom: 4 * scale,
      borderRadius: 14 * scale,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: 'rgba(47, 111, 47, 0.18)',
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#1f3d1f',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
        },
        android: { elevation: 3 },
        default: {},
      }),
    },
    receivedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14 * scale,
      paddingTop: 12 * scale,
      paddingBottom: 4 * scale,
    },
    receivedHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10 * scale,
    },
    receivedPulse: {
      width: 10 * scale,
      height: 10 * scale,
      borderRadius: 5 * scale,
      backgroundColor: '#d4d9d4',
      borderWidth: 2,
      borderColor: '#e8ebe8',
    },
    receivedPulseActive: {
      backgroundColor: '#83b82b',
      borderColor: 'rgba(131, 184, 43, 0.35)',
    },
    receivedTitle: {
      fontSize: 15 * scale,
      fontWeight: '700',
      color: '#1f3320',
      letterSpacing: 0.2,
    },
    receivedBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8 * scale,
      flexShrink: 0,
    },
    receivedBadge: {
      backgroundColor: 'rgba(47, 111, 47, 0.1)',
      paddingHorizontal: 10 * scale,
      paddingVertical: 4 * scale,
      borderRadius: 999,
    },
    receivedFormatBadge: {
      backgroundColor: 'rgba(27, 94, 140, 0.12)',
    },
    receivedBadgeText: {
      fontSize: 11 * scale,
      fontWeight: '700',
      color: '#2f6f2f',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    receivedFormatBadgeText: {
      color: '#1b5e8c',
    },
    receivedHint: {
      paddingHorizontal: 14 * scale,
      paddingBottom: 10 * scale,
      fontSize: 12 * scale,
      color: '#6b7785',
    },
    receivedBodyWrap: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(47, 111, 47, 0.12)',
      backgroundColor: '#f4f7f4',
    },
    receivedScroll: {
      maxHeight: isCompact ? 200 * scale : 240 * scale,
    },
    receivedScrollContent: {
      paddingHorizontal: 14 * scale,
      paddingVertical: 12 * scale,
      paddingBottom: 16 * scale,
    },
    receivedBodyBase: {
      fontSize: 13 * scale,
      lineHeight: 20 * scale,
    },
    receivedBodyMono: {
      color: '#1a2420',
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
    receivedBodyPlaceholder: {
      color: '#8a9590',
      fontStyle: 'italic',
    },
    messageInput: {
      borderWidth: 1,
      borderColor: 'rgba(47, 111, 47, 0.2)',
      borderRadius: 14 * scale,
      backgroundColor: '#fff',
      minHeight: 118 * scale,
      fontSize: 15 * scale,
      lineHeight: 22 * scale,
      color: '#1a2420',
      paddingHorizontal: 14 * scale,
      paddingVertical: 12 * scale,
      marginBottom: 14 * scale,
    },
    buttonRow: {
      flexDirection: 'column',
      gap: 11 * scale,
      alignItems: 'stretch',
    },
    primaryButton: {
      borderRadius: 12 * scale,
      paddingVertical: 14 * scale,
      paddingHorizontal: 18 * scale,
      backgroundColor: '#2f6f2f',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#1f3d1f',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
        default: {},
      }),
    },
    secondaryButton: {
      borderRadius: 12 * scale,
      paddingVertical: 13 * scale,
      paddingHorizontal: 18 * scale,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: 'rgba(60, 72, 62, 0.35)',
      alignItems: 'center',
    },
    disabledButton: {
      opacity: 0.45,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 15 * scale,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    secondaryButtonText: {
      color: '#3d4a3f',
      fontSize: 14 * scale,
      fontWeight: '600',
    },
  });
};

function getChatStatusText(state: ReadyState): string {
  if (state === ReadyState.UNINSTANTIATED) {
    return 'Connection not started.';
  }
  if (state === ReadyState.OPEN) {
    return 'Connected to saved login socket.';
  }
  if (state === ReadyState.CONNECTING) {
    return 'Connecting...';
  }
  if (state === ReadyState.CLOSING) {
    return 'Closing WebSocket...';
  }
  if (state === ReadyState.CLOSED) {
    return 'Disconnected from WebSocket.';
  }
  return 'WebSocket not ready.';
}

function inboundFormatLabel(format: InboundPayloadFormat): string {
  if (format === 'json') {
    return 'JSON';
  }
  if (format === 'binary') {
    return 'Binary';
  }
  if (format === 'empty') {
    return 'Empty';
  }
  return 'Text';
}

type FormattedInbound = {
  text: string;
  format: InboundPayloadFormat;
};

/**
 * Turns WebSocket `MessageEvent.data` into readable text (pretty-printed JSON when applicable).
 */
function formatInboundWebSocketData(data: MessageEvent['data']): FormattedInbound {
  if (data == null) {
    return { text: '(no payload)', format: 'empty' };
  }

  if (typeof data === 'string') {
    if (data.length === 0) {
      return { text: '(empty string)', format: 'empty' };
    }
    const trimmed = data.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(data) as unknown;
        return { text: JSON.stringify(parsed, null, 2), format: 'json' };
      } catch {
        return { text: data, format: 'text' };
      }
    }
    return { text: data, format: 'text' };
  }

  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return { text: `[Blob · ${data.size} byte${data.size === 1 ? '' : 's'}]`, format: 'binary' };
  }

  if (data instanceof ArrayBuffer) {
    const snippet = tryDecodeUtf8Buffer(data);
    if (snippet) {
      return formatInboundWebSocketData(snippet);
    }
    return { text: `[ArrayBuffer · ${data.byteLength} byte${data.byteLength === 1 ? '' : 's'}]`, format: 'binary' };
  }

  if (ArrayBuffer.isView(data)) {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    const snippet = tryDecodeUtf8Buffer(copy.buffer);
    if (snippet) {
      return formatInboundWebSocketData(snippet);
    }
    return {
      text: `[Binary view · ${data.byteLength} byte${data.byteLength === 1 ? '' : 's'}]`,
      format: 'binary',
    };
  }

  if (typeof data === 'object') {
    try {
      return { text: JSON.stringify(data, null, 2), format: 'json' };
    } catch {
      return { text: String(data), format: 'text' };
    }
  }

  return { text: String(data), format: 'text' };
}

function tryDecodeUtf8Buffer(buffer: ArrayBuffer): string | null {
  if (buffer.byteLength === 0) {
    return '';
  }
  if (buffer.byteLength > 65_536) {
    return null;
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    const printableRatio =
      text.length === 0
        ? 0
        : [...text].filter((ch) => {
            const c = ch.codePointAt(0) ?? 0;
            return (c >= 32 && c !== 127) || c === 9 || c === 10 || c === 13;
          }).length / text.length;
    if (printableRatio < 0.85) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

