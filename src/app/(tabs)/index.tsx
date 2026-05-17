import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
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
  
  const flatListRef = useRef<FlatList>(null);

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

  const fetchVocab = async (pageNumber = 0, isRefresh = false) => {
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
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }

    setLoading(false);
    setRefreshing(false);
  };

  const loadInitialData = async () => {
    setLoading(true);
    await fetchTotalCount();
    await fetchVocab(0, true);
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTotalCount();
    await fetchVocab(0, true);
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

  const renderItem = ({ item }: { item: Vocab }) => (
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
        {item.category && (
          <View className="bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
            <Text className="text-blue-600 dark:text-blue-300 text-xs font-semibold">
              {item.category}
            </Text>
          </View>
        )}
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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const currentPageDisplay = page + 1;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      <View className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          단어장 (Wordbook)
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
