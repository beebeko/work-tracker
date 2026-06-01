import { useTheme } from '@/src/theme';
import { Stack } from 'expo-router';

export default function ModalsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerStyle: { backgroundColor: colors.headerBackground },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    />
  );
}
