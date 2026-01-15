import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  Vibration,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Light Blue
];


export default function PlayerSelectorScreen() {
  const { theme } = useTheme();
  const [touches, setTouches] = useState({});
  const [phase, setPhase] = useState('waiting'); // 'waiting', 'countdown', 'selecting', 'selected'
  const [countdown, setCountdown] = useState(3);
  const [selectedId, setSelectedId] = useState(null);
  const countdownTimer = useRef(null);
  const selectionTimer = useRef(null);
  const pulseAnims = useRef({});
  const scaleAnims = useRef({});
  const touchesRef = useRef({});

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
    };
  }, []);

  const getAnimatedValue = (touchId, animRef, defaultValue = 1) => {
    if (!animRef.current[touchId]) {
      animRef.current[touchId] = new Animated.Value(defaultValue);
    }
    return animRef.current[touchId];
  };

  const startCountdown = (touchCount) => {
    if (touchCount < 2) return;

    setPhase('countdown');
    setCountdown(3);

    let count = 3;
    countdownTimer.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      Vibration.vibrate(50);

      if (count <= 0) {
        clearInterval(countdownTimer.current);
        selectRandomPlayer();
      }
    }, 1000);
  };

  const selectRandomPlayer = () => {
    setPhase('selecting');

    const touchIds = Object.keys(touchesRef.current);
    if (touchIds.length === 0) {
      resetGame();
      return;
    }

    // Animate through players rapidly before selecting
    let flashCount = 0;
    const flashInterval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * touchIds.length);
      setSelectedId(touchIds[randomIdx]);
      flashCount++;

      if (flashCount >= 10) {
        clearInterval(flashInterval);

        // Final selection
        const finalIdx = Math.floor(Math.random() * touchIds.length);
        const winnerId = touchIds[finalIdx];
        setSelectedId(winnerId);
        setPhase('selected');
        Vibration.vibrate([0, 100, 50, 100, 50, 200]);

        // Animate winner
        const winnerScale = getAnimatedValue(winnerId, scaleAnims);
        Animated.sequence([
          Animated.timing(winnerScale, {
            toValue: 1.5,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(winnerScale, {
            toValue: 1.2,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, 150);
  };

  const resetGame = () => {
    setPhase('waiting');
    setCountdown(3);
    setSelectedId(null);
    setTouches({});
    touchesRef.current = {};
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
    // Reset all scale animations
    Object.values(scaleAnims.current).forEach(anim => anim.setValue(1));
  };

  const handleTouchStart = (event) => {
    if (phase === 'selected') {
      resetGame();
      return;
    }

    if (phase === 'selecting') return;

    const newTouches = { ...touches };

    for (let i = 0; i < event.nativeEvent.touches.length; i++) {
      const touch = event.nativeEvent.touches[i];
      const id = touch.identifier.toString();

      if (!newTouches[id]) {
        newTouches[id] = {
          x: touch.locationX,
          y: touch.locationY,
          color: COLORS[Object.keys(newTouches).length % COLORS.length],
        };

        // Start pulse animation for new touch
        const pulseAnim = getAnimatedValue(id, pulseAnims);
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.2,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    }

    setTouches(newTouches);
    touchesRef.current = newTouches;

    const touchCount = Object.keys(newTouches).length;
    if (touchCount >= 2 && phase === 'waiting') {
      startCountdown(touchCount);
    }
  };

  const handleTouchMove = (event) => {
    if (phase === 'selecting' || phase === 'selected') return;

    const updatedTouches = { ...touches };

    for (let i = 0; i < event.nativeEvent.touches.length; i++) {
      const touch = event.nativeEvent.touches[i];
      const id = touch.identifier.toString();

      if (updatedTouches[id]) {
        updatedTouches[id] = {
          ...updatedTouches[id],
          x: touch.locationX,
          y: touch.locationY,
        };
      }
    }

    setTouches(updatedTouches);
    touchesRef.current = updatedTouches;
  };

  const handleTouchEnd = (event) => {
    if (phase === 'selected') return;

    if (phase === 'selecting') return;

    // Get IDs of remaining touches
    const remainingIds = new Set();
    for (let i = 0; i < event.nativeEvent.touches.length; i++) {
      remainingIds.add(event.nativeEvent.touches[i].identifier.toString());
    }

    // Filter out removed touches
    const newTouches = {};
    Object.keys(touches).forEach(id => {
      if (remainingIds.has(id)) {
        newTouches[id] = touches[id];
      } else {
        // Stop animation for removed touch
        if (pulseAnims.current[id]) {
          pulseAnims.current[id].stopAnimation();
        }
      }
    });

    setTouches(newTouches);
    touchesRef.current = newTouches;

    // Cancel countdown if less than 2 players
    if (Object.keys(newTouches).length < 2 && phase === 'countdown') {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      setPhase('waiting');
      setCountdown(3);
    }
  };

  const renderTouchIndicator = (id, touch) => {
    const pulseScale = getAnimatedValue(id, pulseAnims);
    const selectionScale = getAnimatedValue(id, scaleAnims);
    const isSelected = selectedId === id;
    const isWinner = phase === 'selected' && isSelected;
    const isLoser = phase === 'selected' && !isSelected;

    return (
      <Animated.View
        key={id}
        style={[
          styles.touchIndicator,
          {
            left: touch.x - 50,
            top: touch.y - 50,
            backgroundColor: touch.color,
            opacity: isLoser ? 0.3 : 1,
            transform: [
              { scale: Animated.multiply(pulseScale, selectionScale) },
            ],
            borderWidth: isSelected && phase === 'selecting' ? 4 : isWinner ? 6 : 0,
            borderColor: '#fff',
          },
        ]}
      >
        {isWinner && (
          <Text style={styles.winnerText}>👆</Text>
        )}
      </Animated.View>
    );
  };

  const getStatusText = () => {
    const touchCount = Object.keys(touches).length;

    switch (phase) {
      case 'waiting':
        if (touchCount === 0) {
          return 'Place your thumbs on the screen';
        } else if (touchCount === 1) {
          return 'Waiting for more players...';
        }
        return 'Hold steady...';
      case 'countdown':
        return countdown.toString();
      case 'selecting':
        return 'Selecting...';
      case 'selected':
        return 'Selected! Tap to play again';
      default:
        return '';
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Touch indicators */}
      {Object.entries(touches).map(([id, touch]) => renderTouchIndicator(id, touch))}

      {/* Status overlay */}
      <View style={styles.statusOverlay} pointerEvents="none">
        <Text
          style={[
            phase === 'countdown' ? styles.countdownText : styles.statusText,
            { color: theme.colors.text },
          ]}
        >
          {getStatusText()}
        </Text>

        {phase === 'waiting' && Object.keys(touches).length > 0 && (
          <Text style={[styles.playerCount, { color: theme.colors.textSecondary }]}>
            {Object.keys(touches).length} player{Object.keys(touches).length !== 1 ? 's' : ''} ready
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  touchIndicator: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  winnerText: {
    fontSize: 40,
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  countdownText: {
    fontSize: 120,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  playerCount: {
    fontSize: 16,
    marginTop: 10,
  },
});
