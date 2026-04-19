import { SOCKET_CONNECTED_KEY, SOCKET_URL_KEY } from '@/constants/auth-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import useWebSocket, { ReadyState } from 'react-use-websocket';

type ChatMessage = {
  id: number;
  kind: 'sent' | 'received';
  text: string;
};

const DEFAULT_SOCKET_URL = 'wss://ws.postman-echo.com/raw';
const CHAT_RECONNECT_ATTEMPTS = 10;
const CHAT_RECONNECT_INTERVAL_MS = 3000;

export default function HomeScreen() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messageIdRef = useRef(0);
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [shouldConnect, setShouldConnect] = useState(false);
  const [socketUrl, setSocketUrl] = useState(DEFAULT_SOCKET_URL);
  const [isConnectionStateLoaded, setIsConnectionStateLoaded] = useState(false);

  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(width), [width]);

  const appendChatMessage = useCallback((kind: ChatMessage['kind'], text: string) => {
    setMessages((prev) => [...prev, { id: messageIdRef.current++, kind, text }]);
  }, []);

  const { sendMessage, lastMessage, readyState, getWebSocket } = useWebSocket(
    socketUrl,
    {
      retryOnError: true,
      shouldReconnect: () => shouldConnect && !isManuallyClosed,
      reconnectAttempts: CHAT_RECONNECT_ATTEMPTS,
      reconnectInterval: CHAT_RECONNECT_INTERVAL_MS,
    },
    shouldConnect
  );

  const latestReceived = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].kind === 'received') {
        return messages[i].text;
      }
    }
    return 'No messages yet';
  }, [messages]);
  const isOpen = readyState === ReadyState.OPEN;
  const statusText = useMemo(() => getChatStatusText(readyState), [readyState]);

  useEffect(() => {
    const hydrateConnectionState = async () => {
      try {
        const [savedUrl, savedConnected] = await Promise.all([
          AsyncStorage.getItem(SOCKET_URL_KEY),
          AsyncStorage.getItem(SOCKET_CONNECTED_KEY),
        ]);

        const nextUrl = savedUrl?.trim() || DEFAULT_SOCKET_URL;
        setSocketUrl(nextUrl);

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
    if (lastMessage?.data) {
      appendChatMessage('received', formatWebSocketResponse(lastMessage));
    }
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
      <ScrollView contentContainerStyle={styles.pageContent}>
      <View style={styles.card}>
        <Text style={styles.title}>WebSockets Connection Demo</Text>

        <Text style={[styles.connectionStatus, isOpen ? styles.statusOpen : styles.statusClosed]}>
          {statusText}
        </Text>

        <View style={styles.receivedRow}>
          <Text style={styles.receivedLabel}>RECEIVED:</Text>
          <Text style={styles.receivedText}>{latestReceived}</Text>
        </View>

        <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
          {messages.map((item) => (
            <Text key={item.id} style={styles.messageLine}>
              <Text style={styles.messageTag}>{item.kind === 'sent' ? 'Sent: ' : 'Received: '}</Text>
              {item.text}
            </Text>
          ))}
        </ScrollView>

        <TextInput
          multiline
          numberOfLines={4}
          style={styles.messageInput}
          placeholder="Write your message here..."
          value={message}
          onChangeText={setMessage}
          textAlignVertical="top"
          placeholderTextColor="#5f6770"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.button, styles.sendButton, !isOpen && styles.disabledButton]}
            onPress={handleSend}
            disabled={!isOpen}>
            <Text style={styles.buttonText}>Send Message</Text>
          </TouchableOpacity>
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
      backgroundColor: '#ececec',
      padding: 12 * scale,
      flex: 1,
    },
    pageContent: {
      gap: 12 * scale,
      paddingBottom: 0,
    },
    card: {
      backgroundColor: '#ececec',
      borderTopWidth: 3,
      borderTopColor: '#2f6f2f',
      borderRadius: 2,
      paddingHorizontal: 14 * scale,
      paddingVertical: 16 * scale,
      elevation: 8,
    },
    title: {
      fontSize: 22 * scale,
      fontWeight: '700',
      color: '#111',
      marginBottom: 12 * scale,
    },
    connectionStatus: {
      fontSize: 14 * scale,
      marginBottom: 12 * scale,
    },
    statusOpen: {
      color: '#0f7f20',
    },
    statusClosed: {
      color: '#b63a2a',
    },
    receivedRow: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#d2d2d2',
      paddingVertical: 10 * scale,
      flexDirection: isCompact ? 'column' : 'row',
      alignItems: isCompact ? 'flex-start' : 'center',
      gap: 8 * scale,
      marginBottom: 14 * scale,
    },
    receivedLabel: {
      color: '#85909c',
      letterSpacing: 1.5,
      fontSize: 14 * scale,
    },
    receivedText: {
      fontSize: 14 * scale,
      color: '#111',
      flexShrink: 1,
    },
    messagesContainer: {
      maxHeight: 140 * scale,
      minHeight: 120 * scale,
      borderWidth: 1,
      borderColor: '#d4d4d4',
      borderRadius: 3,
      backgroundColor: '#f9f9f9',
      marginBottom: 12 * scale,
    },
    messagesContent: {
      paddingHorizontal: 10 * scale,
      paddingVertical: 8 * scale,
      gap: 6 * scale,
    },
    messageLine: {
      fontSize: 14 * scale,
      color: '#222',
    },
    messageTag: {
      color: '#5f6770',
      fontWeight: '600',
    },
    messageInput: {
      borderWidth: 1,
      borderColor: '#c8c8c8',
      borderRadius: 3,
      backgroundColor: '#f7f7f7',
      minHeight: 120 * scale,
      fontSize: 14 * scale,
      color: '#20232a',
      paddingHorizontal: 10 * scale,
      paddingVertical: 8 * scale,
      marginBottom: 14 * scale,
    },
    buttonRow: {
      flexDirection: 'column',
      gap: 10 * scale,
      alignItems: 'stretch',
    },
    button: {
      borderRadius: 3,
      paddingHorizontal: 18 * scale,
      paddingVertical: 10 * scale,
      width: '100%',
    },
    sendButton: {
      backgroundColor: '#83b82b',
    },
    startButton: {
      backgroundColor: '#2b7bb8',
    },
    closeButton: {
      backgroundColor: '#b4b4b4',
    },
    disabledButton: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#fff',
      fontSize: 14 * scale,
      fontWeight: '500',
      textAlign: 'center',
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

function formatWebSocketResponse(message: MessageEvent): string {
  return JSON.stringify(
    {
      data: message.data,
      type: message.type,
      origin: message.origin,
      lastEventId: message.lastEventId,
      timeStamp: message.timeStamp,
    },
    null,
    2
  );
}

