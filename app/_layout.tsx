import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { QueryProvider } from '@/src/context/QueryProvider';
import { useAuth } from '@/src/hooks/useAuth';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryProvider>
      <RootLayoutNav />
    </QueryProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { status } = useAuth();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="client/[clientId]/index"
          options={{ title: 'Gigs', headerBackTitle: 'Clients' }}
        />
        <Stack.Screen
          name="client/[clientId]/gig/[gigId]"
          options={{ title: 'Entries', headerBackTitle: 'Gigs' }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      {status === 'unauthenticated' && <Redirect href="/(auth)/sign-in" />}
    </ThemeProvider>
  );
}
