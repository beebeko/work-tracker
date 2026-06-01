import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { formatDate, formatHours, formatMoney } from '@/src/components/ui/format';
import { useDeleteEntry, useEntries } from '@/src/hooks/useEntries';
import { useGig } from '@/src/hooks/useGigs';
import { useTheme } from '@/src/theme';
import { WorkEntry } from '@/src/types/workEntry';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

function entrySubtitle(entry: WorkEntry): string {
  if (entry.type === 'lump_sum') {
    return formatMoney(entry.amount);
  }
  const totalMins = entry.mealBreaks.reduce((sum, b) => {
    const [bsh, bsm] = b.startTime.split(':').map(Number);
    const [beh, bem] = b.endTime.split(':').map(Number);
    const bStart = bsh * 60 + bsm;
    const bEnd = beh * 60 + bem;
    return sum + (bEnd >= bStart ? bEnd - bStart : 1440 - bStart + bEnd);
  }, 0);
  const rawMins =
    (() => {
      const [sh, sm] = entry.startTime.split(':').map(Number);
      const [eh, em] = entry.endTime.split(':').map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      return end >= start ? end - start : 1440 - start + end;
    })() - totalMins;
  return formatHours(rawMins / 60);
}

export default function GigEntriesScreen() {
  const { clientId, gigId } = useLocalSearchParams<{ clientId: string; gigId: string }>();
  const { data: gig } = useGig(clientId, gigId);
  const { data: entries, isLoading, isError } = useEntries(clientId, gigId);
  const deleteEntry = useDeleteEntry(clientId, gigId);
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, typography } = useTheme();

  const [pendingDelete, setPendingDelete] = useState<WorkEntry | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: gig?.name ?? 'Entries',
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 16, marginRight: 4 }}>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/(modals)/gig-form', params: { clientId, gigId } })
            }
            accessibilityRole="button"
            accessibilityLabel="Edit gig"
          >
            <Text style={{ color: colors.accent, fontSize: 15 }}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(modals)/invoice-entries',
                params: { clientId, gigId },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Create invoice"
          >
            <Text style={{ color: colors.accent, fontSize: 15 }}>Invoice</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(modals)/entry-form',
                params: { clientId, gigId },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Add entry"
          >
            <Text style={{ color: colors.accent, fontSize: 28, lineHeight: 32 }}>+</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, gig, router, clientId, gigId, colors.accent]);

  async function handleDelete() {
    if (!pendingDelete) return;
    await deleteEntry.mutateAsync(pendingDelete.id);
    setPendingDelete(null);
  }

  if (isLoading) {
    return (
      <Screen>
        <EmptyState message="Loading entries…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <EmptyState message="Failed to load entries" hint="Check your connection and try again." />
      </Screen>
    );
  }

  return (
    <Screen flex={false}>
      <FlatList
        data={entries ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, !entries?.length && styles.emptyList]}
        ListEmptyComponent={
          <EmptyState message="No entries yet" hint="Tap + to log hours or a lump sum." />
        }
        renderItem={({ item }) => (
          <Row
            title={formatDate(item.date)}
            subtitle={entrySubtitle(item)}
            chevron
            onPress={() =>
              router.push({
                pathname: '/(modals)/entry-form',
                params: { clientId, gigId, entryId: item.id },
              })
            }
            onLongPress={() => setPendingDelete(item)}
          />
        )}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete Entry"
        message={`Delete this entry from ${pendingDelete ? formatDate(pendingDelete.date) : ''}? This cannot be undone.`}
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
