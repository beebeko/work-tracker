import { Field } from '@/src/components/ui/Field';
import { Screen } from '@/src/components/ui/Screen';
import { useCreateGig, useGig, useUpdateGig } from '@/src/hooks/useGigs';
import { useTheme } from '@/src/theme';
import { GigStatus } from '@/src/types/gig';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const GIG_STATUSES: GigStatus[] = ['active', 'complete', 'cancelled', 'on_hold'];
const STATUS_LABELS: Record<GigStatus, string> = {
  active: 'Active',
  complete: 'Complete',
  cancelled: 'Cancelled',
  on_hold: 'On Hold',
};

export default function GigFormScreen() {
  const { clientId, gigId } = useLocalSearchParams<{ clientId: string; gigId?: string }>();
  const isEditing = Boolean(gigId);
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();

  const { data: existing } = useGig(clientId, gigId ?? '');
  const createGig = useCreateGig(clientId);
  const updateGig = useUpdateGig(clientId, gigId ?? '');

  const [name, setName] = useState('');
  const [status, setStatus] = useState<GigStatus>('active');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [startDateError, setStartDateError] = useState<string>();
  const [endDateError, setEndDateError] = useState<string>();

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setStatus(existing.status);
      setStartDate(existing.startDate ?? '');
      setEndDate(existing.endDate ?? '');
      setNotes(existing.notes ?? '');
    }
  }, [existing]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Gig' : 'New Gig' });
  }, [navigation, isEditing]);

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function validate(): boolean {
    let valid = true;
    if (!name.trim()) {
      setNameError('Name is required');
      valid = false;
    } else {
      setNameError(undefined);
    }
    if (startDate && !DATE_RE.test(startDate)) {
      setStartDateError('Use YYYY-MM-DD format');
      valid = false;
    } else {
      setStartDateError(undefined);
    }
    if (endDate && !DATE_RE.test(endDate)) {
      setEndDateError('Use YYYY-MM-DD format');
      valid = false;
    } else {
      setEndDateError(undefined);
    }
    return valid;
  }

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    try {
      const payload = {
        clientId,
        name: name.trim(),
        status,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: existing?.tags ?? [],
      };
      if (isEditing) {
        await updateGig.mutateAsync(payload);
      } else {
        await createGig.mutateAsync(payload);
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save gig. Please try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    name,
    status,
    startDate,
    endDate,
    notes,
    isEditing,
    existing,
    clientId,
    updateGig,
    createGig,
    router,
  ]);

  const isBusy = createGig.isPending || updateGig.isPending;

  return (
    <Screen flex={false}>
      <ScrollView contentContainerStyle={[styles.form, { padding: spacing.lg }]}>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          error={nameError}
          placeholder="Gig name"
          autoCapitalize="words"
          autoFocus={!isEditing}
        />

        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
          Status
        </Text>
        <View style={[styles.statusRow, { marginBottom: spacing.lg }]}>
          {GIG_STATUSES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={[
                styles.statusChip,
                {
                  borderColor: status === s ? colors.accent : colors.border,
                  backgroundColor: status === s ? `${colors.accent}22` : colors.surface,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: status === s }}
            >
              <Text
                style={[
                  typography.caption,
                  { color: status === s ? colors.accent : colors.textSecondary },
                ]}
              >
                {STATUS_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="Start Date (YYYY-MM-DD)"
          value={startDate}
          onChangeText={setStartDate}
          error={startDateError}
          placeholder="e.g. 2025-01-15"
          keyboardType="numeric"
        />
        <Field
          label="End Date (YYYY-MM-DD)"
          value={endDate}
          onChangeText={setEndDate}
          error={endDateError}
          placeholder="Optional"
          keyboardType="numeric"
        />
        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          multiline
          numberOfLines={3}
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
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  saveButton: {
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
});
