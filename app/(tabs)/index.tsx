import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { useClients, useDeleteClient } from '@/src/hooks/useClients';
import { useTheme } from '@/src/theme';
import { Client } from '@/src/types/client';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

export default function ClientsScreen() {
  const { data: clients, isLoading, isError } = useClients();
  const deleteClient = useDeleteClient();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => router.push('/(modals)/client-form')}
          style={{ marginRight: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Add client"
        >
          <Text style={{ color: colors.accent, fontSize: 28, lineHeight: 32 }}>+</Text>
        </Pressable>
      ),
    });
  }, [navigation, router, colors.accent]);

  async function handleDelete() {
    if (!pendingDelete) return;
    await deleteClient.mutateAsync(pendingDelete.id);
    setPendingDelete(null);
  }

  if (isLoading) {
    return (
      <Screen>
        <EmptyState message="Loading clients…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <EmptyState message="Failed to load clients" hint="Check your connection and try again." />
      </Screen>
    );
  }

  return (
    <Screen flex={false}>
      <FlatList
        data={clients ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { backgroundColor: colors.background },
          !clients?.length && styles.emptyList,
        ]}
        style={{ backgroundColor: colors.background }}
        ListEmptyComponent={
          <EmptyState message="No clients yet" hint="Tap + to add your first client." />
        }
        renderItem={({ item }) => (
          <Row
            title={item.name}
            subtitle={item.email ?? undefined}
            chevron
            onPress={() => router.push(`/client/${item.id}`)}
            onLongPress={() => setPendingDelete(item)}
          />
        )}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete Client"
        message={`Delete "${pendingDelete?.name}"? This will not delete their gigs or entries.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
  },
  emptyList: {
    flex: 1,
  },
});
