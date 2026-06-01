import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import {
    useClientSenders,
    useCreateClientSender,
    useDeleteClientSender,
} from '@/src/hooks/useClientSenders';
import { useTheme } from '@/src/theme';
import { ClientSender, SenderPatternType } from '@/src/types/clientSender';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function ClientSendersScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { data: senders, isLoading, isError } = useClientSenders(clientId);
  const createSender = useCreateClientSender(clientId);
  const deleteSender = useDeleteClientSender(clientId);
  const navigation = useNavigation();
  const { colors, typography, spacing } = useTheme();

  const [toDelete, setToDelete] = useState<ClientSender | null>(null);
  const [addVisible, setAddVisible] = useState(false);
  const [pattern, setPattern] = useState('');
  const [patternType, setPatternType] = useState<SenderPatternType>('address');

  useEffect(() => {
    navigation.setOptions({
      title: 'Email Senders',
      headerRight: () => (
        <Pressable
          onPress={() => setAddVisible(true)}
          style={{ marginRight: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Add sender"
        >
          <Text style={{ color: colors.accent, fontSize: 28, lineHeight: 32 }}>+</Text>
        </Pressable>
      ),
    });
  }, [navigation, colors.accent]);

  function handleSave() {
    const trimmed = pattern.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Required', 'Enter an email address or domain.');
      return;
    }
    createSender.mutate(
      { clientId, pattern: trimmed, patternType },
      {
        onSuccess: () => {
          setAddVisible(false);
          setPattern('');
          setPatternType('address');
        },
        onError: () => Alert.alert('Error', 'Failed to add sender.'),
      },
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <EmptyState message="Loading…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <EmptyState message="Failed to load senders" />
      </Screen>
    );
  }

  return (
    <Screen flex={false}>
      <FlatList
        data={senders ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState
            message="No sender patterns yet"
            hint="Tap + to add an address or domain to watch for this client."
          />
        }
        renderItem={({ item }) => (
          <Row
            title={item.pattern}
            subtitle={item.patternType === 'domain' ? 'Domain wildcard' : 'Exact address'}
            onLongPress={() => setToDelete(item)}
          />
        )}
      />

      {/* Add sender modal */}
      <Modal
        visible={addVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setAddVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <Text style={[typography.heading, { color: colors.text, marginBottom: spacing.md }]}>
            Add Sender Pattern
          </Text>

          {/* Pattern type toggle */}
          <View style={[styles.toggleRow, { marginBottom: spacing.sm }]}>
            {(['address', 'domain'] as SenderPatternType[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setPatternType(t)}
                style={[
                  styles.toggleBtn,
                  { borderColor: colors.border },
                  patternType === t && { backgroundColor: colors.accent },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t === 'address' ? 'Exact address' : 'Domain wildcard'}
              >
                <Text
                  style={[typography.body, { color: patternType === t ? '#fff' : colors.text }]}
                >
                  {t === 'address' ? 'Address' : 'Domain'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            value={pattern}
            onChangeText={setPattern}
            placeholder={patternType === 'address' ? 'scheduler@company.com' : 'company.com'}
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => setAddVisible(false)}
              style={[styles.btn, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[typography.body, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={createSender.isPending}
              style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Save sender"
            >
              <Text style={[typography.body, { color: '#fff' }]}>
                {createSender.isPending ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={toDelete !== null}
        title="Remove Sender"
        message={`Stop watching "${toDelete?.pattern}"?`}
        onConfirm={() => {
          if (toDelete) {
            deleteSender.mutate(toDelete.id);
            setToDelete(null);
          }
        }}
        onCancel={() => setToDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    padding: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
  },
  btnPrimary: {
    borderWidth: 0,
  },
});
