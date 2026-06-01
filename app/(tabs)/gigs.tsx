import { Screen } from '@/src/components/ui/Screen';
import { useTheme } from '@/src/theme';
import { StyleSheet, Text, View } from 'react-native';

export default function GigsScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <Screen>
      <View style={[styles.container, { paddingVertical: spacing.xxl }]}>
        <Text style={[typography.heading, { color: colors.textSecondary, textAlign: 'center' }]}>
          Cross-client gig view
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textDisabled, textAlign: 'center', marginTop: spacing.sm },
          ]}
        >
          Coming in the next phase.{'\n'}Tap Clients to drill into a client's gigs.
        </Text>
      </View>
    </Screen>
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
