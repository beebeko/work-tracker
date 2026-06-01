import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { formatDate, formatHours, formatMoney } from '@/src/components/ui/format';
import { useEntries } from '@/src/hooks/useEntries';
import { useGig } from '@/src/hooks/useGigs';
import { WorkEntry } from '@/src/types/workEntry';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet } from 'react-native';

function entrySubtitle(entry: WorkEntry): string {
  if (entry.type === 'lump_sum') {
    return formatMoney(entry.amount);
  }
  const totalMins = entry.mealBreaks.reduce((sum, b) => sum + b.durationMinutes, 0);
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
  const navigation = useNavigation();

  useEffect(() => {
    if (gig) {
      navigation.setOptions({ title: gig.name });
    }
  }, [gig, navigation]);

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
          <EmptyState message="No entries yet" hint="Log hours or a lump sum to get started." />
        }
        renderItem={({ item }) => (
          <Row title={formatDate(item.date)} subtitle={entrySubtitle(item)} />
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
