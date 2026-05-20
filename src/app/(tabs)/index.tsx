import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Alert, Modal, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { HanjaWritingModal } from '@/components/HanjaWritingModal';

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
  
  // Page Input States
  const [pageInputModalVisible, setPageInputModalVisible] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('');

  // Reels Mode States
  const [reelsModalVisible, setReelsModalVisible] = useState(false);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [reelsWords, setReelsWords] = useState<Vocab[]>([]);
  const [reelsRevealStates, setReelsRevealStates] = useState<Record<number, boolean>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const reelsFlatListRef = useRef<FlatList>(null);
  const userIdRef = useRef<string | null>(null);
  const dragStartYRef = useRef(0);

  // Writing Modal States
  const [writingVisible, setWritingVisible] = useState(false);
  const [writingWord, setWritingWord] = useState('');
  const [writingZhuyin, setWritingZhuyin] = useState('');
  const [writingMeaning, setWritingMeaning] = useState('');

  const handleOpenWriting = (word: string, zhuyin: string, meaning: string) => {
    setWritingWord(word);
    setWritingZhuyin(zhuyin);
    setWritingMeaning(meaning);
    setWritingVisible(true);
  };

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
    
    // Store original state for potential revert
    const originalSavedIds = new Set(savedVocabIds);

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
        setSavedVocabIds(originalSavedIds);
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
        setSavedVocabIds(originalSavedIds);
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

  // Page Input Handlers
  const handleOpenPageInput = () => {
    setPageInputValue((page + 1).toString());
    setPageInputModalVisible(true);
  };

  const handlePageInputSubmit = () => {
    const targetPageNum = parseInt(pageInputValue, 10);
    const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

    if (isNaN(targetPageNum) || targetPageNum < 1 || targetPageNum > totalPages) {
      Alert.alert('유효하지 않은 페이지', `1부터 ${totalPages} 사이의 페이지 번호를 입력해주세요.`);
      return;
    }

    setPageInputModalVisible(false);
    fetchVocab(targetPageNum - 1);
  };

  // Reels Mode Handlers & Helpers
  const handleStartReels = () => {
    if (vocabList.length === 0) {
      Alert.alert('단어 없음', '이 페이지에 단어가 없습니다.');
      return;
    }
    setReelsWords(vocabList);
    setActiveIndex(0);
    setReelsRevealStates({});
    setReelsLoading(true);
    setReelsModalVisible(true);

    setTimeout(() => {
      setReelsLoading(false);
    }, 500);
  };

  const handleCloseReels = () => {
    setReelsModalVisible(false);
  };

  const handleScrollEndDrag = (e: any) => {
    if (containerHeight <= 0) return;
    const dragDistance = e.nativeEvent.contentOffset.y - dragStartYRef.current;
    const threshold = containerHeight * 0.04; // 4% threshold for ultra-sensitive swiping

    let targetIndex = activeIndex;
    if (dragDistance > threshold) {
      targetIndex = Math.min(reelsWords.length - 1, activeIndex + 1);
    } else if (dragDistance < -threshold) {
      targetIndex = Math.max(0, activeIndex - 1);
    }

    reelsFlatListRef.current?.scrollToOffset({
      offset: targetIndex * containerHeight,
      animated: true,
    });
    setActiveIndex(targetIndex);
  };

  const handleMomentumScrollEnd = (e: any) => {
    if (containerHeight <= 0) return;
    const index = Math.round(e.nativeEvent.contentOffset.y / containerHeight);
    setActiveIndex(index);
  };

  const renderReelsItem = ({ item, index }: { item: Vocab; index: number }) => {
    const isRevealed = reelsRevealStates[item.id] || false;
    const isBookmarked = savedVocabIds.has(item.id);

    return (
      <View
        style={{ height: containerHeight }}
        className="justify-between py-10 px-6 bg-neutral-900 border-b border-neutral-800"
      >
        {/* Main Content Area */}
        <View className="flex-1 justify-between">
          {/* Word Display Area (Tap to toggle Reveal) */}
          <Pressable
            onPress={() => {
              if (!isRevealed) {
                setReelsRevealStates((prev) => ({
                  ...prev,
                  [item.id]: true,
                }));
              }
            }}
            pointerEvents={isRevealed ? 'none' : 'auto'}
            className="flex-1 justify-center items-center mt-10"
          >
            <Text className="text-8xl font-black text-white tracking-widest text-center drop-shadow-lg">
              {item.word}
            </Text>

            {!isRevealed && (
              <View className="mt-12 bg-neutral-800/60 py-3 px-6 rounded-2xl border border-neutral-700/50">
                <Text className="text-sm font-semibold text-neutral-400 animate-pulse text-center">
                  👉 터치하면 발음과 뜻, 예문이 열립니다
                </Text>
              </View>
            )}
          </Pressable>

          {/* Revealed Details Section */}
          {isRevealed && (
            <View className="w-full bg-neutral-800/80 p-6 rounded-3xl border border-neutral-700/60 shadow-xl mb-6 self-center">
              <Pressable
                onPress={() => {
                  setReelsRevealStates((prev) => ({
                    ...prev,
                    [item.id]: false,
                  }));
                }}
                className="items-center mb-5 border-b border-neutral-700/50 pb-4"
              >
                {/* Zhuyin / Bopomofo */}
                <Text className="text-2xl font-bold text-blue-400 tracking-wider mb-2 font-mono">
                  {item.zhuyin}
                </Text>
                {/* Meaning */}
                <Text className="text-xl font-semibold text-neutral-200 text-center">
                  {item.meaning}
                </Text>
              </Pressable>

              {/* Example Sentences */}
              {item.example ? (
                <Pressable
                  onPress={() => {
                    setReelsRevealStates((prev) => ({
                      ...prev,
                      [item.id]: false,
                    }));
                  }}
                  className="bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800"
                >
                  <Text className="text-xs font-bold text-neutral-500 mb-2 tracking-wider">실전 대만식 예문</Text>
                  <Text className="text-lg font-bold text-white mb-1.5 leading-6 select-text">{item.example}</Text>
                  <Text className="text-sm font-semibold text-blue-300 mb-1 leading-5 font-mono">{item.example_zhuyin}</Text>
                  <Text className="text-sm text-neutral-400 leading-5">{item.example_meaning}</Text>
                </Pressable>
              ) : null}

              {/* Action Buttons (Bookmark & Follow-writing) */}
              <View className="flex-row mt-6">
                <TouchableOpacity
                  onPress={() => handleToggleBookmark(item)}
                  activeOpacity={0.8}
                  className={`flex-1 py-4 px-4 rounded-2xl flex-row items-center justify-center shadow-lg active:opacity-90 z-50 mr-3 ${
                    isBookmarked ? 'bg-blue-600' : 'bg-neutral-700'
                  }`}
                >
                  <Ionicons
                    name={isBookmarked ? "bookmark" : "bookmark-outline"}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text className="text-base font-bold text-white ml-1.5">
                    {isBookmarked ? '저장됨' : '북마크'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleOpenWriting(item.word, item.zhuyin, item.meaning)}
                  activeOpacity={0.8}
                  className="px-6 py-4 bg-neutral-800 border border-neutral-700 rounded-2xl flex-row items-center justify-center shadow-lg active:opacity-90 z-50"
                >
                  <Ionicons name="pencil-outline" size={20} color="#FFFFFF" />
                  <Text className="text-base font-bold text-white ml-1.5">따라쓰기</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bottom index / swiper bar */}
          <Pressable
            onPress={() => {
              setReelsRevealStates((prev) => ({
                ...prev,
                [item.id]: !prev[item.id],
              }));
            }}
            className="flex-row justify-between items-center px-2"
          >
            <View className="flex-row items-center">
              <Ionicons name="arrow-up-circle-outline" size={16} color="#9CA3AF" />
              <Text className="text-xs text-neutral-400 ml-1.5 font-semibold">위로 쓸어 올려 다음 단어</Text>
            </View>
            <Text className="text-xs font-mono text-neutral-500 font-bold bg-neutral-800/80 px-3 py-1 rounded-full">
              {index + 1} / {reelsWords.length}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Vocab }) => {
    const isBookmarked = savedVocabIds.has(item.id);

    return (
      <View className="bg-white dark:bg-neutral-800 p-5 rounded-2xl mb-4 shadow-sm border border-neutral-100 dark:border-neutral-700">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <Text className="text-3xl font-bold text-neutral-900 dark:text-white mr-2">
                {item.word}
              </Text>
              <TouchableOpacity
                onPress={() => handleOpenWriting(item.word, item.zhuyin, item.meaning)}
                className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg active:opacity-60"
              >
                <Ionicons name="pencil-outline" size={14} color="#208AEF" />
              </TouchableOpacity>
            </View>
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
      <View className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex-row justify-between items-center">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          단어장
        </Text>
        <TouchableOpacity
          onPress={handleStartReels}
          className="flex-row items-center bg-blue-500 dark:bg-blue-600 px-4 py-2 rounded-xl active:bg-blue-600 dark:active:bg-blue-700"
        >
          <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />
          <Text className="text-sm font-bold text-white ml-1.5">릴스 학습</Text>
        </TouchableOpacity>
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

        <TouchableOpacity
          onPress={handleOpenPageInput}
          className="active:opacity-60 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex-row items-center border border-neutral-200 dark:border-neutral-700"
        >
          <Text className="text-neutral-700 dark:text-neutral-200 font-bold text-base mr-1">
            {currentPageDisplay} / {totalPages}
          </Text>
          <Ionicons name="create-outline" size={14} color="#9CA3AF" />
        </TouchableOpacity>

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

      <HanjaWritingModal
        visible={writingVisible}
        targetWord={writingWord}
        onClose={() => setWritingVisible(false)}
      />

      <Modal
        visible={pageInputModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPageInputModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-white dark:bg-neutral-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-700">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white mb-2">페이지 이동</Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
              이동할 페이지 번호를 입력하세요.{'\n'}(범위: 1 ~ {totalPages})
            </Text>

            <TextInput
              value={pageInputValue}
              onChangeText={setPageInputValue}
              keyboardType="number-pad"
              autoFocus={true}
              selectTextOnFocus={true}
              className="bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-lg font-bold text-center mb-6"
            />

            <View className="flex-row space-x-3 gap-3">
              <TouchableOpacity
                onPress={() => setPageInputModalVisible(false)}
                className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-700 rounded-xl items-center active:opacity-80"
              >
                <Text className="text-base font-semibold text-neutral-600 dark:text-neutral-300">취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePageInputSubmit}
                className="flex-1 py-3 bg-blue-500 rounded-xl items-center active:opacity-80"
              >
                <Text className="text-base font-bold text-white">이동</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reelsModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseReels}
      >
        <SafeAreaView className="flex-1 bg-neutral-900" edges={['top', 'bottom']}>
          {/* Header */}
          <View className="px-5 py-4 border-b border-neutral-800 flex-row justify-between items-center bg-neutral-900">
            <TouchableOpacity
              onPress={handleCloseReels}
              className="flex-row items-center active:opacity-75 py-2 pr-4"
            >
              <Ionicons name="chevron-back" size={24} color="#9CA3AF" />
              <Text className="text-base text-neutral-400 ml-1 font-semibold">뒤로가기</Text>
            </TouchableOpacity>
            
            <Text className="text-lg font-bold text-white">단어장 학습 (릴스 모드)</Text>
            
            <View className="py-2 pl-4">
              <Text className="text-xs font-mono text-neutral-500 font-bold">
                전체 {reelsWords.length}단어
              </Text>
            </View>
          </View>

          {/* Swiper Content */}
          <View 
            className="flex-1 bg-neutral-950 justify-center"
            onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
          >
            {reelsLoading || containerHeight === 0 ? (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#208AEF" />
                <Text className="text-neutral-400 mt-4 text-base font-semibold">단어장을 불러오는 중...</Text>
              </View>
            ) : (
              <FlatList
                ref={reelsFlatListRef}
                data={reelsWords}
                renderItem={renderReelsItem}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                decelerationRate="fast"
                disableIntervalMomentum={true}
                onScrollBeginDrag={(e) => {
                  dragStartYRef.current = e.nativeEvent.contentOffset.y;
                }}
                onScrollEndDrag={handleScrollEndDrag}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                pagingEnabled={false}
                removeClippedSubviews={true}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={3}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default WordbookScreen;
