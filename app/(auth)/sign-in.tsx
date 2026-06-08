import { auth, googleProvider } from '@/src/lib/firebase';
import { useTheme } from '@/src/theme';
import * as Google from 'expo-auth-session/providers/google';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

function isRunningInExpoGo() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export default function SignInScreen() {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      if (!idToken) {
        setError('Sign in failed: missing id_token from Google.');
        setLoading(false);
        return;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      signInWithCredential(auth, credential)
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Unknown error';
          setError(`Sign in failed: ${message}`);
        })
        .finally(() => setLoading(false));
    } else if (response.type === 'error') {
      setError(`Sign in failed: ${response.error?.message ?? 'unknown error'}`);
      setLoading(false);
    } else if (response.type === 'cancel' || response.type === 'dismiss') {
      setLoading(false);
    }
  }, [response]);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        await signInWithPopup(auth, googleProvider);
        setLoading(false);
      } else {
        if (isRunningInExpoGo()) {
          // dev-only message: Expo Go cannot complete Google's OAuth redirect since SDK 48.
          setError(
            'Sign in failed: Google sign-in is not supported in Expo Go. Run on web (npm run web) or build a dev client (npx expo run:ios).',
          );
          setLoading(false);
          return;
        }
        await promptAsync();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Sign in failed: ${message}`);
      setLoading(false);
    }
  }

  // In Expo Go the button is intentionally enabled so it can surface the friendly error above.
  const authRequestReady = Platform.OS === 'web' || isRunningInExpoGo() || !!request;
  const disabled = loading || !authRequestReady;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.inner}>
        <Text style={[typography.title, { color: colors.text, marginBottom: spacing.sm }]}>
          work-tracker
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.xxl }]}>
          Track freelance hours and invoices.
        </Text>

        <Pressable
          onPress={handleSignIn}
          disabled={disabled}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: pressed ? colors.surfaceHighlight : colors.surface,
              borderColor: colors.border,
              opacity: disabled ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
        >
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={[typography.body, { color: colors.text }]}>Sign in with Google</Text>
          )}
        </Pressable>

        {error ? (
          <Text style={[typography.label, { color: colors.danger, marginTop: spacing.md }]}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 320,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  button: {
    width: '100%',
    height: 44,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
