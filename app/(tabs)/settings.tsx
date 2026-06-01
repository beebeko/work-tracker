import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { useTheme } from '@/src/theme';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SettingsScreen() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.section}>
        <Text
          style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}
        >
          ACCOUNT
        </Text>
        <Row
          title="Profile"
          subtitle="Name, email, address"
          onPress={() => router.push('/settings/profile')}
          chevron
        />
        <Row
          title="Email Accounts"
          subtitle="Sender addresses for invoices"
          onPress={() => router.push('/settings/email-accounts')}
          chevron
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});
