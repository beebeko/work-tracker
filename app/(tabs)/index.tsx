import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { useClients } from '@/src/hooks/useClients';
import { useTheme } from '@/src/theme';
import { Client } from '@/src/types/client';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';

export default function ClientsScreen() {
  const { data: clients, isLoading, isError } = useClients();
  const router = useRouter();
  const { colors } = useTheme();

  function handleSelectClient(client: Client) {
    router.push(`/client/${client.id}`);
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
          <EmptyState message="No clients yet" hint="Add a client to get started." />
        }
        renderItem={({ item }) => (
          <Row
            title={item.name}
            subtitle={item.email ?? undefined}
            chevron
            onPress={() => handleSelectClient(item)}
          />
        )}
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
