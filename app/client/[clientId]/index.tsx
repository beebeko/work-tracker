import { Badge } from '@/src/components/ui/Badge';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { useClient } from '@/src/hooks/useClients';
import { useGigs } from '@/src/hooks/useGigs';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet } from 'react-native';

export default function ClientGigsScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { data: client } = useClient(clientId);
  const { data: gigs, isLoading, isError } = useGigs(clientId);
  const navigation = useNavigation();
  const router = useRouter();

  useEffect(() => {
    if (client) {
      navigation.setOptions({ title: client.name });
    }
  }, [client, navigation]);

  if (isLoading) {
    return (
      <Screen>
        <EmptyState message="Loading gigs…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <EmptyState message="Failed to load gigs" hint="Check your connection and try again." />
      </Screen>
    );
  }

  return (
    <Screen flex={false}>
      <FlatList
        data={gigs ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, !gigs?.length && styles.emptyList]}
        ListEmptyComponent={
          <EmptyState message="No gigs yet" hint="Add a gig for this client to get started." />
        }
        renderItem={({ item }) => (
          <Row
            title={item.name}
            subtitle={item.startDate ? item.startDate : undefined}
            right={<Badge status={item.status} />}
            chevron
            onPress={() => router.push(`/client/${clientId}/gig/${item.id}`)}
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
