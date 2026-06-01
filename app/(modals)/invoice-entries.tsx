/**
 * Invoice entry selector modal.
 *
 * Route params: clientId (required), gigId (required), invoiceId? (regeneration)
 *
 * Shows all work entries for the gig. Pre-selects entries not yet invoiced.
 * Tapping an entry toggles its inclusion. "Generate" calls generateInvoice Cloud Function.
 */
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { formatDate } from '@/src/components/ui/format';
import { useEntries } from '@/src/hooks/useEntries';
import { useGenerateInvoice } from '@/src/hooks/useInvoiceActions';
import { useInvoicesByGig } from '@/src/hooks/useInvoices';
import { useTheme } from '@/src/theme';
import { WorkEntry } from '@/src/types/workEntry';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity } from 'react-native';

function entryLabel(entry: WorkEntry): string {
  if (entry.type === 'lump_sum') {
    return entry.description ?? 'Lump sum';
  }
  return `${formatDate(entry.date)} ${entry.startTime}–${entry.endTime}`;
}

function entrySublabel(entry: WorkEntry): string {
  if (entry.type === 'lump_sum') return `$${entry.amount.toFixed(2)}`;
  return entry.date;
}

export default function InvoiceEntriesModal() {
  const { clientId, gigId, invoiceId } = useLocalSearchParams<{
    clientId: string;
    gigId: string;
    invoiceId?: string;
  }>();
  const router = useRouter();
  const { colors, typography } = useTheme();

  const { data: entries, isLoading: loadingEntries } = useEntries(clientId, gigId);
  const { data: existingInvoices } = useInvoicesByGig(gigId);
  const generateInvoice = useGenerateInvoice();

  // Build set of already-invoiced entry IDs (excluding the invoice being regenerated)
  const alreadyInvoicedIds = new Set(
    (existingInvoices ?? []).filter((inv) => inv.id !== invoiceId).flatMap((inv) => inv.entryIds),
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Pre-select uninvoiced entries once data is loaded
  useEffect(() => {
    if (entries) {
      const preSelected = entries.filter((e) => !alreadyInvoicedIds.has(e.id)).map((e) => e.id);
      setSelected(new Set(preSelected));
    }
    // Run when entries or existing invoices load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, existingInvoices]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleGenerate() {
    if (selected.size === 0) {
      Alert.alert('No entries selected', 'Select at least one entry to invoice.');
      return;
    }
    try {
      const result = await generateInvoice.mutateAsync({
        clientId,
        gigId,
        entryIds: [...selected],
        invoiceId: invoiceId ?? undefined,
      });
      router.replace(`/invoice/${result.invoiceId}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to generate invoice. Please try again.');
    }
  }

  if (loadingEntries) {
    return (
      <Screen>
        <EmptyState message="Loading entries…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: invoiceId ? 'Regenerate Invoice' : 'Select Entries',
          headerRight: () => (
            <TouchableOpacity onPress={handleGenerate} disabled={generateInvoice.isPending}>
              <Text style={[typography.body, { color: colors.accent }]}>
                {generateInvoice.isPending ? 'Generating…' : 'Generate'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={entries ?? []}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Row
            title={entryLabel(item)}
            subtitle={entrySublabel(item)}
            onPress={alreadyInvoicedIds.has(item.id) ? undefined : () => toggle(item.id)}
            right={
              <Text style={{ color: selected.has(item.id) ? colors.accent : colors.border }}>
                {selected.has(item.id) ? '✓' : '○'}
              </Text>
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            message="No entries found"
            hint="Add shift or lump-sum entries to this gig first."
          />
        }
      />
    </Screen>
  );
}
