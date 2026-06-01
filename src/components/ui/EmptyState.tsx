import { useTheme } from '@/src/theme';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  message: string;
  hint?: string;
}

export function EmptyState({ message, hint }: Props) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={[styles.container, { paddingVertical: spacing.xxl }]}>
      <Text style={[typography.heading, { color: colors.textSecondary, textAlign: 'center' }]}>
        {message}
      </Text>
      {hint ? (
        <Text
          style={[
            typography.body,
            { color: colors.textDisabled, textAlign: 'center', marginTop: spacing.sm },
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
