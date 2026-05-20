import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerForPushNotifications } from '@/lib/notifications';

interface UserDevice {
  id: string;
  device_name: string | null;
  expo_push_token: string;
  is_active: boolean;
  created_at: string;
}

const SettingsScreen = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);

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

  const fetchUserDevices = async (userId: string) => {
    try {
      setDevicesLoading(true);
      const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (e) {
      console.error('Error fetching user devices:', e);
    } finally {
      setDevicesLoading(false);
    }
  };

  const getDeviceToken = async () => {
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      if (projectId) {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        setCurrentToken(tokenData.data);
      }
    } catch (e) {
      console.log('Could not retrieve push token for current device check:', e);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserDevices(session.user.id);
      getDeviceToken();
    } else {
      setDevices([]);
      setCurrentToken(null);
    }
  }, [session?.user?.id]);

  const toggleDeviceActive = async (deviceId: string, currentStatus: boolean) => {
    try {
      // Optimistic Update for flawless butter-smooth toggling
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, is_active: !currentStatus } : d))
      );

      const { error } = await supabase
        .from('user_devices')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', deviceId);

      if (error) {
        // Rollback state if network/database update fails
        setDevices((prev) =>
          prev.map((d) => (d.id === deviceId ? { ...d, is_active: currentStatus } : d))
        );
        throw error;
      }
    } catch (e) {
      console.error('Error toggling device active state:', e);
      Alert.alert('오류', '알림 설정을 변경하는 데 실패했습니다.');
    }
  };

  const deleteDevice = async (deviceId: string, isCurrentDevice: boolean) => {
    const alertTitle = isCurrentDevice ? '⚠️ 현재 기기 알림 등록 해제' : '알림 기기 삭제';
    const alertMessage = isCurrentDevice
      ? '이 기기는 현재 사용 중인 기기입니다.\n삭제하시면 더 이상 이 기기로 푸시 알림을 받으실 수 없습니다. 정말 삭제하시겠습니까?'
      : '이 기기 등록을 삭제하시겠습니까?\n삭제 후에는 이 기기로 알림이 발송되지 않습니다.';

    Alert.alert(
      alertTitle,
      alertMessage,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setDevicesLoading(true);
              const { error } = await supabase
                .from('user_devices')
                .delete()
                .eq('id', deviceId);

              if (error) throw error;

              setDevices((prev) => prev.filter((d) => d.id !== deviceId));
              Alert.alert('완료', '기기가 성공적으로 삭제되었습니다.');
            } catch (err) {
              console.error('Error deleting device:', err);
              Alert.alert('오류', '기기를 삭제하는 데 실패했습니다. 다시 시도해 주세요.');
            } finally {
              setDevicesLoading(false);
            }
          },
        },
      ]
    );
  };

  const reRegisterCurrentDevice = async () => {
    if (!session?.user?.id) return;
    try {
      setDevicesLoading(true);
      const token = await registerForPushNotifications(session.user.id);
      if (token) {
        await fetchUserDevices(session.user.id);
        await getDeviceToken();
        Alert.alert('성공', '현재 기기가 알림 수신 기기로 다시 등록되었습니다.');
      } else {
        Alert.alert('오류', '기기 등록에 실패했습니다. 권한 설정을 확인해 주세요.');
      }
    } catch (e) {
      console.error('Error re-registering device:', e);
      Alert.alert('오류', '알림 기기를 등록하는 중에 오류가 발생했습니다.');
    } finally {
      setDevicesLoading(false);
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

  const isCurrentDeviceRegistered = devices.some((d) => d.expo_push_token === currentToken);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      <View className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">설정</Text>
      </View>
      
      <View className="p-6">
        {/* User Profile Card (Conditional) */}
        {session && (
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
        )}

        {/* Notification Management (알림 관리) - Only if logged in */}
        {session && (
          <View className="mb-6">
            <Text className="text-sm font-bold text-neutral-400 dark:text-neutral-500 mb-3 px-1 uppercase tracking-wider">
              알림 관리
            </Text>
            
            <View className="bg-white dark:bg-neutral-800 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-700 overflow-hidden">
              {devicesLoading && devices.length === 0 ? (
                <View className="py-6 justify-center items-center">
                  <ActivityIndicator color="#208AEF" />
                </View>
              ) : devices.length === 0 ? (
                <View className="py-6 px-4 items-center">
                  <Text className="text-sm text-neutral-400 dark:text-neutral-500 text-center">
                    등록된 기기가 없습니다.
                  </Text>
                </View>
              ) : (
                devices.map((device, idx) => {
                  const isCurrentDevice = currentToken !== null && device.expo_push_token === currentToken;
                  return (
                    <View
                      key={device.id}
                      className={`flex-row items-center justify-between p-5 ${
                        idx !== devices.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-700/50' : ''
                      } ${isCurrentDevice ? 'bg-blue-50/10 dark:bg-blue-950/10' : ''}`}
                    >
                      <View className="flex-row items-center flex-1 mr-4">
                        <View className="w-10 h-10 bg-neutral-50 dark:bg-neutral-900 rounded-full items-center justify-center mr-3">
                          <Ionicons name="phone-portrait-outline" size={20} color="#208AEF" />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text className="text-base font-bold text-neutral-800 dark:text-white" numberOfLines={1}>
                              {device.device_name || '이름 없는 기기'}
                            </Text>
                            {isCurrentDevice && (
                              <View className="bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-md ml-2">
                                <Text className="text-[10px] font-bold text-blue-650 dark:text-blue-300">
                                  이 기기
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5" numberOfLines={1}>
                            {device.is_active ? '알림 켜짐' : '알림 꺼짐'}
                          </Text>
                        </View>
                      </View>
                      
                      <View className="flex-row items-center gap-3">
                        <Switch
                          value={device.is_active}
                          onValueChange={() => toggleDeviceActive(device.id, device.is_active)}
                          trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                          thumbColor={device.is_active ? '#208AEF' : '#F3F4F6'}
                        />
                        
                        <TouchableOpacity
                          onPress={() => deleteDevice(device.id, isCurrentDevice)}
                          className="p-2 active:opacity-60"
                        >
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Quick Re-registration helper for the current device */}
            {currentToken && !isCurrentDeviceRegistered && (
              <TouchableOpacity
                onPress={reRegisterCurrentDevice}
                className="mt-3 flex-row items-center justify-center bg-blue-50 dark:bg-blue-950/20 border border-dashed border-blue-200 dark:border-blue-800/80 p-4 rounded-2xl active:opacity-80"
              >
                <Ionicons name="add-circle-outline" size={20} color="#208AEF" />
                <Text className="text-sm font-bold text-blue-600 dark:text-blue-400 ml-2">
                  현재 기기 알림 등록하기
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Menu Items */}
        <View className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-700 overflow-hidden mb-6">
          <View className="p-4 border-b border-neutral-100 dark:border-neutral-700/50 flex-row justify-between items-center">
            <Text className="text-base text-neutral-700 dark:text-neutral-300">앱 버전</Text>
            <Text className="text-base text-neutral-400">1.0.0</Text>
          </View>
          
          {session && (
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
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SettingsScreen;
