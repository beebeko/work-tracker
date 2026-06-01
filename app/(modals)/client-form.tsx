import { Field } from '@/src/components/ui/Field';
import { Screen } from '@/src/components/ui/Screen';
import { useClient, useCreateClient, useUpdateClient } from '@/src/hooks/useClients';
import { DEFAULT_OVERTIME_RULES } from '@/src/types/client';
import { useTheme } from '@/src/theme';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export default function ClientFormScreen() {
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const isEditing = Boolean(clientId);
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();

  const { data: existing } = useClient(clientId ?? '');
  const createClient = useCreateClient();
  const updateClient = useUpdateClient(clientId ?? '');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setEmail(existing.email);
      setAddress(existing.address ?? '');
      setNotes(existing.notes ?? '');
    }
  }, [existing]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Client' : 'New Client' });
  }, [navigation, isEditing]);

  function validate(): boolean {
    let valid = true;
    if (!name.trim()) {
      setNameError('Name is required');
      valid = false;
    } else {
      setNameError(undefined);
    }
    if (!email.trim()) {
      setEmailError('Email is required');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Enter a valid email address');
      valid = false;
    } else {
      setEmailError(undefined);
    }
    return valid;
  }

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        overtimeRules: existing?.overtimeRules ?? DEFAULT_OVERTIME_RULES,
      };
      if (isEditing) {
        await updateClient.mutateAsync(payload);
      } else {
        await createClient.mutateAsync(payload);
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save client. Please try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, email, address, notes, isEditing, existing, updateClient, createClient, router]);

  const isBusy = createClient.isPending || updateClient.isPending;

  return (
    <Screen flex={false}>
      <ScrollView contentContainerStyle={[styles.form, { padding: spacing.lg }]}>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          error={nameError}
          placeholder="Client name"
          autoCapitalize="words"
          autoFocus={!isEditing}
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={emailError}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Optional"
          multiline
          numberOfLines={2}
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
          <Text style={[typography.label, { color: '#fff' }]}>
            {isBusy ? 'Saving…' : 'Save'}
          </Text>
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
