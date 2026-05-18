import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DictionaryScreen = () => {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg text-neutral-400 dark:text-neutral-500 font-bold">
          사전 준비 중
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default DictionaryScreen;
