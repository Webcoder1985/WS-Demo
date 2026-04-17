import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import useWebSocket, { ReadyState } from 'react-use-websocket';

type ChatMessage = {
  id: number;
  kind: 'sent' | 'received';
  text: string;
};

type BookLevel = [number, number];

type BookMessage = {
  event?: string;
  numLevels?: number;
  bids?: BookLevel[];
  asks?: BookLevel[];
};

const SOCKET_URL = 'wss://ws.postman-echo.com/raw';
const WSS_FEED_URL = 'wss://www.cryptofacilities.com/ws/v1';
const PRODUCT_ID = 'PI_XBTUSD';
const ORDERBOOK_LEVELS = 15;
const CHAT_RECONNECT_ATTEMPTS = 10;
const CHAT_RECONNECT_INTERVAL_MS = 3000;
const ORDERBOOK_RECONNECT_ATTEMPTS = 10;
const ORDERBOOK_RECONNECT_INTERVAL_MS = 2000;

export default function HomeScreen() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bids, setBids] = useState<BookLevel[]>([]);
  const [asks, setAsks] = useState<BookLevel[]>([]);
  const messageIdRef = useRef(0);
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [shouldConnect, setShouldConnect] = useState(false);

  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(width), [width]);

  const appendChatMessage = useCallback((kind: ChatMessage['kind'], text: string) => {
    setMessages((prev) => [...prev, { id: messageIdRef.current++, kind, text }]);
  }, []);

  const { sendMessage, lastMessage, readyState, getWebSocket } = useWebSocket(
    SOCKET_URL,
    {
      retryOnError: true,
      shouldReconnect: () => shouldConnect && !isManuallyClosed,
      reconnectAttempts: CHAT_RECONNECT_ATTEMPTS,
      reconnectInterval: CHAT_RECONNECT_INTERVAL_MS,
    },
    shouldConnect
  );
  const { sendJsonMessage, lastJsonMessage, readyState: orderbookReadyState } = useWebSocket(WSS_FEED_URL, {
    retryOnError: true,
    shouldReconnect: () => true,
    reconnectAttempts: ORDERBOOK_RECONNECT_ATTEMPTS,
    reconnectInterval: ORDERBOOK_RECONNECT_INTERVAL_MS,
  });

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
  const orderbookStatus = useMemo(() => getOrderbookStatusText(orderbookReadyState), [orderbookReadyState]);

  useEffect(() => {
    if (lastMessage?.data) {
      appendChatMessage('received', String(lastMessage.data));
    }
  }, [appendChatMessage, lastMessage]);
  useEffect(() => {
    sendJsonMessage({
      event: 'subscribe',
      feed: 'book_ui_1',
      product_ids: [PRODUCT_ID],
    });

    return () => {
      sendJsonMessage({
        event: 'unsubscribe',
        feed: 'book_ui_1',
        product_ids: [PRODUCT_ID],
      });
    };
  }, [sendJsonMessage]);
  useEffect(() => {
    const incoming = lastJsonMessage as BookMessage | null;
    if (!incoming) {
      return;
    }

    if (incoming.numLevels && incoming.bids && incoming.asks) {
      setBids(sortBids(incoming.bids).slice(0, ORDERBOOK_LEVELS));
      setAsks(sortAsks(incoming.asks).slice(0, ORDERBOOK_LEVELS));
      return;
    }

    if (incoming.bids && incoming.bids.length > 0) {
      setBids((prev) => mergeBookLevels(prev, incoming.bids ?? [], 'bids').slice(0, ORDERBOOK_LEVELS));
    }

    if (incoming.asks && incoming.asks.length > 0) {
      setAsks((prev) => mergeBookLevels(prev, incoming.asks ?? [], 'asks').slice(0, ORDERBOOK_LEVELS));
    }
  }, [lastJsonMessage]);

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
  }, [getWebSocket]);

  const handleStart = useCallback(() => {
    setIsManuallyClosed(false);
    setShouldConnect(true);
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
          {isOpen && (
            <TouchableOpacity activeOpacity={0.85} style={[styles.button, styles.closeButton]} onPress={handleClose}>
              <Text style={styles.buttonText}>Close Connection</Text>
            </TouchableOpacity>
          )}
          {!isOpen && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.button, styles.startButton, shouldConnect && styles.disabledButton]}
              onPress={handleStart}
              disabled={shouldConnect}>
              <Text style={styles.buttonText}>Start Connection</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.orderbookCard}>
        <Text style={styles.title}>Crypto WebSocket Demo</Text>
        <Text
          style={[
            styles.orderbookStatus,
            orderbookReadyState === ReadyState.OPEN ? styles.orderbookStatusOk : styles.orderbookStatusBad,
          ]}>
          {orderbookStatus}
        </Text>

        <View style={styles.orderbookColumns}>
          <View style={styles.orderbookTable}>
            <Text style={styles.orderbookTableTitle}>Bids</Text>
            <Text style={styles.orderbookHeader}>Price | Size</Text>
            <ScrollView style={styles.orderbookRowsContainer}>
              {bids.map(([price, size]) => (
                <Text key={`b-${price}-${size}`} style={styles.orderbookRow}>
                  {formatNumber(price)} | {formatNumber(size)}
                </Text>
              ))}
            </ScrollView>
          </View>
          <View style={styles.orderbookTable}>
            <Text style={styles.orderbookTableTitle}>Asks</Text>
            <Text style={styles.orderbookHeader}>Price | Size</Text>
            <ScrollView style={styles.orderbookRowsContainer}>
              {asks.map(([price, size]) => (
                <Text key={`a-${price}-${size}`} style={styles.orderbookRow}>
                  {formatNumber(price)} | {formatNumber(size)}
                </Text>
              ))}
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
      backgroundColor: '#ececec',
      padding: 12 * scale,
      flex: 1,
    },
    pageContent: {
      gap: 12 * scale,
      paddingBottom: 24 * scale,
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
    orderbookCard: {
      backgroundColor: '#ececec',
      borderTopWidth: 3,
      borderTopColor: '#2f6f2f',
      borderRadius: 2,
      paddingHorizontal: 14 * scale,
      paddingVertical: 16 * scale,
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
    orderbookStatus: {
      fontSize: 14 * scale,
      marginBottom: 10 * scale,
    },
    orderbookStatusOk: {
      color: '#2fd15a',
    },
    orderbookStatusBad: {
      color: '#f27575',
    },
    orderbookColumns: {
      flexDirection: 'row',
      gap: 12 * scale,
    },
    orderbookTable: {
      flex: 1,
      backgroundColor: '#ececec',
      borderRadius: 0,
      padding: 10 * scale,
      borderWidth: 1,
      borderColor: 'rgba(210,210,210,1.00)',
      minHeight: 240 * scale,
      maxHeight: 320 * scale,
    },
    orderbookRowsContainer: {
      flex: 1,
    },
    orderbookTableTitle: {
      color: '#000000',
      fontSize: 16 * scale,
      fontWeight: '700',
      marginBottom: 8 * scale,
    },
    orderbookHeader: {
      color: '#9da6b3',
      fontSize: 14 * scale,
      marginBottom: 8 * scale,
    },
    orderbookRow: {
      color: '#000000',
      fontSize: 14 * scale,
      marginBottom: 6 * scale,
    },
  });
};

function mergeBookLevels(current: BookLevel[], delta: BookLevel[], side: 'bids' | 'asks'): BookLevel[] {
  const map = new Map<number, number>();

  for (const [price, size] of current) {
    map.set(price, size);
  }

  for (const [price, size] of delta) {
    if (size === 0) {
      map.delete(price);
    } else {
      map.set(price, size);
    }
  }

  const merged = Array.from(map.entries()).map(([price, size]) => [price, size] as BookLevel);
  return side === 'bids' ? sortBids(merged) : sortAsks(merged);
}

function sortBids(levels: BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => b[0] - a[0]);
}

function sortAsks(levels: BookLevel[]): BookLevel[] {
  return [...levels].sort((a, b) => a[0] - b[0]);
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function getChatStatusText(state: ReadyState): string {
  if (state === ReadyState.UNINSTANTIATED) {
    return 'Connection not started.';
  }
  if (state === ReadyState.OPEN) {
    return `Connected to: ${SOCKET_URL}`;
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

function getOrderbookStatusText(state: ReadyState): string {
  if (state === ReadyState.OPEN) {
    return `Connected: ${PRODUCT_ID}`;
  }
  if (state === ReadyState.CONNECTING) {
    return 'Connecting...';
  }
  if (state === ReadyState.CLOSING) {
    return 'Closing...';
  }
  if (state === ReadyState.CLOSED) {
    return 'Disconnected';
  }
  return 'Not started';
}
