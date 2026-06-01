import { Badge } from '@/src/components/ui/Badge';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { useClient } from '@/src/hooks/useClients';
import { useDeleteGig, useGigs } from '@/src/hooks/useGigs';
import { useTheme } from '@/src/theme';
import { Gig } from '@/src/types/gig';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

export default function ClientGigsScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { data: client } = useClient(clientId);
  const { data: gigs, isLoading, isError } = useGigs(clientId);
  const deleteGig = useDeleteGig(clientId);
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, typography } = useTheme();

  const [pendingDelete, setPendingDelete] = useState<Gig | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: client?.name ?? 'Gigs',
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 16, marginRight: 4 }}>
          <Pressable
            onPress={() => router.push({ pathname: '/(modals)/client-form', params: { clientId } })}
            accessibilityRole="button"
            accessibilityLabel="Edit client"
          >
            <Text style={{ color: colors.accent, fontSize: 15 }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/client/${clientId}/positions` as never)}
            accessibilityRole="button"
            accessibilityLabel="Manage positions"
          >
            <Text style={{ color: colors.accent, fontSize: 15 }}>Positions</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/(modals)/gig-form', params: { clientId } })}
            accessibilityRole="button"
            accessibilityLabel="Add gig"
          >
            <Text style={{ color: colors.accent, fontSize: 28, lineHeight: 32 }}>+</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, client, router, clientId, colors.accent]);

  async function handleDelete() {
    if (!pendingDelete) return;
    await deleteGig.mutateAsync(pendingDelete.id);
    setPendingDelete(null);
  }

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
          <EmptyState message="No gigs yet" hint="Tap + to add a gig for this client." />
        }
        renderItem={({ item }) => (
          <Row
            title={item.name}
            subtitle={item.startDate ? item.startDate : undefined}
            right={<Badge status={item.status} />}
            chevron
            onPress={() => router.push(`/client/${clientId}/gig/${item.id}`)}
            onLongPress={() => setPendingDelete(item)}
          />
        )}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete Gig"
        message={`Delete "${pendingDelete?.name}"? This will not delete its entries.`}
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
