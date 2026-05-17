import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      <View className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">설정 (Settings)</Text>
      </View>
      <View className="flex-1 justify-center items-center px-6">
        <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center">
          설정 기능 준비 중입니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}
