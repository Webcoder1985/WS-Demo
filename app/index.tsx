import { AUTH_STATUS_KEY } from '@/constants/auth-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';

export default function Index() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const readAuthStatus = async () => {
      try {
        const authStatus = await AsyncStorage.getItem(AUTH_STATUS_KEY);
        setIsLoggedIn(authStatus === 'true');
      } finally {
        setIsCheckingAuth(false);
      }
    };

    void readAuthStatus();
  }, []);

  if (isCheckingAuth) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.text}>Checking login...</Text>
      </SafeAreaView>
    );
  }

  return <Redirect href={isLoggedIn ? '/(tabs)' : '/login'} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 16,
    color: '#444',
  },
});
