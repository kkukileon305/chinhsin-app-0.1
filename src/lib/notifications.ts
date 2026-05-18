import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

export const registerForPushNotifications = async (userId: string) => {
  try {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        'EAS Project ID가 app.json에 설정되지 않았습니다. 푸시 알림을 작동하려면 "npx eas project:init" 명령어를 터미널에서 실행하여 Expo 프로젝트 ID를 생성하거나 app.json에 직접 설정해 주세요.'
      );
      return null;
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    console.log('Expo Push Token obtained:', token);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F71',
      });
    }

    const deviceName = Device.modelName || `${Platform.OS} Device`;

    // Save token to Supabase
    const { error } = await supabase
      .from('user_devices')
      .upsert(
        {
          user_id: userId,
          expo_push_token: token,
          device_name: deviceName,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,expo_push_token' }
      );

    if (error) {
      console.error('Error saving user device token:', error);
    } else {
      console.log('Successfully registered user device token');
    }

    return token;
  } catch (error) {
    console.error('Error in registerForPushNotifications:', error);
    return null;
  }
};
