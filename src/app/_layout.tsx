import '../global.css';
import { Stack } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// GoogleSignin.configure는 앱 최초 로드 시 즉시 실행
GoogleSignin.configure({
  webClientId: '352542378163-0m6c6smufc4mngn065sbl1946sbgei22.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
  offlineAccess: true,
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
      </Stack>
    </ThemeProvider>
  );
}
