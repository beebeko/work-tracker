import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { useDeletePosition, usePositions } from '@/src/hooks/usePositions';
import { useTheme } from '@/src/theme';
import { Position } from '@/src/types/position';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

export default function PositionsScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { data: positions, isLoading, isError } = usePositions(clientId);
  const deletePosition = useDeletePosition(clientId);
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, typography } = useTheme();

  const [pendingDelete, setPendingDelete] = useState<Position | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: 'Positions',
      headerRight: () => (
        <Pressable
          onPress={() => router.push({ pathname: '/(modals)/position-form', params: { clientId } })}
          style={{ marginRight: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Add position"
        >
          <Text style={{ color: colors.accent, fontSize: 28, lineHeight: 32 }}>+</Text>
        </Pressable>
      ),
    });
  }, [navigation, router, clientId, colors.accent]);

  function confirmDelete(position: Position) {
    setPendingDelete(position);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    await deletePosition.mutateAsync(pendingDelete.id);
    setPendingDelete(null);
  }

  if (isLoading) {
    return (
      <Screen>
        <EmptyState message="Loading positions…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <EmptyState
          message="Failed to load positions"
          hint="Check your connection and try again."
        />
      </Screen>
    );
  }

  return (
    <Screen flex={false}>
      <FlatList
        data={positions ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, !positions?.length && styles.emptyList]}
        ListEmptyComponent={
          <EmptyState message="No positions yet" hint="Tap + to add a position for this client." />
        }
        renderItem={({ item }) => (
          <Row
            title={item.name}
            subtitle={`$${item.baseRate}/hr`}
            chevron
            onPress={() =>
              router.push({
                pathname: '/(modals)/position-form',
                params: { clientId, positionId: item.id },
              })
            }
            onLongPress={() => confirmDelete(item)}
          />
        )}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete Position"
        message={`Delete "${pendingDelete?.name}"? This cannot be undone.`}
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
