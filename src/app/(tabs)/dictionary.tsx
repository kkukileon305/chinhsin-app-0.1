import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { HanjaWritingModal } from '@/components/HanjaWritingModal';
import { Session } from '@supabase/supabase-js';

interface Vocab {
  id: number;
  word: string;
  zhuyin: string;
  meaning: string;
  category: string | null;
  example: string | null;
  example_zhuyin: string | null;
  example_meaning: string | null;
}

const DictionaryScreen = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Vocab[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedVocabIds, setSavedVocabIds] = useState<Set<number>>(new Set());

  // Handwriting Modal states
  const [writingVisible, setWritingVisible] = useState(false);
  const [writingWord, setWritingWord] = useState('');

  // Debounce ref to avoid overlapping search requests
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch Session and Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUserId(session?.user?.id || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch bookmarks when session or search results change
  const fetchSavedStatus = useCallback(async (vocabIds: number[], uid: string) => {
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
  }, []);

  useEffect(() => {
    if (userId && results.length > 0) {
      fetchSavedStatus(results.map((r) => r.id), userId);
    } else if (!userId) {
      setSavedVocabIds(new Set());
    }
  }, [userId, results, fetchSavedStatus]);

  // 3. Dynamic Search Function (Traditional Chinese, Zhuyin, Meaning, Sentence Example, Sentence Translation)
  const executeSearch = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Unified query searching word, meaning, zhuyin, example sentence, and example translation!
      const { data, error } = await supabase
        .from('master_vocab')
        .select('*')
        .or(`word.ilike.%${trimmed}%,meaning.ilike.%${trimmed}%,zhuyin.ilike.%${trimmed}%,example.ilike.%${trimmed}%,example_meaning.ilike.%${trimmed}%`)
        .order('id', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error searching master_vocab:', error);
      } else {
        setResults(data || []);
      }
    } catch (err) {
      console.error('Search exception:', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced input change handler
  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(text);
    }, 300);
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    Keyboard.dismiss();
  };

  // 4. Bookmark Toggle with Optimistic UI updates
  const handleToggleBookmark = async (item: Vocab) => {
    if (!userId) {
      Alert.alert('로그인 필요', '북마크 기능을 이용하려면 먼저 로그인해주세요.');
      return;
    }

    const isBookmarked = savedVocabIds.has(item.id);
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
        // Rollback on failure
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
          details: null,
        });

      if (error) {
        console.error('Error inserting saved word:', error);
        // Rollback on failure
        const revertedIds = new Set(savedVocabIds);
        setSavedVocabIds(revertedIds);
        Alert.alert('오류', '북마크 추가 중 오류가 발생했습니다.');
      }
    }
  };

  // 5. Handwriting Practice Modal Trigger
  const handleOpenWriting = (word: string) => {
    setWritingWord(word);
    setWritingVisible(true);
  };

  // Render dictionary items
  const renderItem = ({ item }: { item: Vocab }) => {
    const isBookmarked = savedVocabIds.has(item.id);

    return (
      <View className="bg-white dark:bg-neutral-800 p-5 rounded-3xl mb-4 border border-neutral-100 dark:border-neutral-700/60 shadow-sm">
        {/* Card Top Row */}
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 mr-2">
            <View className="flex-row items-baseline flex-wrap gap-2">
              <Text className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-wide">
                {item.word}
              </Text>
              
              {/* Pencil practice button right next to the character */}
              <TouchableOpacity
                onPress={() => handleOpenWriting(item.word)}
                className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-full justify-center items-center active:opacity-75"
              >
                <Ionicons name="pencil" size={16} color="#208AEF" />
              </TouchableOpacity>
            </View>
            
            <Text className="text-sm font-semibold text-neutral-400 mt-1 dark:text-neutral-500">
              {item.zhuyin}
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            {item.category && (
              <View className="bg-neutral-100 dark:bg-neutral-700 px-2.5 py-1 rounded-lg">
                <Text className="text-xs font-bold text-neutral-500 dark:text-neutral-300">
                  {item.category}
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              onPress={() => handleToggleBookmark(item)}
              className="p-1 active:opacity-60"
            >
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={isBookmarked ? '#208AEF' : '#9CA3AF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Translation Meaning */}
        <Text className="text-lg text-neutral-650 dark:text-neutral-300 mb-4 font-medium leading-6">
          {item.meaning}
        </Text>

        {/* Example Sentence Container (If available) */}
        {item.example && (
          <View className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-2xl border border-neutral-100/50 dark:border-neutral-800/50">
            <Text className="text-base text-neutral-800 dark:text-neutral-200 mb-1 leading-5 font-semibold">
              {item.example}
            </Text>
            <Text className="text-xs text-neutral-450 dark:text-neutral-500 mb-2">
              {item.example_zhuyin}
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {item.example_meaning}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-900" edges={['top']}>
      {/* Page Title Header */}
      <View className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">사전</Text>
      </View>

      {/* Search Input Container */}
      <View className="p-5 pb-3">
        <View className="flex-row items-center bg-white dark:bg-neutral-800 px-4 py-3.5 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="단어, 발음, 예문, 한글 뜻으로 검색"
            placeholderTextColor="#9CA3AF"
            className="flex-1 ml-3 text-base text-neutral-800 dark:text-white py-0.5 font-medium"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          {query.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} className="p-1 active:opacity-60">
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results Container */}
      <View className="flex-1 px-5">
        {loading && results.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#208AEF" />
          </View>
        ) : query.trim().length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 opacity-75">
            <View className="w-20 h-20 bg-blue-50 dark:bg-blue-900/10 rounded-full justify-center items-center mb-5">
              <Ionicons name="search-outline" size={40} color="#208AEF" />
            </View>
            <Text className="text-neutral-500 dark:text-neutral-400 text-lg font-bold text-center">
              대만 화어 사전 검색
            </Text>
            <Text className="text-neutral-450 dark:text-neutral-500 text-sm text-center px-8 mt-2 leading-5">
              번체자 한자(繁體字), 주음부호 발음, 예문 단어/문장, 또는 한국어 뜻을 검색해 보세요.
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
            <Text className="text-neutral-500 dark:text-neutral-400 mt-4 text-lg font-semibold">
              검색 결과가 없습니다.
            </Text>
            <Text className="text-neutral-400 dark:text-neutral-500 text-sm text-center mt-2 px-10 leading-5">
              검색어가 올바르게 입력되었는지 확인해 주세요.
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerClassName="pt-2 pb-24"
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Practicing handwriting overlay modal */}
      <HanjaWritingModal
        visible={writingVisible}
        targetWord={writingWord}
        onClose={() => setWritingVisible(false)}
      />
    </SafeAreaView>
  );
};

export default DictionaryScreen;
