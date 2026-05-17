import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';

type SavedWord = {
  id: string;
  unknown_count: number;
  master_vocab_id: number | null;
  word: string | null;
  zhuyin: string | null;
  meaning: string | null;
  master_vocab?: {
    word: string;
    zhuyin: string;
    meaning: string;
    category: string;
    example: string;
    example_zhuyin: string;
    example_meaning: string;
  } | null;
};

const PAGE_SIZE = 20;

const ReviewTab = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Saved Words State
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
        Alert.alert('오류', '로그인에 실패했습니다.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchSavedWords = async (pageNumber = 0, isRefresh = false) => {
    if (!session?.user?.id) return;
    if (listLoading || (!hasMore && !isRefresh)) return;

    setListLoading(true);
    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data, error } = await supabase
        .from('saved_words')
        .select(`
          id,
          unknown_count,
          master_vocab_id,
          word,
          zhuyin,
          meaning,
          master_vocab (
            word,
            zhuyin,
            meaning,
            category,
            example,
            example_zhuyin,
            example_meaning
          )
        `)
        .eq('user_id', session.user.id)
        .order('unknown_count', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching saved words:', error);
      } else if (data) {
        const fetchedItems = data as SavedWord[];
        if (fetchedItems.length < PAGE_SIZE) {
          setHasMore(false);
        }
        setSavedWords((prev) => {
          if (isRefresh) return fetchedItems;
          const existingIds = new Set(prev.map((item) => item.id));
          const uniqueFetched = fetchedItems.filter((item) => !existingIds.has(item.id));
          return [...prev, ...uniqueFetched];
        });
        setPage(pageNumber);
      }
    } catch (e) {
      console.error('Exception fetching saved words:', e);
    } finally {
      setListLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (session) {
      setHasMore(true);
      fetchSavedWords(0, true);
    } else {
      setSavedWords([]);
    }
  }, [session]);

  const onRefresh = () => {
    setRefreshing(true);
    setHasMore(true);
    fetchSavedWords(0, true);
  };

  const loadMore = () => {
    if (hasMore && !listLoading) {
      fetchSavedWords(page + 1);
    }
  };

  const handleStartReview = () => {
    Alert.alert('복습 시작', '복습 기능 준비 중입니다!');
  };

  const renderItem = ({ item }: { item: SavedWord }) => {
    const word = item.word || item.master_vocab?.word || '알 수 없는 단어';
    const zhuyin = item.zhuyin || item.master_vocab?.zhuyin || '';
    const meaning = item.meaning || item.master_vocab?.meaning || '';
    const category = item.master_vocab?.category || null;
    const example = item.master_vocab?.example || null;
    const exampleZhuyin = item.master_vocab?.example_zhuyin || null;
    const exampleMeaning = item.master_vocab?.example_meaning || null;
    const isExpanded = expandedIds.has(item.id);

    return (
      <TouchableOpacity
        onPress={() => toggleExpand(item.id)}
        activeOpacity={0.7}
        className="bg-white dark:bg-neutral-800 p-5 rounded-2xl mb-4 shadow-sm border border-neutral-100 dark:border-neutral-700 transition-all duration-300"
      >
        {/* Header Row (Always Visible) */}
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center flex-1 mr-4">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white mr-2">
              {word}
            </Text>
            {category && !isExpanded && (
              <View className="bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                <Text className="text-blue-600 dark:text-blue-300 text-[10px] font-semibold">
                  {category}
                </Text>
              </View>
            )}
          </View>
          
          <View className="flex-row items-center">
            <View className="bg-orange-50 dark:bg-orange-950/40 px-3 py-1 rounded-full mr-2">
              <Text className="text-orange-600 dark:text-orange-400 text-xs font-semibold">
                모름 {item.unknown_count}회
              </Text>
            </View>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#9CA3AF"
            />
          </View>
        </View>

        {/* Collapsible Details */}
        {isExpanded && (
          <View className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700/50">
            {zhuyin ? (
              <Text className="text-lg text-blue-500 font-semibold mb-1">
                {zhuyin}
              </Text>
            ) : null}
            <Text className="text-lg text-neutral-750 dark:text-neutral-200 font-medium mb-3">
              {meaning}
            </Text>
            
            {example && (
              <View className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl mb-3 mt-1">
                <Text className="text-base text-neutral-800 dark:text-neutral-200 mb-1">
                  {example}
                </Text>
                {exampleZhuyin ? (
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                    {exampleZhuyin}
                  </Text>
                ) : null}
                {exampleMeaning ? (
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                    {exampleMeaning}
                  </Text>
                ) : null}
              </View>
            )}

            {category && (
              <View className="flex-row mt-1">
                <View className="bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                  <Text className="text-blue-600 dark:text-blue-300 text-xs font-semibold">
                    분류: {category}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View className="mb-6 mt-2">
      <TouchableOpacity
        onPress={handleStartReview}
        className="flex-row items-center justify-center bg-blue-500 dark:bg-blue-600 py-4 px-6 rounded-2xl shadow-md active:bg-blue-600 dark:active:bg-blue-700"
      >
        <Ionicons name="play-circle-outline" size={24} color="#FFFFFF" />
        <Text className="text-lg font-bold text-white ml-2">복습 시작</Text>
      </TouchableOpacity>
      
      <View className="flex-row items-center justify-between mt-8 mb-2">
        <Text className="text-xl font-bold text-neutral-800 dark:text-white">
          내가 틀린 단어들 ({savedWords.length})
        </Text>
        <Text className="text-xs text-neutral-400 dark:text-neutral-500">
          모름 횟수가 높은 순으로 정렬됨
        </Text>
      </View>
    </View>
  );

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
      </View>
      
      <FlatList
        data={savedWords}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerClassName="p-5"
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#208AEF" />
        }
        ListFooterComponent={
          listLoading && !refreshing ? (
            <View className="py-4">
              <ActivityIndicator size="small" color="#208AEF" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !listLoading ? (
            <View className="flex-1 items-center justify-center py-20 mt-10">
              <Ionicons name="bookmark-outline" size={48} color="#9CA3AF" />
              <Text className="text-neutral-500 dark:text-neutral-400 mt-4 text-lg text-center">
                아직 저장된 단어가 없습니다.{'\n'}단어장에서 어려운 단어를 북마크해보세요.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

export default ReviewTab;
