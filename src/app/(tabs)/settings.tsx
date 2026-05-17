import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';

const SettingsScreen = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setAuthLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) throw new Error('Google ID 토큰을 가져오지 못했습니다.');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('로그인 취소');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('이미 로그인 진행 중');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.error('Google Play Services 없음');
      } else {
        console.error('Google 로그인 실패 코드:', error.code);
        console.error('Google 로그인 실패 메시지:', error.message);
        Alert.alert('오류', '로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      await GoogleSignin.signOut();
    } catch (e) {
      console.error('Error signing out:', e);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-neutral-50 dark:bg-neutral-900">
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
        <View className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white">설정 (Settings)</Text>
        </View>
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-10">
            <View className="w-20 h-20 bg-blue-50 dark:bg-blue-900/10 rounded-3xl items-center justify-center mb-6">
              <Ionicons name="settings-outline" size={40} color="#208AEF" />
            </View>
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-3 text-center">
              설정
            </Text>
            <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center px-4 leading-6">
              로그인하시면 단어장 진도 및 북마크가 동기화되며 개인 설정을 관리할 수 있습니다.
            </Text>
          </View>

          <TouchableOpacity
            onPress={signInWithGoogle}
            disabled={authLoading}
            className="flex-row items-center justify-center bg-white dark:bg-neutral-800 py-4 px-6 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700 active:opacity-85"
          >
            {authLoading ? (
              <ActivityIndicator color="#208AEF" />
            ) : (
              <>
                <Ionicons name="logo-google" size={24} color="#EA4335" />
                <Text className="text-lg font-bold text-neutral-800 dark:text-white ml-3">
                  Google로 로그인하기
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      <View className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">설정 (Settings)</Text>
      </View>
      <View className="p-6">
        {/* User Profile Card */}
        <View className="bg-white dark:bg-neutral-800 p-5 rounded-2xl mb-6 shadow-sm border border-neutral-100 dark:border-neutral-700 flex-row items-center">
          <View className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full items-center justify-center mr-4">
            <Ionicons name="person" size={24} color="#208AEF" />
          </View>
          <View className="flex-1">
            <Text className="text-sm text-neutral-400 dark:text-neutral-500 mb-0.5">로그인 정보</Text>
            <Text className="text-base font-bold text-neutral-800 dark:text-neutral-200" numberOfLines={1}>
              {session.user.email}
            </Text>
          </View>
        </View>

        {/* Menu Items */}
        <View className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 overflow-hidden mb-6">
          <View className="p-4 border-b border-neutral-100 dark:border-neutral-700/50 flex-row justify-between items-center">
            <Text className="text-base text-neutral-700 dark:text-neutral-300">앱 버전</Text>
            <Text className="text-base text-neutral-400">1.0.0</Text>
          </View>
          
          <TouchableOpacity
            onPress={signOut}
            className="p-4 flex-row items-center justify-between active:bg-neutral-50 dark:active:bg-neutral-750"
          >
            <View className="flex-row items-center">
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className="text-base font-semibold text-red-500 ml-3">로그아웃</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SettingsScreen;
