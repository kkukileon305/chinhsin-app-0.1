import React, { useEffect, useState, memo, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, Alert, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { HanjaWritingModal } from '@/components/HanjaWritingModal';
import { registerForPushNotifications } from '@/lib/notifications';
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

const SavedWordCard = memo(({
  item,
  isExpanded,
  onPress,
  onWritePress
}: {
  item: SavedWord;
  isExpanded: boolean;
  onPress: () => void;
  onWritePress: () => void;
}) => {
  const word = item.word || item.master_vocab?.word || '알 수 없는 단어';
  const zhuyin = item.zhuyin || item.master_vocab?.zhuyin || '';
  const meaning = item.meaning || item.master_vocab?.meaning || '';
  const category = item.master_vocab?.category || null;
  const example = item.master_vocab?.example || null;
  const exampleZhuyin = item.master_vocab?.example_zhuyin || null;
  const exampleMeaning = item.master_vocab?.example_meaning || null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-white dark:bg-neutral-800 p-5 rounded-2xl mb-4 shadow-sm border border-neutral-100 dark:border-neutral-700 transition-all duration-300"
    >
      {/* Header Row (Always Visible) */}
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center flex-1 mr-4">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white mr-2">
            {word}
          </Text>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onWritePress();
            }}
            className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg active:opacity-60 mr-2"
          >
            <Ionicons name="pencil-outline" size={14} color="#208AEF" />
          </TouchableOpacity>
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
}, (prevProps, nextProps) => {
  return (
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.item.unknown_count === nextProps.item.unknown_count &&
    prevProps.item.id === nextProps.item.id
  );
});

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
  const [totalCount, setTotalCount] = useState<number>(0);
  const userIdRef = React.useRef<string | null>(null);

  // Quiz / Reels Mode States
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [quizWords, setQuizWords] = useState<SavedWord[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizRevealStates, setQuizRevealStates] = useState<Record<string, boolean>>({});
  const [quizFeedback, setQuizFeedback] = useState<Record<string, boolean>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const flatListRef = React.useRef<FlatList>(null);
  const dragStartYRef = React.useRef(0);

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

  const fetchSavedWordsForUser = async (uid: string, pageNumber = 0, isRefresh = false) => {
    if (!uid) return;
    if (listLoading || (!hasMore && !isRefresh)) return;

    setListLoading(true);
    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data, error, count } = await supabase
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
        `, { count: 'exact' })
        .eq('user_id', uid)
        .order('unknown_count', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching saved words:', error);
      } else if (data) {
        const fetchedItems = data as SavedWord[];
        if (fetchedItems.length < PAGE_SIZE) {
          setHasMore(false);
        }
        if (count !== null) {
          setTotalCount(count);
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id || null;
    userIdRef.current = uid;

    // Reset list states cleanly to avoid mixing data
    setSavedWords([]);
    setPage(0);
    setHasMore(true);
    setTotalCount(0);

    if (uid) {
      fetchSavedWordsForUser(uid, 0, true);
      registerForPushNotifications(uid);
    }
  }, [session?.user?.id]);

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



  const onRefresh = () => {
    const sessionUid = userIdRef.current;
    if (sessionUid) {
      setRefreshing(true);
      setHasMore(true);
      fetchSavedWordsForUser(sessionUid, 0, true);
    } else {
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    const sessionUid = userIdRef.current;
    if (sessionUid && hasMore && !listLoading) {
      fetchSavedWordsForUser(sessionUid, page + 1);
    }
  };

  const handleScrollEndDrag = (e: any) => {
    if (containerHeight <= 0) return;
    const dragDistance = e.nativeEvent.contentOffset.y - dragStartYRef.current;
    const threshold = containerHeight * 0.04; // 4% threshold for ultra-sensitive swiping

    let targetIndex = activeIndex;
    if (dragDistance > threshold) {
      targetIndex = Math.min(quizWords.length - 1, activeIndex + 1);
    } else if (dragDistance < -threshold) {
      targetIndex = Math.max(0, activeIndex - 1);
    }

    flatListRef.current?.scrollToOffset({
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

  const handleCloseQuiz = () => {
    setQuizModalVisible(false);
    // Refresh main list
    const sessionUid = userIdRef.current;
    if (sessionUid) {
      setHasMore(true);
      fetchSavedWordsForUser(sessionUid, 0, true);
    }
  };

  const handleUnknown = async (item: SavedWord) => {
    try {
      const newCount = item.unknown_count + 1;
      
      // Update Supabase database
      const { error } = await supabase
        .from('saved_words')
        .update({ unknown_count: newCount })
        .eq('id', item.id);

      if (error) throw error;

      // Update quiz state locally
      setQuizWords((prev) =>
        prev.map((w) => (w.id === item.id ? { ...w, unknown_count: newCount } : w))
      );

      // Trigger visual feedback
      setQuizFeedback((prev) => ({ ...prev, [item.id]: true }));

      // Clean up feedback and auto-scroll after 800ms
      setTimeout(() => {
        setQuizFeedback((prev) => ({ ...prev, [item.id]: false }));
        
        const nextIdx = activeIndex + 1;
        if (nextIdx < quizWords.length && containerHeight > 0) {
          flatListRef.current?.scrollToOffset({
            offset: nextIdx * containerHeight,
            animated: true,
          });
          setActiveIndex(nextIdx);
        }
      }, 800);
    } catch (err) {
      console.error('Error incrementing unknown count:', err);
      Alert.alert('오류', '오답 횟수 업데이트에 실패했습니다.');
    }
  };

  const handleStartReview = async () => {
    const activeUid = userIdRef.current;
    if (!activeUid) {
      Alert.alert('로그인 필요', '복습을 시작하려면 먼저 로그인해 주세요.');
      return;
    }

    setQuizLoading(true);
    setQuizModalVisible(true);
    setActiveIndex(0);
    setQuizRevealStates({});
    setQuizFeedback({});

    try {
      // Fetch all saved words for this user
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
        .eq('user_id', activeUid);

      if (error) throw error;

      if (!data || data.length === 0) {
        Alert.alert('복습할 단어가 없음', '아직 저장한 단어가 없습니다. 단어장에서 단어를 저장해보세요!');
        setQuizModalVisible(false);
      } else {
        // Shuffle the array randomly!
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setQuizWords(shuffled);
      }
    } catch (e) {
      console.error('Error fetching quiz words:', e);
      Alert.alert('오류', '복습 단어를 불러오는 데 실패했습니다.');
      setQuizModalVisible(false);
    } finally {
      setQuizLoading(false);
    }
  };

  const renderQuizItem = ({ item, index }: { item: SavedWord; index: number }) => {
    const isRevealed = quizRevealStates[item.id] || false;
    const hasFeedback = quizFeedback[item.id] || false;

    const displayWord = item.word || item.master_vocab?.word || '';
    const displayZhuyin = item.zhuyin || item.master_vocab?.zhuyin || '';
    const displayMeaning = item.meaning || item.master_vocab?.meaning || '';
    
    const displayExample = item.master_vocab?.example || '';
    const displayExampleZhuyin = item.master_vocab?.example_zhuyin || '';
    const displayExampleMeaning = item.master_vocab?.example_meaning || '';

    return (
      <View
        style={{ height: containerHeight }}
        className="justify-between py-10 px-6 bg-neutral-900 border-b border-neutral-800"
      >
        {/* Floating feedback overlay (+1 Unknown) */}
        {hasFeedback && (
          <View className="absolute inset-0 bg-red-500/10 justify-center items-center z-50">
            <View className="bg-red-500/90 py-3 px-6 rounded-full shadow-lg scale-110">
              <Text className="text-white text-2xl font-bold font-mono">+1 오답 횟수 증가</Text>
            </View>
          </View>
        )}

        {/* Word Display Area (Tap to toggle Reveal) */}
        <Pressable
          onPress={() => {
            setQuizRevealStates((prev) => ({
              ...prev,
              [item.id]: !prev[item.id],
            }));
          }}
          className="flex-1 justify-center items-center mt-10"
        >
          <Text className="text-8xl font-black text-white tracking-widest text-center drop-shadow-lg">
            {displayWord}
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
          <View className="w-full bg-neutral-800/80 p-6 rounded-3xl border border-neutral-700/60 shadow-xl mb-6">
            <Pressable
              onPress={() => {
                setQuizRevealStates((prev) => ({
                  ...prev,
                  [item.id]: false,
                }));
              }}
              className="items-center mb-5 border-b border-neutral-700/50 pb-4"
            >
              {/* Zhuyin / Bopomofo */}
              <Text className="text-2xl font-bold text-blue-400 tracking-wider mb-2 font-mono">
                {displayZhuyin}
              </Text>
              {/* Meaning */}
              <Text className="text-xl font-semibold text-neutral-200 text-center">
                {displayMeaning}
              </Text>
              {/* Current Unknown Count */}
              <Text className="text-xs text-red-400 font-bold mt-2 font-mono">
                오답 횟수: {item.unknown_count}회
              </Text>
            </Pressable>

            {/* Example Sentences */}
            {displayExample ? (
              <Pressable
                onPress={() => {
                  setQuizRevealStates((prev) => ({
                    ...prev,
                    [item.id]: false,
                  }));
                }}
                className="bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800"
              >
                <Text className="text-xs font-bold text-neutral-500 mb-2 tracking-wider">실전 대만식 예문</Text>
                <Text className="text-lg font-bold text-white mb-1.5 leading-6 select-text">{displayExample}</Text>
                <Text className="text-sm font-semibold text-blue-300 mb-1 leading-5 font-mono">{displayExampleZhuyin}</Text>
                <Text className="text-sm text-neutral-400 leading-5">{displayExampleMeaning}</Text>
              </Pressable>
            ) : null}

            {/* Unknown Button (COMPLETELY INDEPENDENT AND ACCESSIBLE) */}
            <TouchableOpacity
              onPress={() => handleUnknown(item)}
              activeOpacity={0.8}
              className="mt-6 bg-red-500 py-4 px-6 rounded-2xl flex-row items-center justify-center shadow-lg active:bg-red-600 z-50"
            >
              <Ionicons name="close-circle-outline" size={24} color="#FFFFFF" />
              <Text className="text-lg font-bold text-white ml-2">모르겠어요</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom index / swiper bar (styled like Reels audio/user info overlay) */}
        <Pressable
          onPress={() => {
            setQuizRevealStates((prev) => ({
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
            {index + 1} / {quizWords.length}
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderItem = ({ item }: { item: SavedWord }) => {
    const displayWord = item.word || item.master_vocab?.word || '알 수 없는 단어';
    const displayZhuyin = item.zhuyin || item.master_vocab?.zhuyin || '';
    const displayMeaning = item.meaning || item.master_vocab?.meaning || '';
    return (
      <SavedWordCard
        item={item}
        isExpanded={expandedIds.has(item.id)}
        onPress={() => toggleExpand(item.id)}
        onWritePress={() => handleOpenWriting(displayWord, displayZhuyin, displayMeaning)}
      />
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
          내가 틀린 단어들 ({totalCount})
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
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">복습</Text>
      </View>
      
      <FlatList
        data={savedWords}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerClassName="p-5"
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
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

      <Modal
        visible={quizModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseQuiz}
      >
        <SafeAreaView className="flex-1 bg-neutral-900" edges={['top', 'bottom']}>
          {/* Header */}
          <View className="px-5 py-4 border-b border-neutral-800 flex-row justify-between items-center bg-neutral-900">
            <TouchableOpacity
              onPress={handleCloseQuiz}
              className="flex-row items-center active:opacity-75 py-2 pr-4"
            >
              <Ionicons name="chevron-back" size={24} color="#9CA3AF" />
              <Text className="text-base text-neutral-400 ml-1 font-semibold">뒤로가기</Text>
            </TouchableOpacity>
            
            <Text className="text-lg font-bold text-white">복습 (릴스 모드)</Text>
            
            <View className="py-2 pl-4">
              <Text className="text-xs font-mono text-neutral-500 font-bold">
                전체 {quizWords.length}단어
              </Text>
            </View>
          </View>

          {/* Swiper Content */}
          <View 
            className="flex-1 bg-neutral-950 justify-center"
            onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
          >
            {quizLoading ? (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#208AEF" />
                <Text className="text-neutral-400 mt-4 text-base font-semibold">단어 카드를 섞는 중...</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={quizWords}
                renderItem={renderQuizItem}
                keyExtractor={(item) => item.id}
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

      <HanjaWritingModal
        visible={writingVisible}
        targetWord={writingWord}
        onClose={() => setWritingVisible(false)}
      />
    </SafeAreaView>
  );
};

export default ReviewTab;
