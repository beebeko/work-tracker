import { Field } from '@/src/components/ui/Field';
import { Screen } from '@/src/components/ui/Screen';
import { useCreatePosition, usePosition, useUpdatePosition } from '@/src/hooks/usePositions';
import { useTheme } from '@/src/theme';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export default function PositionFormScreen() {
  const { clientId, positionId } = useLocalSearchParams<{
    clientId: string;
    positionId?: string;
  }>();
  const isEditing = Boolean(positionId);
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();

  const { data: existing } = usePosition(clientId, positionId ?? '');
  const createPosition = useCreatePosition(clientId);
  const updatePosition = useUpdatePosition(clientId, positionId ?? '');

  const [name, setName] = useState('');
  const [baseRate, setBaseRate] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [baseRateError, setBaseRateError] = useState<string>();

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setBaseRate(String(existing.baseRate));
    }
  }, [existing]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Position' : 'New Position' });
  }, [navigation, isEditing]);

  function validate(): boolean {
    let valid = true;
    if (!name.trim()) {
      setNameError('Name is required');
      valid = false;
    } else {
      setNameError(undefined);
    }
    const rate = parseFloat(baseRate);
    if (!baseRate.trim()) {
      setBaseRateError('Base rate is required');
      valid = false;
    } else if (isNaN(rate) || rate <= 0) {
      setBaseRateError('Enter a valid hourly rate');
      valid = false;
    } else {
      setBaseRateError(undefined);
    }
    return valid;
  }

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    try {
      const payload = {
        clientId,
        name: name.trim(),
        baseRate: parseFloat(baseRate),
      };
      if (isEditing) {
        await updatePosition.mutateAsync(payload);
      } else {
        await createPosition.mutateAsync(payload);
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save position. Please try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, baseRate, isEditing, clientId, updatePosition, createPosition, router]);

  const isBusy = createPosition.isPending || updatePosition.isPending;

  return (
    <Screen flex={false}>
      <ScrollView contentContainerStyle={[styles.form, { padding: spacing.lg }]}>
        <Field
          label="Position Name"
          value={name}
          onChangeText={setName}
          error={nameError}
          placeholder="e.g. Camera Operator"
          autoCapitalize="words"
          autoFocus={!isEditing}
        />
        <Field
          label="Hourly Rate (USD)"
          value={baseRate}
          onChangeText={setBaseRate}
          error={baseRateError}
          placeholder="e.g. 65.00"
          keyboardType="decimal-pad"
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
  saveButton: {
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
});
