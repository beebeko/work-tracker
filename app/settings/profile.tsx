import { EmptyState } from '@/src/components/ui/EmptyState';
import { Field } from '@/src/components/ui/Field';
import { Screen } from '@/src/components/ui/Screen';
import { useUpsertUserProfile, useUserProfile } from '@/src/hooks/useUserProfile';
import { useTheme } from '@/src/theme';
import { UpdateUserProfileInput } from '@/src/types/userProfile';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { data: profile, isLoading } = useUserProfile();
  const upsert = useUpsertUserProfile();
  const { colors, typography, spacing } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setEmail(profile.email ?? '');
      setAddress(profile.address ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  if (isLoading) {
    return (
      <Screen>
        <EmptyState message="Loading profile…" />
      </Screen>
    );
  }

  function handleSave() {
    const data: UpdateUserProfileInput = { name, email };
    if (address) data.address = address;
    if (phone) data.phone = phone;
    upsert.mutate(data, {
      onSuccess: () => Alert.alert('Saved', 'Profile updated.'),
      onError: () => Alert.alert('Error', 'Failed to save profile.'),
    });
  }

  return (
    <Screen>
      <View style={[styles.form, { padding: spacing.md }]}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Street, City, State"
        />
        <Field
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="555-555-5555"
          keyboardType="phone-pad"
        />

        {/* TODO: logo support */}

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          disabled={upsert.isPending}
        >
          <Text style={[typography.body, { color: '#fff' }]}>
            {upsert.isPending ? 'Saving…' : 'Save Profile'}
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  saveBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
});
