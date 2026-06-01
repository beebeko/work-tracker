import { useTheme } from '@/src/theme';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  /** Label for the confirm button. Default: "Confirm" */
  confirmLabel?: string;
  /** Render the confirm button in danger color. Default: false */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const { colors, spacing, typography } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[typography.heading, { color: colors.text, marginBottom: spacing.sm }]}>
            {title}
          </Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}
          >
            {message}
          </Text>
          <View style={styles.buttons}>
            <Pressable
              onPress={onCancel}
              style={[styles.button, { borderColor: colors.border, borderWidth: 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[typography.label, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[
                styles.button,
                { backgroundColor: destructive ? colors.danger : colors.accent },
              ]}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              <Text style={[typography.label, { color: '#fff' }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 80,
    alignItems: 'center',
  },
});
