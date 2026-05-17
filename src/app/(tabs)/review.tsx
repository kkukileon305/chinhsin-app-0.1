import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';

export default function ReviewTab() {
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
        console.error('Google 로그인 실패 전체:', JSON.stringify(error));
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await GoogleSignin.signOut();
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
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-10">
            <View className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-3xl items-center justify-center mb-6">
              <Ionicons name="lock-closed" size={40} color="#208AEF" />
            </View>
            <Text className="text-3xl font-bold text-neutral-900 dark:text-white mb-3 text-center">
              복습하기
            </Text>
            <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center">
              로그인하고 학습한 단어들을{'\n'}복습해보세요.
            </Text>
          </View>

          <TouchableOpacity
            onPress={signInWithGoogle}
            disabled={authLoading}
            className="flex-row items-center justify-center bg-white dark:bg-neutral-800 py-4 px-6 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700 active:opacity-80"
          >
            {authLoading ? (
              <ActivityIndicator color="#208AEF" />
            ) : (
              <>
                <Ionicons name="logo-google" size={24} color="#EA4335" />
                <Text className="text-lg font-bold text-neutral-800 dark:text-white ml-3">
                  Google로 계속하기
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
      <View className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex-row justify-between items-center">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">복습 (Review)</Text>
        <TouchableOpacity onPress={signOut} className="p-2">
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>
      <View className="flex-1 justify-center items-center px-6">
        <Ionicons name="repeat" size={64} color="#208AEF" />
        <Text className="text-xl font-bold text-neutral-900 dark:text-white mt-6 mb-2 text-center">
          복습 콘텐츠 준비 중
        </Text>
        <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center">
          아직 복습 기능이 구현되지 않았습니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}
