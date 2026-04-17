import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import useWebSocket, { ReadyState } from 'react-use-websocket';

type ChatMessage = {
  id: number;
  kind: 'sent' | 'received';
  text: string;
};

const SOCKET_URL = 'wss://ws.postman-echo.com/raw';

export default function HomeScreen() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messageIdRef = useRef(0);
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [shouldConnect, setShouldConnect] = useState(false);

  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const styles = useMemo(() => createStyles(width), [width]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isCompact);

  const { sendMessage, lastMessage, readyState, getWebSocket } = useWebSocket(
    SOCKET_URL,
    {
      retryOnError: true,
      shouldReconnect: () => shouldConnect && !isManuallyClosed,
      reconnectAttempts: 10,
      reconnectInterval: 3000,
    },
    shouldConnect
  );

  const latestReceived = messages.filter((item) => item.kind === 'received').at(-1)?.text ?? 'No messages yet';
  const isOpen = readyState === ReadyState.OPEN;
  const statusText = useMemo(() => {
    if (readyState === ReadyState.UNINSTANTIATED) {
      return 'Connection not started.';
    }
    if (readyState === ReadyState.OPEN) {
      return `Connected to: ${SOCKET_URL}`;
    }
    if (readyState === ReadyState.CONNECTING) {
      return 'Connecting...';
    }
    if (readyState === ReadyState.CLOSING) {
      return 'Closing WebSocket...';
    }
    if (readyState === ReadyState.CLOSED) {
      return 'Disconnected from WebSocket.';
    }
    return 'WebSocket not ready.';
  }, [readyState]);

  useEffect(() => {
    if (lastMessage?.data) {
      const incoming = String(lastMessage.data);
      setMessages((prev) => [
        ...prev,
        { id: messageIdRef.current++, kind: 'received', text: incoming },
      ]);
    }
  }, [lastMessage]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || !isOpen) {
      return;
    }

    sendMessage(trimmed);
    setMessages((prev) => [...prev, { id: messageIdRef.current++, kind: 'sent', text: trimmed }]);
    setMessage('');
  };

  const handleClose = () => {
    setIsManuallyClosed(true);
    setShouldConnect(false);
    getWebSocket()?.close();
  };

  const handleStart = () => {
    setIsManuallyClosed(false);
    setShouldConnect(true);
  };

  const handleNavigateToBlank = () => {
    router.push('/blank' as never);
  };

  useEffect(() => {
    setIsSidebarOpen(!isCompact);
  }, [isCompact]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>WebSockets Demo</Text>

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
    </SafeAreaView>
  );
}

const createStyles = (width: number) => {
  const scale = Math.min(Math.max(width / 390, 0.85), 1.35);
  const isCompact = width < 420;

  return StyleSheet.create({
    screen: {
      backgroundColor: '#2f2f32',
      padding: 12 * scale,
      flex: 1,
    },
    header: {
      height: 52 * scale,
      backgroundColor: '#ececec',
      borderRadius: 6,
      marginBottom: 10 * scale,
      paddingHorizontal: 10 * scale,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerSpacer: {
      flex: 1,
    },
    toggleButton: {
      backgroundColor: '#4b5563',
      borderRadius: 4,
      paddingHorizontal: 14 * scale,
      paddingVertical: 8 * scale,
    },
    toggleButtonText: {
      color: '#fff',
      fontSize: 14 * scale,
      fontWeight: '600',
    },
    layout: {
      flex: 1,
      flexDirection: isCompact ? 'column' : 'row',
      gap: 10 * scale,
    },
    sidebar: {
      width: isCompact ? '100%' : 220,
      backgroundColor: '#1f2937',
      borderRadius: 6,
      padding: 10 * scale,
      gap: 10 * scale,
    },
    sidebarTitle: {
      color: '#fff',
      fontSize: 16 * scale,
      fontWeight: '700',
    },
    card: {
      flex: 1,
      backgroundColor: '#ececec',
      borderTopWidth: 3,
      borderTopColor: '#2f6f2f',
      borderRadius: 2,
      paddingHorizontal: 14 * scale,
      paddingVertical: 16 * scale,
      elevation: 8,
    },
    title: {
      fontSize: 42 * scale,
      fontWeight: '700',
      color: '#111',
      marginBottom: 12 * scale,
    },
    connectionStatus: {
      fontSize: 22 * scale,
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
      fontSize: 22 * scale,
      color: '#111',
      flexShrink: 1,
    },
    messagesContainer: {
      maxHeight: 140 * scale,
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
      fontSize: 22 * scale,
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
    navigateButton: {
      backgroundColor: '#6c5ce7',
    },
    closeButton: {
      backgroundColor: '#b4b4b4',
    },
    disabledButton: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#fff',
      fontSize: 20 * scale,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
};
