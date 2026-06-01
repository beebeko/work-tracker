import { useTheme } from '@/src/theme';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: ReactNode;
  /** Use 'fill' for list screens, 'scroll' handled externally */
  flex?: boolean;
}

export function Screen({ children, flex = true }: Props) {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['bottom', 'left', 'right']}
    >
      <View style={flex ? styles.fill : undefined}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
});
