import React, { useEffect, useState } from 'react';
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

const PAGE_SIZE = 20;

export default function WordbookScreen() {
  const [vocabList, setVocabList] = useState<Vocab[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchVocab = async (pageNumber = 0, isRefresh = false) => {
    if (loading || (!hasMore && !isRefresh)) return;
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
      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setVocabList(isRefresh ? data : [...vocabList, ...data]);
      setPage(pageNumber);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchVocab(0, true);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setHasMore(true);
    fetchVocab(0, true);
  };

  const loadMore = () => {
    if (hasMore && !loading) {
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

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      <View className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          단어장 (Wordbook)
        </Text>
      </View>
      
      <FlatList
        data={vocabList}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerClassName="p-5"
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#208AEF" />
        }
        ListFooterComponent={
          loading && !refreshing ? (
            <View className="py-4">
              <ActivityIndicator size="small" color="#208AEF" />
            </View>
          ) : null
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
    </SafeAreaView>
  );
}
