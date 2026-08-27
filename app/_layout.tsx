/**
 * Root layout — fonts, theme, and DatabaseProvider for local-first storage.
 */

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { DatabaseProvider } from '@/src/providers/DatabaseProvider';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
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

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <DatabaseProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="start-episode"
            options={{ presentation: 'modal', title: 'Новый приступ' }}
          />
          <Stack.Screen
            name="change-intensity"
            options={{ presentation: 'modal', title: 'Интенсивность' }}
          />
          <Stack.Screen
            name="finish-episode"
            options={{ presentation: 'modal', title: 'Завершить' }}
          />
          <Stack.Screen
            name="episode/[id]"
            options={{ title: 'Приступ' }}
          />
        </Stack>
      </ThemeProvider>
    </DatabaseProvider>
  );
}
