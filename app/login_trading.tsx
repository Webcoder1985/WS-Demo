import { AUTH_STATUS_KEY, SOCKET_CONNECTED_KEY, SOCKET_URL_KEY } from '@/constants/auth-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useWebSocket, { ReadyState } from 'react-use-websocket';

const DEFAULT_SOCKET_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
const CHAT_RECONNECT_ATTEMPTS = 10;
const CHAT_RECONNECT_INTERVAL_MS = 3000;

export default function WebSocketConnectionScreen() {
  const [url, setUrl] = useState(DEFAULT_SOCKET_URL);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [shouldConnect, setShouldConnect] = useState(false);

  const socketUrl = url.trim() || DEFAULT_SOCKET_URL;
  const { readyState, getWebSocket, lastMessage } = useWebSocket(
    socketUrl,
    {
      retryOnError: true,
      shouldReconnect: () => shouldConnect && !isManuallyClosed,
      reconnectAttempts: CHAT_RECONNECT_ATTEMPTS,
      reconnectInterval: CHAT_RECONNECT_INTERVAL_MS,
    },
    shouldConnect
  );
  const socketStatus =
    readyState === ReadyState.OPEN
      ? 'Connected'
      : readyState === ReadyState.CONNECTING
        ? 'Connecting...'
        : readyState === ReadyState.CLOSING
          ? 'Closing...'
          : readyState === ReadyState.CLOSED
            ? 'Disconnected'
            : 'Not started';

  useEffect(() => {
    const hydrateSavedSocketUrl = async () => {
      const savedUrl = await AsyncStorage.getItem(SOCKET_URL_KEY);
      if (savedUrl?.trim()) {
        setUrl(savedUrl);
      }
    };

    void hydrateSavedSocketUrl();
  }, []);

  useEffect(() => {
    return () => {
      setIsManuallyClosed(true);
      setShouldConnect(false);
      getWebSocket()?.close();
    };
  }, [getWebSocket]);

  const handleConnect = async () => {
    setIsManuallyClosed(false);
    setShouldConnect(true);
    await AsyncStorage.setItem(SOCKET_URL_KEY, socketUrl);
    await AsyncStorage.setItem(SOCKET_CONNECTED_KEY, 'true');
    await AsyncStorage.setItem(AUTH_STATUS_KEY, 'true');
    router.replace('/dashboard' as never);
  };

  const latestMessage = lastMessage?.data ? String(lastMessage.data) : 'No messages received yet.';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerShape} />

      <View style={styles.card}>
        <Text style={styles.title}>WebSocket Connection</Text>
        <View style={styles.titleUnderline} />

        <Text style={styles.label}>URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://example.com"
          placeholderTextColor="#a0a0a0"
          value={url}
          onChangeText={setUrl}
          keyboardType="url"
          autoCapitalize="none"
        />
        <Text style={styles.label}>User Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your user name"
          placeholderTextColor="#a0a0a0"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="words"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor="#a0a0a0"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Text style={styles.socketStatus}>Status: {socketStatus}</Text>
        <Text style={styles.messageText}>Latest: {latestMessage}</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity activeOpacity={0.85} style={styles.connectButton} onPress={() => void handleConnect()}>
            <Text style={styles.loginButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'rgba(131,184,43,1.00)',
  },
  headerShape: {
    height: '35%',
    backgroundColor: 'rgba(131,184,43,1.00)',
  },
  card: {
    flex: 1,
    marginTop: -40,
    backgroundColor: '#f6f4f4',
    borderTopLeftRadius: 46,
    borderTopRightRadius: 46,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  title: {
    fontSize: 44,
    fontWeight: '700',
    color: '#4a4a4a',
  },
  titleUnderline: {
    width: 54,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(47,111,47,1.00)',
    marginTop: 4,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    color: '#676767',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(47,111,47,1.00)',
    paddingVertical: 8,
    fontSize: 15,
    color: '#333',
  },
  socketStatus: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
  messageText: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 8,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'column',
    gap: 10,
  },
  connectButton: {
    backgroundColor: 'rgba(47,111,47,1.00)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
