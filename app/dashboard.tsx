import { SOCKET_URL_KEY } from '@/constants/auth-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useWebSocket, { ReadyState } from 'react-use-websocket';

const WSS_FEED_URL = 'wss://www.cryptofacilities.com/ws/v1';
const PRODUCT_ID = 'PI_XBTUSD';
const ORDERBOOK_LEVELS = 15;

type BookLevel = [number, number];

type BookMessage = {
  event?: string;
  numLevels?: number;
  bids?: BookLevel[];
  asks?: BookLevel[];
};

export default function BlankScreen() {
  const [bids, setBids] = useState<BookLevel[]>([]);
  const [asks, setAsks] = useState<BookLevel[]>([]);
  const [socketUrl, setSocketUrl] = useState(WSS_FEED_URL);

  const { sendJsonMessage, lastJsonMessage, readyState, getWebSocket } = useWebSocket(socketUrl, {
    retryOnError: true,
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 2000,
  });

  useEffect(() => {
    const hydrateSocketUrl = async () => {
      const savedUrl = await AsyncStorage.getItem(SOCKET_URL_KEY);
      if (savedUrl?.trim()) {
        setSocketUrl(savedUrl);
      }
    };

    void hydrateSocketUrl();
  }, []);

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
    const message = lastJsonMessage as BookMessage | null;
    if (!message) {
      return;
    }

    if (message.numLevels && message.bids && message.asks) {
      setBids(sortBids(message.bids).slice(0, ORDERBOOK_LEVELS));
      setAsks(sortAsks(message.asks).slice(0, ORDERBOOK_LEVELS));
      return;
    }

    if (message.bids && message.bids.length > 0) {
      setBids((prev) => mergeBookLevels(prev, message.bids ?? [], 'bids').slice(0, ORDERBOOK_LEVELS));
    }

    if (message.asks && message.asks.length > 0) {
      setAsks((prev) => mergeBookLevels(prev, message.asks ?? [], 'asks').slice(0, ORDERBOOK_LEVELS));
    }
  }, [lastJsonMessage]);

  const status = useMemo(() => {
    if (readyState === ReadyState.OPEN) {
      return `Connected: ${PRODUCT_ID}`;
    }
    if (readyState === ReadyState.CONNECTING) {
      return 'Connecting...';
    }
    if (readyState === ReadyState.CLOSING) {
      return 'Closing...';
    }
    if (readyState === ReadyState.CLOSED) {
      return 'Disconnected';
    }
    return 'Not started';
  }, [readyState]);

  const handleDisconnect = () => {
    getWebSocket()?.close();
    router.replace('/login_trading' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={[styles.status, readyState === ReadyState.OPEN ? styles.statusOk : styles.statusBad]}>
        {status}
      </Text>

      <View style={styles.columns}>
        <View style={styles.table}>
          <Text style={styles.tableTitle}>Bids</Text>
          <Text style={styles.header}>Price | Size</Text>
          <ScrollView>
            {bids.map(([price, size]) => (
              <Text key={`b-${price}-${size}`} style={styles.row}>
                {formatNumber(price)} | {formatNumber(size)}
              </Text>
            ))}
          </ScrollView>
        </View>

        <View style={styles.table}>
          <Text style={styles.tableTitle}>Asks</Text>
          <Text style={styles.header}>Price | Size</Text>
          <ScrollView>
            {asks.map(([price, size]) => (
              <Text key={`a-${price}-${size}`} style={styles.row}>
                {formatNumber(price)} | {formatNumber(size)}
              </Text>
            ))}
          </ScrollView>
        </View>
      </View>
      <TouchableOpacity activeOpacity={0.85} style={styles.disconnectButton} onPress={handleDisconnect}>
        <Text style={styles.disconnectButtonText}>Disconnect</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(236,236,236,1.00)',
    padding: 10,
  },
  status: {
    fontSize: 14,
    margin: 10,
  },
  statusOk: {
    color: '#2fd15a',
  },
  statusBad: {
    color: '#f27575',
  },
  columns: {
    margin: 10,
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  table: {
    flex: 1,
    backgroundColor: 'rgba(236,236,236,1.00)',
    borderRadius: 0,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(210,210,210,1.00)',
  },
  tableTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  header: {
    color: '#9da6b3',
    fontSize: 12,
    marginBottom: 8,
  },
  row: {
    color: '#000000',
    fontSize: 13,
    marginBottom: 6,
  },
  disconnectButton: {
    backgroundColor: '#b4b4b4',
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 10,
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
