import { Field } from '@/src/components/ui/Field';
import { Screen } from '@/src/components/ui/Screen';
import { useCreateEntry, useEntry, useUpdateEntry } from '@/src/hooks/useEntries';
import { usePositions } from '@/src/hooks/usePositions';
import { useTheme } from '@/src/theme';
import { MealBreak, WorkEntryType } from '@/src/types/workEntry';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function EntryFormScreen() {
  const { clientId, gigId, entryId } = useLocalSearchParams<{
    clientId: string;
    gigId: string;
    entryId?: string;
  }>();
  const isEditing = Boolean(entryId);
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();

  const { data: existing } = useEntry(clientId, gigId, entryId ?? '');
  const { data: positions } = usePositions(clientId);
  const createEntry = useCreateEntry(clientId, gigId);
  const updateEntry = useUpdateEntry(clientId, gigId, entryId ?? '');

  const [type, setType] = useState<WorkEntryType>('shift');
  const [date, setDate] = useState('');
  const [positionId, setPositionId] = useState('');
  const [notes, setNotes] = useState('');

  // Shift fields
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [mealBreaks, setMealBreaks] = useState<MealBreak[]>([]);

  // Lump sum fields
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  // Validation errors
  const [dateError, setDateError] = useState<string>();
  const [positionError, setPositionError] = useState<string>();
  const [startTimeError, setStartTimeError] = useState<string>();
  const [endTimeError, setEndTimeError] = useState<string>();
  const [amountError, setAmountError] = useState<string>();

  useEffect(() => {
    if (existing) {
      setType(existing.type);
      setDate(existing.date);
      setPositionId(existing.positionId);
      setNotes(existing.notes ?? '');
      if (existing.type === 'shift') {
        setStartTime(existing.startTime);
        setEndTime(existing.endTime);
        setMealBreaks(existing.mealBreaks);
      } else {
        setAmount(String(existing.amount));
        setDescription(existing.description ?? '');
      }
    }
  }, [existing]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Entry' : 'New Entry' });
  }, [navigation, isEditing]);

  function validate(): boolean {
    let valid = true;
    if (!date || !DATE_RE.test(date)) {
      setDateError('Use YYYY-MM-DD format');
      valid = false;
    } else {
      setDateError(undefined);
    }
    if (!positionId) {
      setPositionError('Select a position');
      valid = false;
    } else {
      setPositionError(undefined);
    }
    if (type === 'shift') {
      if (!startTime || !TIME_RE.test(startTime)) {
        setStartTimeError('Use HH:MM format (24-hour)');
        valid = false;
      } else {
        setStartTimeError(undefined);
      }
      if (!endTime || !TIME_RE.test(endTime)) {
        setEndTimeError('Use HH:MM format (24-hour)');
        valid = false;
      } else {
        setEndTimeError(undefined);
      }
    } else {
      const parsed = parseFloat(amount);
      if (!amount || isNaN(parsed) || parsed <= 0) {
        setAmountError('Enter a valid amount');
        valid = false;
      } else {
        setAmountError(undefined);
      }
    }
    return valid;
  }

  function addMealBreak() {
    setMealBreaks((prev) => [...prev, { startTime: '', endTime: '' }]);
  }

  function removeMealBreak(index: number) {
    setMealBreaks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMealBreak(index: number, field: keyof MealBreak, value: string) {
    setMealBreaks((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    try {
      const base = {
        clientId,
        gigId,
        positionId,
        date,
        notes: notes.trim() || undefined,
        tags: existing?.tags ?? [],
      };
      const payload =
        type === 'shift'
          ? {
              ...base,
              type: 'shift' as const,
              startTime,
              endTime,
              mealBreaks: mealBreaks.filter((b) => b.startTime && b.endTime),
            }
          : {
              ...base,
              type: 'lump_sum' as const,
              amount: parseFloat(amount),
              description: description.trim() || undefined,
            };
      if (isEditing) {
        await updateEntry.mutateAsync(payload);
      } else {
        await createEntry.mutateAsync(payload);
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save entry. Please try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    type,
    date,
    positionId,
    notes,
    startTime,
    endTime,
    mealBreaks,
    amount,
    description,
    isEditing,
    existing,
    clientId,
    gigId,
    updateEntry,
    createEntry,
    router,
  ]);

  const isBusy = createEntry.isPending || updateEntry.isPending;

  return (
    <Screen flex={false}>
      <ScrollView contentContainerStyle={[styles.form, { padding: spacing.lg }]}>
        {/* Type toggle */}
        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
          Type
        </Text>
        <View style={[styles.typeRow, { marginBottom: spacing.lg }]}>
          {(['shift', 'lump_sum'] as WorkEntryType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[
                styles.typeChip,
                {
                  borderColor: type === t ? colors.accent : colors.border,
                  backgroundColor: type === t ? `${colors.accent}22` : colors.surface,
                  flex: 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: type === t }}
            >
              <Text
                style={[
                  typography.label,
                  { color: type === t ? colors.accent : colors.textSecondary },
                ]}
              >
                {t === 'shift' ? 'Shift' : 'Lump Sum'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          error={dateError}
          placeholder="e.g. 2025-03-15"
          keyboardType="numeric"
        />

        {/* Position picker */}
        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
          Position
        </Text>
        {positionError ? (
          <Text style={[typography.caption, { color: colors.danger, marginBottom: spacing.sm }]}>
            {positionError}
          </Text>
        ) : null}
        {!positions?.length ? (
          <Text
            style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}
          >
            No positions yet — create a position first.
          </Text>
        ) : (
          <View style={{ marginBottom: spacing.lg }}>
            {positions.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPositionId(p.id)}
                style={[
                  styles.positionOption,
                  {
                    borderColor: positionId === p.id ? colors.accent : colors.border,
                    backgroundColor: positionId === p.id ? `${colors.accent}22` : colors.surface,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: positionId === p.id }}
              >
                <Text style={[typography.body, { color: colors.text }]}>{p.name}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  ${p.baseRate}/hr
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Shift fields */}
        {type === 'shift' && (
          <>
            <Field
              label="Start Time (HH:MM)"
              value={startTime}
              onChangeText={setStartTime}
              error={startTimeError}
              placeholder="e.g. 07:00"
              keyboardType="numeric"
            />
            <Field
              label="End Time (HH:MM)"
              value={endTime}
              onChangeText={setEndTime}
              error={endTimeError}
              placeholder="e.g. 15:30"
              keyboardType="numeric"
            />

            <Text
              style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}
            >
              Meal Breaks
            </Text>
            {mealBreaks.map((b, i) => (
              <View key={i} style={[styles.breakRow, { marginBottom: spacing.sm }]}>
                <View style={styles.breakInputs}>
                  <Field
                    label={`Break ${i + 1} Start`}
                    value={b.startTime}
                    onChangeText={(v) => updateMealBreak(i, 'startTime', v)}
                    placeholder="HH:MM"
                    keyboardType="numeric"
                    style={styles.halfInput}
                  />
                  <Field
                    label="End"
                    value={b.endTime}
                    onChangeText={(v) => updateMealBreak(i, 'endTime', v)}
                    placeholder="HH:MM"
                    keyboardType="numeric"
                    style={styles.halfInput}
                  />
                </View>
                <Pressable
                  onPress={() => removeMealBreak(i)}
                  style={[styles.removeBreak, { borderColor: colors.danger }]}
                  accessibilityLabel="Remove meal break"
                >
                  <Text style={[typography.label, { color: colors.danger }]}>×</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={addMealBreak}
              style={[styles.addBreakButton, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Text style={[typography.label, { color: colors.textSecondary }]}>
                + Add Meal Break
              </Text>
            </Pressable>
          </>
        )}

        {/* Lump sum fields */}
        {type === 'lump_sum' && (
          <>
            <Field
              label="Amount (USD)"
              value={amount}
              onChangeText={setAmount}
              error={amountError}
              placeholder="e.g. 500.00"
              keyboardType="decimal-pad"
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional"
              multiline
              numberOfLines={2}
            />
          </>
        )}

        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          multiline
          numberOfLines={2}
        />

        <Pressable
          onPress={handleSave}
          disabled={isBusy}
          style={[styles.saveButton, { backgroundColor: colors.accent, opacity: isBusy ? 0.6 : 1 }]}
          accessibilityRole="button"
        >
          <Text style={[typography.label, { color: '#fff' }]}>{isBusy ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    flexGrow: 1,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    borderRadius: 4,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  positionOption: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  breakInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  removeBreak: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  addBreakButton: {
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 16,
    borderStyle: 'dashed',
  },
  saveButton: {
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
});
