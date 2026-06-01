import { useTheme } from '@/src/theme';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  title: string;
  subtitle?: string;
  /** Element rendered on the right side (badge, amount, etc.) */
  right?: ReactNode;
  /** Show a trailing chevron to indicate drill-down. Default: false */
  chevron?: boolean;
  onPress?: () => void;
}

export function Row({ title, subtitle, right, chevron = false, onPress }: Props) {
  const { colors, spacing, typography } = useTheme();

  const content = (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.textBlock}>
        <Text style={[typography.body, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.label, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.rightBlock}>{right}</View> : null}
      {chevron ? <Text style={[styles.chevron, { color: colors.textDisabled }]}>›</Text> : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          { backgroundColor: pressed ? colors.surfaceHighlight : colors.surface },
          { paddingHorizontal: spacing.lg },
        ]}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[{ backgroundColor: colors.surface, paddingHorizontal: spacing.lg }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  rightBlock: {
    marginLeft: 8,
  },
  chevron: {
    fontSize: 20,
    marginLeft: 4,
    lineHeight: 24,
  },
});
