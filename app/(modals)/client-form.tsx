import { Field } from '@/src/components/ui/Field';
import { Screen } from '@/src/components/ui/Screen';
import { useClient, useClients, useCreateClient, useUpdateClient } from '@/src/hooks/useClients';
import { useEmailAccounts } from '@/src/hooks/useEmailAccounts';
import { useTheme } from '@/src/theme';
import { DEFAULT_OVERTIME_RULES } from '@/src/types/client';
import { generateInvoicePrefix } from '@/src/utils/invoicePrefix';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ClientFormScreen() {
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const isEditing = Boolean(clientId);
  const navigation = useNavigation();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();

  const { data: existing } = useClient(clientId ?? '');
  const { data: allClients } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient(clientId ?? '');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('');
  const [defaultEmailAccountId, setDefaultEmailAccountId] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();

  const { data: emailAccounts } = useEmailAccounts();

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setEmail(existing.email);
      setAddress(existing.address ?? '');
      setNotes(existing.notes ?? '');
      setInvoicePrefix(existing.invoicePrefix ?? '');
      setDefaultEmailAccountId(existing.defaultEmailAccountId);
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
        invoicePrefix: invoicePrefix.trim().toUpperCase(),
        nextInvoiceSeq: existing?.nextInvoiceSeq ?? 1,
        defaultEmailAccountId: defaultEmailAccountId || undefined,
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
  }, [
    name,
    email,
    address,
    notes,
    invoicePrefix,
    defaultEmailAccountId,
    isEditing,
    existing,
    updateClient,
    createClient,
    router,
  ]);

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

        <Field
          label="Invoice Prefix"
          value={invoicePrefix}
          onChangeText={(t) => setInvoicePrefix(t.toUpperCase())}
          onBlur={() => {
            if (!invoicePrefix && name) {
              const existingPrefixes = (allClients ?? [])
                .filter((c) => c.id !== clientId)
                .map((c) => c.invoicePrefix)
                .filter(Boolean);
              setInvoicePrefix(generateInvoicePrefix(name, existingPrefixes));
            }
          }}
          placeholder="e.g. AP (auto-generated)"
          autoCapitalize="characters"
        />

        {emailAccounts && emailAccounts.length > 0 && (
          <View>
            <Text style={[typography.label, { color: colors.textSecondary, marginBottom: 6 }]}>
              Default Sender Email
            </Text>
            <FlatList
              data={emailAccounts}
              keyExtractor={(a) => a.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() =>
                    setDefaultEmailAccountId(
                      item.id === defaultEmailAccountId ? undefined : item.id,
                    )
                  }
                  style={[
                    styles.emailRow,
                    {
                      borderColor:
                        item.id === defaultEmailAccountId ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={[typography.body, { color: colors.text }]}>
                    {item.displayName} &lt;{item.fromAddress}&gt;
                    {item.id === defaultEmailAccountId ? ' ✓' : ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

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
  emailRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  saveButton: {
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
});
