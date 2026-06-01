import { Field } from '@/src/components/ui/Field';
import { Screen } from '@/src/components/ui/Screen';
import {
    useCreateEmailAccount,
    useEmailAccounts,
    useUpdateEmailAccount,
} from '@/src/hooks/useEmailAccounts';
import { useTheme } from '@/src/theme';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function EmailAccountFormModal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: accounts } = useEmailAccounts();
  const existing = id ? accounts?.find((a) => a.id === id) : undefined;

  const createAccount = useCreateEmailAccount();
  const updateAccount = useUpdateEmailAccount(id ?? '');
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (existing) {
      setDisplayName(existing.displayName);
      setFromAddress(existing.fromAddress);
      setIsDefault(existing.isDefault);
    }
  }, [existing]);

  const title = id ? 'Edit Email Account' : 'New Email Account';
  const isPending = createAccount.isPending || updateAccount.isPending;

  function handleSave() {
    if (!displayName.trim() || !fromAddress.trim()) {
      Alert.alert('Required', 'Display name and email address are required.');
      return;
    }

    const data = { displayName: displayName.trim(), fromAddress: fromAddress.trim(), isDefault };

    if (id) {
      updateAccount.mutate(data, {
        onSuccess: () => router.back(),
        onError: () => Alert.alert('Error', 'Failed to update email account.'),
      });
    } else {
      createAccount.mutate(data, {
        onSuccess: () => router.back(),
        onError: () => Alert.alert('Error', 'Failed to create email account.'),
      });
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <View style={[styles.form, { padding: spacing.md }]}>
        <Field
          label="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder='e.g. "Work"'
        />

        <Field
          label="Email Address"
          value={fromAddress}
          onChangeText={setFromAddress}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={styles.switchRow}>
          <Text style={[typography.label, { color: colors.text }]}>Default sender</Text>
          <Switch value={isDefault} onValueChange={setIsDefault} />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          disabled={isPending}
        >
          <Text style={[typography.body, { color: '#fff' }]}>
            {isPending ? 'Saving…' : id ? 'Update' : 'Create'}
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  saveBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
});
