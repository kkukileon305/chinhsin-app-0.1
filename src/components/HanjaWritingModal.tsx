import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface HanjaWritingModalProps {
  visible: boolean;
  targetWord: string;
  onClose: () => void;
}

export const HanjaWritingModal = ({
  visible,
  targetWord,
  onClose,
}: HanjaWritingModalProps) => {
  const [strokes, setStrokes] = useState<Array<Array<{ x: number, y: number }>>>([]);
  const [showGhost, setShowGhost] = useState(true);
  const [containerHeight, setContainerHeight] = useState(0);

  const canvasRef = useRef<View>(null);
  const canvasLayoutRef = useRef({ left: 0, top: 0 });
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        // Measure canvas location relative to full screen
        canvasRef.current?.measure((x, y, width, height, pageX, pageY) => {
          if (pageX !== undefined && pageY !== undefined) {
            canvasLayoutRef.current = { left: pageX, top: pageY };
          }
        });

        const x = gestureState.x0 - canvasLayoutRef.current.left;
        const y = gestureState.y0 - canvasLayoutRef.current.top;
        const startPoint = { x, y };
        lastPointRef.current = startPoint;
        setStrokes((prev) => [...prev, [startPoint]]);
      },
      onPanResponderMove: (evt, gestureState) => {
        const x = gestureState.moveX - canvasLayoutRef.current.left;
        const y = gestureState.moveY - canvasLayoutRef.current.top;

        if (lastPointRef.current) {
          const dist = Math.hypot(x - lastPointRef.current.x, y - lastPointRef.current.y);
          if (dist < 6) return; // Perfectly balanced threshold for butter-smooth rendering & smooth curves
        }

        const newPoint = { x, y };
        lastPointRef.current = newPoint;

        setStrokes((prev) => {
          if (prev.length === 0) return [[newPoint]];
          const next = [...prev];
          const lastStroke = [...next[next.length - 1], newPoint];
          next[next.length - 1] = lastStroke;
          return next;
        });
      },
      onPanResponderRelease: () => {
        lastPointRef.current = null;
      },
    })
  ).current;

  const onCanvasLayout = (e: any) => {
    setContainerHeight(e.nativeEvent.layout.height);
    // Measure absolute screen position after layout completes
    setTimeout(() => {
      canvasRef.current?.measure((x, y, width, height, pageX, pageY) => {
        if (pageX !== undefined && pageY !== undefined) {
          canvasLayoutRef.current = { left: pageX, top: pageY };
        }
      });
    }, 100);
  };

  const handleClear = () => {
    setStrokes([]);
  };

  const renderStrokes = () => {
    const segments: React.ReactNode[] = [];
    strokes.forEach((stroke, strokeIdx) => {
      for (let i = 0; i < stroke.length - 1; i++) {
        const p1 = stroke[i];
        const p2 = stroke[i + 1];
        const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;

        segments.push(
          <View
            key={`stroke-${strokeIdx}-${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: p1.x,
              top: p1.y,
              width: length,
              height: 6, // Thick premium ink stroke
              borderRadius: 3,
              backgroundColor: '#FFFFFF', // Premium white ink
              transform: [
                { translateX: -length / 2 },
                { translateY: -3 },
                { rotate: `${angle}deg` },
                { translateX: length / 2 },
                { translateY: 3 },
              ],
            }}
          />
        );
      }
    });
    return segments;
  };

  const getGhostFontSize = (word: string) => {
    const len = word ? word.length : 1;
    if (len === 1) return 240;
    if (len === 2) return 140;
    if (len === 3) return 100;
    return 75;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-neutral-900" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="px-5 py-4 border-b border-neutral-800 flex-row justify-between items-center bg-neutral-900">
          <TouchableOpacity
            onPress={onClose}
            className="flex-row items-center active:opacity-75 py-2 pr-4"
          >
            <Ionicons name="chevron-back" size={24} color="#9CA3AF" />
            <Text className="text-base text-neutral-400 ml-1 font-semibold">닫기</Text>
          </TouchableOpacity>

          <Text className="text-lg font-bold text-white">한자 직접 쓰기</Text>

          {/* Clean right spacer to keep title perfectly centered */}
          <View className="w-16" />
        </View>

        {/* Content Area */}
        <View className="flex-1 p-5 bg-neutral-900">
          {/* Large Drawing Canvas Area (Takes up max available space) */}
          <View
            ref={canvasRef}
            onLayout={onCanvasLayout}
            className="flex-1 bg-neutral-950 rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl relative"
          >
            {/* 1. Ghost Target Character behind drawing layer (Aligned Horizontally) */}
            {showGhost && (
              <View 
                pointerEvents="none"
                className="absolute inset-0 flex-row justify-center items-center opacity-10 px-4"
              >
                <Text
                  style={{ fontSize: getGhostFontSize(targetWord) }}
                  className="font-bold text-neutral-300 text-center select-none tracking-normal"
                  numberOfLines={1}
                >
                  {targetWord}
                </Text>
              </View>
            )}

            {/* Grid pattern lines for a realistic calligraphy guide (Explicitly invisible to touches) */}
            <View pointerEvents="none" className="absolute inset-0 flex-row justify-center opacity-15">
              <View pointerEvents="none" className="w-0 h-full border-l border-dashed border-neutral-800" />
            </View>
            <View pointerEvents="none" className="absolute inset-0 flex-col justify-center opacity-15">
              <View pointerEvents="none" className="w-full h-0 border-t border-dashed border-neutral-800" />
            </View>

            {/* 2. Drawing Layer (PanResponder Handlers and Rendered Path) */}
            <View
              className="absolute inset-0 bg-transparent"
              {...panResponder.panHandlers}
            >
              {renderStrokes()}
            </View>
          </View>

          {/* Canvas Controls Banner at the Bottom */}
          <View className="flex-row justify-between items-center mt-5 px-2 gap-4">
            {/* Guide Toggle */}
            <TouchableOpacity
              onPress={() => setShowGhost(!showGhost)}
              className={`flex-1 flex-row items-center justify-center py-4 px-6 rounded-2xl active:opacity-75 ${
                showGhost ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-neutral-800 border border-neutral-750'
              }`}
            >
              <Ionicons
                name={showGhost ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={showGhost ? '#60A5FA' : '#9CA3AF'}
              />
              <Text
                className={`text-sm font-bold ml-2 ${
                  showGhost ? 'text-blue-400' : 'text-neutral-400'
                }`}
              >
                가이드 {showGhost ? '켜짐' : '꺼짐'}
              </Text>
            </TouchableOpacity>

            {/* Clear/Reset Canvas Button */}
            <TouchableOpacity
              onPress={handleClear}
              className="flex-1 bg-red-500/20 border border-red-500/30 py-4 px-6 rounded-2xl flex-row items-center justify-center active:opacity-75"
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text className="text-sm font-bold text-red-500 ml-2">다시 쓰기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
