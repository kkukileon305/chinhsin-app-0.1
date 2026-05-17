import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

type Vocab = {
  id: number;
  word: string;
  zhuyin: string;
  meaning: string;
  category: string;
  example: string;
  example_zhuyin: string;
  example_meaning: string;
};

const PAGE_SIZE = 24;

const WordbookScreen = () => {
  const [vocabList, setVocabList] = useState<Vocab[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0); // 0-indexed for range
  const [totalCount, setTotalCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [savedVocabIds, setSavedVocabIds] = useState<Set<number>>(new Set());
  
  const flatListRef = useRef<FlatList>(null);
  const userIdRef = useRef<string | null>(null);

  const fetchTotalCount = async () => {
    const { count, error } = await supabase
      .from('master_vocab')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching total count:', error);
    } else if (count !== null) {
      setTotalCount(count);
    }
  };

  const fetchSavedStatus = async (vocabIds: number[], uid: string) => {
    if (vocabIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from('saved_words')
        .select('master_vocab_id')
        .eq('user_id', uid)
        .in('master_vocab_id', vocabIds);

      if (error) {
        console.error('Error fetching saved status:', error);
      } else if (data) {
        const savedSet = new Set<number>(data.map((item: any) => Number(item.master_vocab_id)));
        setSavedVocabIds(savedSet);
      }
    } catch (e) {
      console.error('Exception fetching saved status:', e);
    }
  };

  const fetchVocab = async (pageNumber = 0, isInitialOrRefresh = false, uidParam?: string | null) => {
    setLoading(true);

    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('master_vocab')
      .select('*')
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      console.error('Error fetching vocab:', error);
    } else if (data) {
      setVocabList(data);
      setPage(pageNumber);
      
      const activeUid = uidParam !== undefined ? uidParam : userId;
      if (activeUid) {
        await fetchSavedStatus(data.map(item => item.id), activeUid);
      } else {
        setSavedVocabIds(new Set());
      }
      
      if (activeUid && !isInitialOrRefresh) {
        saveLastPage(activeUid, pageNumber + 1);
      }

      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }

    setLoading(false);
    setRefreshing(false);
  };

  const saveLastPage = async (uid: string, pageNum: number) => {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: uid,
          last_vocab_page: pageNum,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving last_vocab_page:', error);
      }
    } catch (e) {
      console.error('Exception in saveLastPage:', e);
    }
  };

  const handleToggleBookmark = async (item: Vocab) => {
    if (!userId) {
      Alert.alert('로그인 필요', '북마크 기능을 이용하려면 먼저 로그인해주세요.');
      return;
    }

    const isBookmarked = savedVocabIds.has(item.id);
    
    // Optimistic UI Update
    const newSavedIds = new Set(savedVocabIds);
    if (isBookmarked) {
      newSavedIds.delete(item.id);
    } else {
      newSavedIds.add(item.id);
    }
    setSavedVocabIds(newSavedIds);

    if (isBookmarked) {
      const { error } = await supabase
        .from('saved_words')
        .delete()
        .eq('user_id', userId)
        .eq('master_vocab_id', item.id);

      if (error) {
        console.error('Error deleting saved word:', error);
        // Revert optimistic update
        const revertedIds = new Set(savedVocabIds);
        setSavedVocabIds(revertedIds);
        Alert.alert('오류', '북마크 해제 중 오류가 발생했습니다.');
      }
    } else {
      const { error } = await supabase
        .from('saved_words')
        .insert({
          user_id: userId,
          master_vocab_id: item.id,
          stage_id: null,
          word: null,
          zhuyin: null,
          meaning: null,
          details: null
        });

      if (error) {
        console.error('Error inserting saved word:', error);
        // Revert optimistic update
        const revertedIds = new Set(savedVocabIds);
        setSavedVocabIds(revertedIds);
        Alert.alert('오류', '북마크 저장 중 오류가 발생했습니다.');
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      userIdRef.current = uid;
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      userIdRef.current = uid;
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      let initialPage = 0;
      const activeUid = userId;

      if (activeUid) {
        try {
          const { data: settingsData } = await supabase
            .from('user_settings')
            .select('last_vocab_page')
            .eq('user_id', activeUid)
            .maybeSingle();

          if (settingsData?.last_vocab_page) {
            initialPage = Math.max(0, settingsData.last_vocab_page - 1);
          }
        } catch (e) {
          console.error('Error fetching settings on auth change:', e);
        }
      }

      await fetchTotalCount();
      await fetchVocab(initialPage, true, activeUid);
    };

    loadData();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    let initialPage = 0;
    const sessionUid = userIdRef.current;
    
    if (sessionUid) {
      try {
        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('last_vocab_page')
          .eq('user_id', sessionUid)
          .maybeSingle();

        if (settingsData?.last_vocab_page) {
          initialPage = Math.max(0, settingsData.last_vocab_page - 1);
        }
      } catch (e) {
        console.error(e);
      }
    }

    await fetchTotalCount();
    await fetchVocab(initialPage, true, sessionUid);
  };

  const handlePrevPage = () => {
    if (page > 0 && !loading) {
      fetchVocab(page - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    if (page + 1 < totalPages && !loading) {
      fetchVocab(page + 1);
    }
  };

  const renderItem = ({ item }: { item: Vocab }) => {
    const isBookmarked = savedVocabIds.has(item.id);

    return (
      <View className="bg-white dark:bg-neutral-800 p-5 rounded-2xl mb-4 shadow-sm border border-neutral-100 dark:border-neutral-700">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-neutral-900 dark:text-white mb-1">
              {item.word}
            </Text>
            <Text className="text-lg text-blue-500 font-medium mb-1">
              {item.zhuyin}
            </Text>
          </View>
          <View className="items-end">
            {item.category && (
              <View className="bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full mb-3">
                <Text className="text-blue-600 dark:text-blue-300 text-xs font-semibold">
                  {item.category}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => handleToggleBookmark(item)}
              className="p-1 active:opacity-60"
            >
              <Ionicons
                name={isBookmarked ? "bookmark" : "bookmark-outline"}
                size={24}
                color={isBookmarked ? "#208AEF" : "#9CA3AF"}
              />
            </TouchableOpacity>
          </View>
        </View>
        <Text className="text-lg text-neutral-600 dark:text-neutral-300 mb-4 font-medium">
          {item.meaning}
        </Text>
        
        {item.example && (
          <View className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl">
            <Text className="text-base text-neutral-800 dark:text-neutral-200 mb-1">
              {item.example}
            </Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
              {item.example_zhuyin}
            </Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">
              {item.example_meaning}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const currentPageDisplay = page + 1;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      <View className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          단어장
        </Text>
      </View>
      
      <View className="flex-1">
        <FlatList
          ref={flatListRef}
          data={vocabList}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerClassName="p-5 pb-24"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#208AEF" />
          }
          ListEmptyComponent={
            !loading ? (
              <View className="flex-1 items-center justify-center py-20">
                <Ionicons name="book-outline" size={48} color="#9CA3AF" />
                <Text className="text-neutral-500 dark:text-neutral-400 mt-4 text-lg">
                  단어가 없습니다.
                </Text>
              </View>
            ) : null
          }
        />
        
        {loading && !refreshing && (
          <View className="absolute inset-0 bg-white/50 dark:bg-neutral-900/50 items-center justify-center">
            <ActivityIndicator size="large" color="#208AEF" />
          </View>
        )}
      </View>

      {/* Pagination Bar */}
      <View className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 py-4 px-6 flex-row justify-between items-center shadow-md">
        <TouchableOpacity
          onPress={handlePrevPage}
          disabled={page === 0 || loading}
          className={`flex-row items-center px-4 py-2 rounded-xl ${page === 0 ? 'opacity-30' : 'active:bg-neutral-100 dark:active:bg-neutral-700'}`}
        >
          <Ionicons name="chevron-back" size={20} color={page === 0 ? '#9CA3AF' : '#208AEF'} />
          <Text className={`ml-1 text-base font-semibold ${page === 0 ? 'text-neutral-400 dark:text-neutral-500' : 'text-blue-500'}`}>
            이전
          </Text>
        </TouchableOpacity>

        <Text className="text-neutral-700 dark:text-neutral-200 font-bold text-base">
          {currentPageDisplay} / {totalPages}
        </Text>

        <TouchableOpacity
          onPress={handleNextPage}
          disabled={currentPageDisplay >= totalPages || loading}
          className={`flex-row items-center px-4 py-2 rounded-xl ${currentPageDisplay >= totalPages ? 'opacity-30' : 'active:bg-neutral-100 dark:active:bg-neutral-700'}`}
        >
          <Text className={`mr-1 text-base font-semibold ${currentPageDisplay >= totalPages ? 'text-neutral-400 dark:text-neutral-500' : 'text-blue-500'}`}>
            다음
          </Text>
          <Ionicons name="chevron-forward" size={20} color={currentPageDisplay >= totalPages ? '#9CA3AF' : '#208AEF'} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default WordbookScreen;
