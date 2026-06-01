import { auth, googleProvider } from '@/src/lib/firebase';
import { useTheme } from '@/src/theme';
import { signInWithPopup } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export default function SignInScreen() {
  const { colors, spacing, typography } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError('Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

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
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: pressed ? colors.surfaceHighlight : colors.surface,
              borderColor: colors.border,
              opacity: loading ? 0.6 : 1,
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
