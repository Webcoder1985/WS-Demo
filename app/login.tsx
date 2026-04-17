import { useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type LoginErrors = {
  email?: string;
  password?: string;
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});

  const validateLogin = (): LoginErrors => {
    const nextErrors: LoginErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid email address.';
    }

    if (!password.trim()) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }

    return nextErrors;
  };

  const handleLogin = () => {
    const validationErrors = validateLogin();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setErrors({});
    router.replace('/(tabs)' as never);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerShape} />

      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <View style={styles.titleUnderline} />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="example@email.com"
          placeholderTextColor="#a0a0a0"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (errors.email) {
              setErrors((prev) => ({ ...prev, email: undefined }));
            }
          }}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Enter your password"
          placeholderTextColor="#a0a0a0"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (errors.password) {
              setErrors((prev) => ({ ...prev, password: undefined }));
            }
          }}
          secureTextEntry
        />
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        <View style={styles.helperRow}>
          <Text style={styles.helperText}>Remember me</Text>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </View>

        <TouchableOpacity activeOpacity={0.85} style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f98383',
  },
  headerShape: {
    height: '35%',
    backgroundColor: '#f98383',
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
    backgroundColor: '#f97878',
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
    borderBottomColor: '#efabab',
    paddingVertical: 8,
    fontSize: 15,
    color: '#333',
  },
  inputError: {
    borderBottomColor: '#d93025',
  },
  errorText: {
    color: '#d93025',
    fontSize: 12,
    marginTop: 4,
  },
  helperRow: {
    marginTop: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  helperText: {
    color: '#8f8f8f',
    fontSize: 12,
  },
  forgotText: {
    color: '#f77878',
    fontSize: 12,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#f97878',
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
