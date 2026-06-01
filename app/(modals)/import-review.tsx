import { Field } from '@/src/components/ui/Field';
import { Screen } from '@/src/components/ui/Screen';
import { useGigs } from '@/src/hooks/useGigs';
import { usePendingImports, useUpdatePendingImport } from '@/src/hooks/usePendingImports';
import { usePositions } from '@/src/hooks/usePositions';
import { createEntry } from '@/src/services/entries';
import { queryKeys } from '@/src/services/queryKeys';
import { useTheme } from '@/src/theme';
import { MealBreak, WorkEntryType } from '@/src/types/workEntry';
import { resolveConfidenceColor } from '@/src/utils/confidence';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function ImportReviewModal() {
  const { importId } = useLocalSearchParams<{ importId: string }>();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();

  const { data: imports } = usePendingImports();
  const pending = imports?.find((i) => i.id === importId);
  const updateImport = useUpdatePendingImport(importId);

  const clientId = pending?.clientId ?? '';
  const { data: positions } = usePositions(clientId);
  const { data: gigs } = useGigs(clientId);

  // Dynamic mutation — resolves clientId and gigId at call time (gigId comes from state)
  const queryClient = useQueryClient();
  const createEntryMutation = useMutation({
    mutationFn: ({
      cId,
      gId,
      payload,
    }: {
      cId: string;
      gId: string;
      payload: Parameters<typeof createEntry>[2];
    }) => createEntry(cId, gId, payload),
    onSuccess: (_data, { cId, gId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entries.all(cId, gId) });
    },
  });

  const [type, setType] = useState<WorkEntryType>('shift');
  const [date, setDate] = useState('');
  const [gigId, setGigId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  // Pre-fill from extracted data when import loads — guarded so user edits aren't overwritten
  const initialized = useRef(false);
  useEffect(() => {
    if (!pending || !gigs || !positions || initialized.current) return;
    initialized.current = true;
    const ex = pending.extracted;
    setType(ex.entryType);
    setDate(ex.date);
    setNotes(ex.notes ?? '');
    if (ex.entryType === 'shift') {
      setStartTime(ex.startTime ?? '');
      setEndTime(ex.endTime ?? '');
    } else {
      setAmount(ex.amount != null ? String(ex.amount) : '');
    }
    // Auto-match gigHint to an existing gig name (case-insensitive)
    if (ex.gigHint && gigs) {
      const matched = gigs.find((g) => g.name.toLowerCase().includes(ex.gigHint!.toLowerCase()));
      if (matched) setGigId(matched.id);
    }
    // Auto-match positionHint to an existing position name
    if (ex.positionHint && positions) {
      const matched = positions.find((p) =>
        p.name.toLowerCase().includes(ex.positionHint!.toLowerCase()),
      );
      if (matched) setPositionId(matched.id);
    }
  }, [pending, gigs, positions]);

  function validate(): boolean {
    if (!DATE_RE.test(date)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format.');
      return false;
    }
    if (!gigId) {
      Alert.alert('Required', 'Select a gig.');
      return false;
    }
    if (!positionId) {
      Alert.alert('Required', 'Select a position.');
      return false;
    }
    if (type === 'shift') {
      if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
        Alert.alert('Invalid time', 'Use HH:MM (24-hour) format.');
        return false;
      }
    } else {
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) {
        Alert.alert('Invalid amount', 'Enter a valid USD amount.');
        return false;
      }
    }
    return true;
  }

  async function handleConfirm() {
    if (!validate()) return;
    try {
      const base = {
        clientId,
        gigId,
        positionId,
        date,
        notes: notes.trim() || undefined,
        tags: [],
      };
      const payload =
        type === 'shift'
          ? { ...base, type: 'shift' as const, startTime, endTime, mealBreaks: [] as MealBreak[] }
          : {
              ...base,
              type: 'lump_sum' as const,
              amount: parseFloat(amount),
              description: description.trim() || undefined,
            };

      await createEntryMutation.mutateAsync({ cId: clientId, gId: gigId, payload });
      await updateImport.mutateAsync('imported');
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    }
  }

  async function handleDismiss() {
    try {
      await updateImport.mutateAsync('dismissed');
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to dismiss import.');
    }
  }

  const confidence = pending?.extracted.confidence ?? 0;
  const confidenceColor = resolveConfidenceColor(confidence, colors);

  const isBusy = createEntryMutation.isPending || updateImport.isPending;

  if (!pending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Review Import' }} />
        <Text style={[typography.body, { color: colors.textSecondary, padding: spacing.md }]}>
          Import not found.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen flex={false}>
      <Stack.Screen options={{ title: 'Review Import' }} />
      <ScrollView contentContainerStyle={[styles.form, { padding: spacing.lg }]}>
        {/* Confidence indicator */}
        <View style={[styles.confidenceRow, { marginBottom: spacing.md }]}>
          <Text style={[typography.label, { color: colors.textSecondary }]}>AI confidence</Text>
          <Text style={[typography.label, { color: confidenceColor, fontWeight: '600' }]}>
            {Math.round(confidence * 100)}%
          </Text>
        </View>

        {/* Hints row — show what the AI extracted as context */}
        {(pending.extracted.positionHint || pending.extracted.gigHint) && (
          <View
            style={[
              styles.hintBox,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                marginBottom: spacing.md,
              },
            ]}
          >
            {pending.extracted.gigHint && (
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Gig hint: {pending.extracted.gigHint}
              </Text>
            )}
            {pending.extracted.positionHint && (
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Position hint: {pending.extracted.positionHint}
              </Text>
            )}
          </View>
        )}

        <Field
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          placeholder="2026-06-01"
        />

        {/* Gig picker */}
        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: 4 }]}>
          Gig
        </Text>
        <View
          style={[styles.pickerGroup, { borderColor: colors.border, marginBottom: spacing.md }]}
        >
          {(gigs ?? []).map((g) => (
            <Pressable
              key={g.id}
              onPress={() => setGigId(g.id)}
              style={[
                styles.chip,
                { borderColor: gigId === g.id ? colors.accent : colors.border },
                gigId === g.id && { backgroundColor: `${colors.accent}22` },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={g.name}
            >
              <Text
                style={[typography.body, { color: gigId === g.id ? colors.accent : colors.text }]}
              >
                {g.name}
              </Text>
            </Pressable>
          ))}
          {!gigs?.length && (
            <Text style={[typography.caption, { color: colors.textDisabled }]}>
              No gigs for this client
            </Text>
          )}
        </View>

        {/* Position picker */}
        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: 4 }]}>
          Position
        </Text>
        <View
          style={[styles.pickerGroup, { borderColor: colors.border, marginBottom: spacing.md }]}
        >
          {(positions ?? []).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setPositionId(p.id)}
              style={[
                styles.chip,
                { borderColor: positionId === p.id ? colors.accent : colors.border },
                positionId === p.id && { backgroundColor: `${colors.accent}22` },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={p.name}
            >
              <Text
                style={[
                  typography.body,
                  { color: positionId === p.id ? colors.accent : colors.text },
                ]}
              >
                {p.name}
              </Text>
            </Pressable>
          ))}
          {!positions?.length && (
            <Text style={[typography.caption, { color: colors.textDisabled }]}>
              No positions for this client
            </Text>
          )}
        </View>

        {/* Shift fields */}
        {type === 'shift' && (
          <>
            <Field
              label="Start time (HH:MM)"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="08:00"
            />
            <Field
              label="End time (HH:MM)"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="18:00"
            />
          </>
        )}

        {/* Lump sum fields */}
        {type === 'lump_sum' && (
          <>
            <Field
              label="Amount (USD)"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Box rental"
            />
          </>
        )}

        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" />

        {/* Actions */}
        <View style={[styles.actionRow, { marginTop: spacing.lg }]}>
          <Pressable
            onPress={handleDismiss}
            disabled={isBusy}
            style={[styles.btn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Dismiss import"
          >
            <Text style={[typography.body, { color: colors.textSecondary }]}>Dismiss</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={isBusy}
            style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Confirm import"
          >
            <Text style={[typography.body, { color: '#fff' }]}>
              {isBusy ? 'Saving…' : 'Confirm'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 4,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hintBox: {
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    gap: 4,
  },
  pickerGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
  },
  btnPrimary: {
    borderWidth: 0,
  },
});
