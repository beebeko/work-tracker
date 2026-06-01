import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { useDeleteEmailAccount, useEmailAccounts } from '@/src/hooks/useEmailAccounts';
import { useTheme } from '@/src/theme';
import { EmailAccount } from '@/src/types/emailAccount';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Text, TouchableOpacity } from 'react-native';

export default function EmailAccountsScreen() {
  const { data: accounts, isLoading, isError } = useEmailAccounts();
  const deleteAccount = useDeleteEmailAccount();
  const router = useRouter();
  const { colors, typography } = useTheme();

  const [toDelete, setToDelete] = useState<EmailAccount | null>(null);

  if (isLoading)
    return (
      <Screen>
        <EmptyState message="Loading…" />
      </Screen>
    );
  if (isError)
    return (
      <Screen>
        <EmptyState message="Failed to load email accounts" />
      </Screen>
    );

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/(modals)/email-account-form')}>
              <Text style={[typography.body, { color: colors.accent }]}>Add</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <Row
            title={item.displayName}
            subtitle={item.fromAddress + (item.isDefault ? ' · Default' : '')}
            onPress={() =>
              router.push({ pathname: '/(modals)/email-account-form', params: { id: item.id } })
            }
            onLongPress={() => setToDelete(item)}
            chevron
          />
        )}
        ListEmptyComponent={
          <EmptyState
            message="No email accounts yet"
            hint="Tap 'Add' to create a sender address."
          />
        }
      />

      <ConfirmDialog
        visible={toDelete !== null}
        title="Delete Email Account"
        message={`Remove "${toDelete?.displayName}"?`}
        onConfirm={() => {
          if (toDelete) {
            deleteAccount.mutate(toDelete.id);
            setToDelete(null);
          }
        }}
        onCancel={() => setToDelete(null)}
      />
    </Screen>
  );
}
