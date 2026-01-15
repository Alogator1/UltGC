import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Try to import Accelerometer, but handle gracefully if unavailable
let Accelerometer = null;
try {
  Accelerometer = require('expo-sensors').Accelerometer;
} catch (e) {
  // Sensors not available
}

const ANSWERS = [
  // Positive answers
  'Absolutely',
  'The stars align in favor',
  'Fortune smiles upon you',
  'All signs say yes',
  'Destiny approves',
  'The cosmos agree',
  'A clear yes',
  'Fate is on your side',
  'The path is open',
  'Go for it',
  // Uncertain answers
  'The mists are unclear',
  'Seek wisdom elsewhere',
  'The answer hides for now',
  'Patience is needed',
  'Ask once more',
  // Negative answers
  'The fates say otherwise',
  'Not in the cards',
  'Stars advise against it',
  'Unlikely to happen',
  'The orb says no',
];

const SHAKE_THRESHOLD = 2.5;

export default function Magic8BallScreen() {
  const { theme } = useTheme();
  const [answer, setAnswer] = useState(null);
  const [isShaking, setIsShaking] = useState(false);
  const [subscription, setSubscription] = useState(null);

  const orbScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const answerOpacity = useRef(new Animated.Value(0)).current;
  const lastShakeTime = useRef(0);

  useEffect(() => {
    startAccelerometer();
    startGlowAnimation();
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  const startGlowAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startAccelerometer = async () => {
    if (!Accelerometer) return;

    try {
      const isAvailable = await Accelerometer.isAvailableAsync();
      if (!isAvailable) return;

      Accelerometer.setUpdateInterval(100);
      const sub = Accelerometer.addListener(({ x, y, z }) => {
        const acceleration = Math.sqrt(x * x + y * y + z * z);

        if (acceleration > SHAKE_THRESHOLD && !isShaking) {
          const now = Date.now();
          if (now - lastShakeTime.current > 1000) {
            lastShakeTime.current = now;
            revealAnswer();
          }
        }
      });
      setSubscription(sub);
    } catch (e) {
      // Accelerometer not available
      console.log('Accelerometer not available:', e);
    }
  };

  const revealAnswer = () => {
    if (isShaking) return;

    setIsShaking(true);
    setAnswer(null);
    Vibration.vibrate(200);

    // Hide previous answer
    answerOpacity.setValue(0);

    // Shake animation
    Animated.sequence([
      Animated.timing(orbScale, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(orbScale, {
        toValue: 1.08,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(orbScale, {
        toValue: 0.96,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(orbScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Select random answer
      const randomAnswer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
      setAnswer(randomAnswer);

      // Fade in answer
      Animated.timing(answerOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        setIsShaking(false);
      });
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Fortune Orb
      </Text>

      <Text style={[styles.instructions, { color: theme.colors.textSecondary }]}>
        {Accelerometer ? 'Shake your phone or tap the orb' : 'Tap the orb to reveal your fortune'}
      </Text>

      <TouchableOpacity
        onPress={revealAnswer}
        activeOpacity={0.9}
        disabled={isShaking}
      >
        <View style={styles.orbContainer}>
          {/* Outer glow */}
          <Animated.View
            style={[
              styles.outerGlow,
              { opacity: glowOpacity },
            ]}
          />

          {/* Main orb */}
          <Animated.View
            style={[
              styles.orb,
              {
                transform: [{ scale: orbScale }],
              },
            ]}
          >
            {/* Inner gradient effect */}
            <View style={styles.orbInner}>
              <View style={styles.orbHighlight} />

              {/* Answer display */}
              <View style={styles.answerContainer}>
                {answer ? (
                  <Animated.Text
                    style={[
                      styles.answerText,
                      { opacity: answerOpacity },
                    ]}
                  >
                    {answer}
                  </Animated.Text>
                ) : (
                  <Text style={styles.symbolText}>?</Text>
                )}
              </View>
            </View>
          </Animated.View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.askButton, { backgroundColor: theme.colors.primary }]}
        onPress={revealAnswer}
        disabled={isShaking}
      >
        <Text style={styles.askButtonText}>
          {isShaking ? 'Revealing...' : 'Consult the Orb'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  instructions: {
    fontSize: 16,
    marginBottom: 40,
  },
  orbContainer: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#7B68EE',
    shadowColor: '#7B68EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  orb: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#2E1A47',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 3,
    borderColor: '#4A3660',
  },
  orbInner: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#1A0A2E',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  orbHighlight: {
    position: 'absolute',
    top: 15,
    left: 30,
    width: 60,
    height: 40,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ rotate: '-30deg' }],
  },
  answerContainer: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  answerText: {
    color: '#E6E6FA',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  symbolText: {
    color: '#7B68EE',
    fontSize: 80,
    fontWeight: '300',
  },
  askButton: {
    marginTop: 50,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
  },
  askButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
