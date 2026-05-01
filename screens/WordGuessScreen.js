import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Animated,
  PanResponder,
  Vibration,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { PLAYER_SELECTOR_COLORS as TEAM_COLORS } from '../constants/colors';
import { WORD_GUESS_DEFAULTS } from '../constants/gameConfig';
import wordsData from '../constants/words.json';
import GameHeader from '../components/GameHeader';

const SWIPE_THRESHOLD = 80;

export default function WordGuessScreen() {
  const { theme } = useTheme();

  // Game phase: 'setup', 'ready', 'playing', 'paused', 'roundEnd', 'gameOver'
  const [phase, setPhase] = useState('setup');

  // Teams
  const [teams, setTeams] = useState(() => getInitialTeams(2));
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [editingTeamId, setEditingTeamId] = useState(null);

  // Settings
  const [settings, setSettings] = useState({
    categories: ['Common'],
    roundTime: WORD_GUESS_DEFAULTS.roundTime,
    skipPenalty: WORD_GUESS_DEFAULTS.skipPenalty,
    targetScore: WORD_GUESS_DEFAULTS.targetScore,
    lastWordRule: WORD_GUESS_DEFAULTS.lastWordRule,
    soundEnabled: WORD_GUESS_DEFAULTS.soundEnabled,
  });
  const [showSettings, setShowSettings] = useState(false);

  // Game state
  const [availableWords, setAvailableWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [guessedWords, setGuessedWords] = useState([]);
  const [skippedWords, setSkippedWords] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(settings.roundTime);
  const [usedWords, setUsedWords] = useState(new Set());
  const [streak, setStreak] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [lastWord, setLastWord] = useState(null);

  // Animation refs
  const cardPosition = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState('green');

  // Timer ref
  const timerRef = useRef(null);

  // Refs for PanResponder callbacks (to avoid stale closures)
  const phaseRef = useRef(phase);
  const handleCorrectRef = useRef(null);
  const handleSkipRef = useRef(null);

  // Keep refs updated
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Get initial teams with random names
  function getInitialTeams(count) {
    const shuffledNames = [...wordsData.teamNames].sort(() => Math.random() - 0.5);
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: shuffledNames[i] || `Team ${i + 1}`,
      score: 0,
      color: TEAM_COLORS[i % TEAM_COLORS.length],
    }));
  }

  // Shuffle words for a new round (returns array of {word, category} objects)
  const shuffleWords = useCallback(() => {
    const categoryWords = wordsData.words
      .filter(cat => settings.categories.includes(cat.category))
      .flatMap(cat => cat.words.map(word => ({ word, category: cat.category })));

    const unusedWords = categoryWords.filter(item => !usedWords.has(item.word));
    const shuffled = unusedWords.sort(() => Math.random() - 0.5);

    // If running low on words, reset used words
    if (shuffled.length < 20) {
      setUsedWords(new Set());
      return categoryWords.sort(() => Math.random() - 0.5);
    }

    return shuffled;
  }, [settings.categories, usedWords]);

  // Start game - goes to ready phase first
  const startGame = () => {
    const words = shuffleWords();
    setAvailableWords(words);
    setCurrentWordIndex(0);
    setGuessedWords([]);
    setSkippedWords([]);
    setTimeRemaining(settings.roundTime);
    setStreak(0);
    setPhase('ready');
  };

  // Start round - actually starts the timer
  const startRound = () => {
    setPhase('playing');
    startTimer();
  };

  // Start timer
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleRoundEnd();
          return 0;
        }
        // Warning vibration at 10 seconds
        if (prev === 11 && settings.soundEnabled) {
          Vibration.vibrate(100);
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Pause/Resume
  const togglePause = () => {
    if (phase === 'playing') {
      clearInterval(timerRef.current);
      setPhase('paused');
    } else if (phase === 'paused') {
      setPhase('playing');
      startTimer();
    }
  };

  // Handle round end
  const handleRoundEnd = () => {
    clearInterval(timerRef.current);

    // Handle last word based on rule
    const currentItem = availableWords[currentWordIndex];
    if (currentItem && settings.lastWordRule !== 'lost') {
      setLastWord(currentItem.word);
    }

    setPhase('roundEnd');

    // Check for winner
    const currentTeam = teams[currentTeamIndex];
    const roundPoints = guessedWords.length + (settings.skipPenalty * skippedWords.length);
    const newScore = currentTeam.score + roundPoints;

    if (newScore >= settings.targetScore) {
      // Update score and end game
      setTeams(prev => prev.map((t, i) =>
        i === currentTeamIndex ? { ...t, score: newScore } : t
      ));
      setTimeout(() => setPhase('gameOver'), 100);
    }
  };

  // Handle correct guess (swipe up)
  const handleCorrect = () => {
    const currentItem = availableWords[currentWordIndex];
    if (!currentItem) return;

    setGuessedWords(prev => [...prev, currentItem.word]);
    setUsedWords(prev => new Set([...prev, currentItem.word]));
    setStreak(prev => prev + 1);

    // Bonus point for streak of 3+
    const bonusPoint = streak >= 2 ? 1 : 0;
    if (bonusPoint && settings.soundEnabled) {
      Vibration.vibrate([0, 50, 50, 50]);
    } else if (settings.soundEnabled) {
      Vibration.vibrate(50);
    }

    // Visual feedback
    showFlash('green');
    animateCardOut(-300);

    nextWord();
  };

  // Handle skip (swipe down)
  const handleSkip = () => {
    const currentItem = availableWords[currentWordIndex];
    if (!currentItem) return;

    setSkippedWords(prev => [...prev, currentItem.word]);
    setStreak(0);

    if (settings.soundEnabled) {
      Vibration.vibrate(100);
    }

    // Visual feedback
    showFlash('red');
    animateCardOut(300);

    nextWord();
  };

  // Move to next word
  const nextWord = () => {
    if (currentWordIndex >= availableWords.length - 1) {
      // Out of words, end round
      handleRoundEnd();
      return;
    }
    setCurrentWordIndex(prev => prev + 1);
  };

  // Animate card out
  const animateCardOut = (toValue) => {
    Animated.parallel([
      Animated.timing(cardPosition, {
        toValue,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      cardPosition.setValue(0);
      cardOpacity.setValue(1);
    });
  };

  // Show flash feedback
  const showFlash = (color) => {
    setFlashColor(color);
    flashOpacity.setValue(0.4);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Keep handler refs updated
  useEffect(() => {
    handleCorrectRef.current = handleCorrect;
    handleSkipRef.current = handleSkip;
  });

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => phaseRef.current === 'playing',
      onMoveShouldSetPanResponder: () => phaseRef.current === 'playing',
      onPanResponderMove: (_, gestureState) => {
        if (phaseRef.current === 'playing') {
          cardPosition.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (phaseRef.current !== 'playing') {
          cardPosition.setValue(0);
          return;
        }
        if (gestureState.dy < -SWIPE_THRESHOLD) {
          handleCorrectRef.current?.();
        } else if (gestureState.dy > SWIPE_THRESHOLD) {
          handleSkipRef.current?.();
        } else {
          // Snap back
          Animated.spring(cardPosition, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Continue to next team
  const nextTeam = () => {
    // Update current team's score
    const roundPoints = guessedWords.length + (settings.skipPenalty * skippedWords.length);
    setTeams(prev => prev.map((t, i) =>
      i === currentTeamIndex ? { ...t, score: t.score + roundPoints } : t
    ));

    // Move to next team
    const nextIndex = (currentTeamIndex + 1) % teams.length;
    setCurrentTeamIndex(nextIndex);
    setRoundNumber(prev => prev + 1);

    // Reset for next round
    const words = shuffleWords();
    setAvailableWords(words);
    setCurrentWordIndex(0);
    setGuessedWords([]);
    setSkippedWords([]);
    setTimeRemaining(settings.roundTime);
    setStreak(0);
    setLastWord(null);
    setPhase('ready');
  };

  // Reset game
  const resetGame = () => {
    clearInterval(timerRef.current);
    setTeams(getInitialTeams(teams.length));
    setCurrentTeamIndex(0);
    setRoundNumber(1);
    setUsedWords(new Set());
    setPhase('setup');
  };

  // Play again with same teams
  const playAgain = () => {
    clearInterval(timerRef.current);
    setTeams(prev => prev.map(t => ({ ...t, score: 0 })));
    setCurrentTeamIndex(0);
    setRoundNumber(1);
    setUsedWords(new Set());
    setPhase('setup');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      Vibration.cancel();
    };
  }, []);

  // Get all categories from words.json
  const allCategories = wordsData.words.map(cat => cat.category);

  // Render setup screen
  const renderSetup = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <GameHeader title="Word Guess" />

      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Teams</Text>

      {/* Team count selector */}
      <View style={styles.teamCountRow}>
        {[2, 3, 4].map(count => (
          <TouchableOpacity
            key={count}
            style={[
              styles.teamCountButton,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              teams.length === count && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
            onPress={() => setTeams(getInitialTeams(count))}
          >
            <Text style={[
              styles.teamCountText,
              { color: teams.length === count ? '#fff' : theme.colors.text },
            ]}>
              {count} Teams
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Team names */}
      {teams.map((team, index) => (
        <View
          key={team.id}
          style={[
            styles.teamCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderLeftColor: team.color }
          ]}
        >
          <View style={styles.teamCardHeader}>
            {editingTeamId === team.id ? (
              <TextInput
                style={[styles.nameInput, { color: theme.colors.text, borderBottomColor: theme.colors.primary }]}
                value={team.name}
                onChangeText={(text) => setTeams(prev =>
                  prev.map((t, i) => i === index ? { ...t, name: text } : t)
                )}
                onBlur={() => setEditingTeamId(null)}
                autoFocus
                selectTextOnFocus
              />
            ) : (
              <TouchableOpacity onPress={() => setEditingTeamId(team.id)} style={{ flex: 1 }}>
                <Text style={[styles.teamName, { color: theme.colors.text }]}>{team.name}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.shuffleButton}
              onPress={() => {
                const randomName = wordsData.teamNames[Math.floor(Math.random() * wordsData.teamNames.length)];
                setTeams(prev => prev.map((t, i) => i === index ? { ...t, name: randomName } : t));
              }}
            >
              <Text style={{ fontSize: 20 }}>🎲</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={[styles.sectionTitle, { color: theme.colors.text, marginTop: 20 }]}>Categories</Text>

      {/* Category selection */}
      <View style={styles.categoriesGrid}>
        {allCategories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              settings.categories.includes(category) && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
            onPress={() => {
              setSettings(prev => ({
                ...prev,
                categories: prev.categories.includes(category)
                  ? prev.categories.filter(c => c !== category)
                  : [...prev.categories, category],
              }));
            }}
          >
            <Text style={[
              styles.categoryText,
              { color: settings.categories.includes(category) ? '#fff' : theme.colors.text },
            ]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Settings button */}
      <TouchableOpacity
        style={[styles.settingsButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={() => setShowSettings(true)}
      >
        <Text style={[styles.settingsButtonText, { color: theme.colors.text }]}>Game Settings</Text>
      </TouchableOpacity>

      {/* Quick settings preview */}
      <View style={[styles.settingsPreview, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.previewText, { color: theme.colors.textSecondary }]}>
          {settings.roundTime}s rounds • Target: {settings.targetScore} pts • Skip: {settings.skipPenalty === 0 ? 'No penalty' : `${settings.skipPenalty} pt`}
        </Text>
      </View>

      {/* Start button */}
      <TouchableOpacity
        style={[
          styles.startButton,
          { backgroundColor: theme.colors.success },
          settings.categories.length === 0 && { opacity: 0.5 },
        ]}
        onPress={startGame}
        disabled={settings.categories.length === 0}
      >
        <Text style={styles.startButtonText}>Start Game</Text>
      </TouchableOpacity>

      {/* How to Play section */}
      <View style={[styles.infoSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.infoTitle, { color: theme.colors.text }]}>How to Play</Text>
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          • One player explains the word without saying it{'\n'}
          • Swipe UP when your team guesses correctly{'\n'}
          • Swipe DOWN to skip a difficult word{'\n'}
          • Get as many words as possible before time runs out{'\n'}
          • First team to reach the target score wins!
        </Text>
      </View>
    </ScrollView>
  );

  // Render ready screen (before round starts)
  const renderReady = () => {
    const currentTeam = teams[currentTeamIndex];

    return (
      <View style={styles.readyContainer}>
        {/* Team indicator */}
        <View style={[styles.readyTeamBanner, { backgroundColor: currentTeam.color }]}>
          <Text style={styles.readyTeamText}>{currentTeam.name}</Text>
          <Text style={styles.readyRoundText}>Round {roundNumber}</Text>
        </View>

        <View style={styles.readyContent}>
          <Text style={[styles.readyTitle, { color: theme.colors.text }]}>
            Get Ready!
          </Text>

          <Text style={[styles.readySubtitle, { color: theme.colors.textSecondary }]}>
            Pass the phone to the explainer
          </Text>

          {/* Practice area */}
          <View style={[styles.practiceCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.practiceSwipeHint}>
              <Text style={[styles.practiceArrow, { color: theme.colors.success }]}>⬆</Text>
              <Text style={[styles.practiceHintText, { color: theme.colors.success }]}>Swipe UP = Correct</Text>
            </View>

            <View style={[styles.practiceDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.practiceSwipeHint}>
              <Text style={[styles.practiceArrow, { color: theme.colors.danger }]}>⬇</Text>
              <Text style={[styles.practiceHintText, { color: theme.colors.danger }]}>Swipe DOWN = Skip</Text>
            </View>
          </View>

          {/* Timer preview */}
          <View style={[styles.timerPreview, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.timerPreviewLabel, { color: theme.colors.textSecondary }]}>
              Time limit
            </Text>
            <Text style={[styles.timerPreviewValue, { color: theme.colors.text }]}>
              {settings.roundTime} seconds
            </Text>
          </View>

          {/* Start button */}
          <TouchableOpacity
            style={[styles.startRoundButton, { backgroundColor: theme.colors.success }]}
            onPress={startRound}
          >
            <Text style={styles.startRoundButtonText}>Start Round</Text>
          </TouchableOpacity>

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backToSetupButton, { borderColor: theme.colors.border }]}
            onPress={() => setPhase('setup')}
          >
            <Text style={[styles.backToSetupText, { color: theme.colors.textSecondary }]}>
              Back to Setup
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render playing screen
  const renderPlaying = () => {
    const currentItem = availableWords[currentWordIndex];
    const currentWord = currentItem?.word || 'Loading...';
    const currentCategory = currentItem?.category || '';
    const currentTeam = teams[currentTeamIndex];
    const isLowTime = timeRemaining <= 10;

    return (
      <View style={styles.playingContainer}>
        {/* Flash overlay */}
        <Animated.View
          style={[
            styles.flashOverlay,
            {
              backgroundColor: flashColor === 'green' ? theme.colors.success : theme.colors.danger,
              opacity: flashOpacity,
            }
          ]}
          pointerEvents="none"
        />

        {/* Team indicator */}
        <View style={[styles.teamIndicator, { backgroundColor: currentTeam.color }]}>
          <Text style={styles.teamIndicatorText}>{currentTeam.name}</Text>
        </View>

        {/* Timer */}
        <View style={[styles.timerContainer, isLowTime && { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
          <Text style={[
            styles.timerText,
            { color: isLowTime ? theme.colors.danger : theme.colors.text }
          ]}>
            {timeRemaining}
          </Text>
        </View>

        {/* Score display */}
        <View style={styles.scoreRow}>
          {teams.map((team, i) => (
            <View
              key={team.id}
              style={[
                styles.scoreItem,
                i === currentTeamIndex && styles.activeScoreItem,
                { borderBottomColor: team.color }
              ]}
            >
              <Text style={[styles.scoreTeamName, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {team.name.split(' ')[0]}
              </Text>
              <Text style={[styles.scoreValue, { color: theme.colors.text }]}>
                {team.score + (i === currentTeamIndex ? guessedWords.length + (settings.skipPenalty * skippedWords.length) : 0)}
              </Text>
            </View>
          ))}
        </View>

        {/* Word card */}
        <View style={styles.cardContainer} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.wordCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                transform: [{ translateY: cardPosition }],
                opacity: cardOpacity,
              }
            ]}
          >
            {currentCategory && (
              <Text style={[styles.categoryLabel, { color: theme.colors.textTertiary }]}>
                {currentCategory}
              </Text>
            )}
            <Text style={[styles.wordText, { color: theme.colors.text }]}>{currentWord}</Text>

            {streak >= 3 && (
              <View style={[styles.streakBadge, { backgroundColor: theme.colors.warning }]}>
                <Text style={styles.streakText}>🔥 {streak} streak!</Text>
              </View>
            )}
          </Animated.View>

          {/* Swipe hints */}
          <View style={styles.swipeHints}>
            <Text style={[styles.swipeHint, { color: theme.colors.success }]}>⬆ CORRECT</Text>
            <Text style={[styles.swipeHint, { color: theme.colors.danger }]}>⬇ SKIP</Text>
          </View>
        </View>

        {/* Round stats */}
        <View style={styles.roundStats}>
          <Text style={[styles.roundStatText, { color: theme.colors.success }]}>
            ✓ {guessedWords.length}
          </Text>
          <Text style={[styles.roundStatText, { color: theme.colors.danger }]}>
            ✗ {skippedWords.length}
          </Text>
        </View>

        {/* Pause button */}
        <TouchableOpacity
          style={[styles.pauseButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={togglePause}
        >
          <Text style={{ fontSize: 24 }}>⏸</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render paused overlay
  const renderPaused = () => (
    <View style={[styles.pausedOverlay, { backgroundColor: theme.colors.overlay }]}>
      <View style={[styles.pausedModal, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.pausedTitle, { color: theme.colors.text }]}>Game Paused</Text>
        <TouchableOpacity
          style={[styles.resumeButton, { backgroundColor: theme.colors.primary }]}
          onPress={togglePause}
        >
          <Text style={styles.buttonText}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quitButton, { borderColor: theme.colors.danger }]}
          onPress={() => {
            Alert.alert(
              'Quit Game',
              'Are you sure you want to quit?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Quit', style: 'destructive', onPress: resetGame },
              ]
            );
          }}
        >
          <Text style={[styles.quitButtonText, { color: theme.colors.danger }]}>Quit Game</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Move word between guessed and skipped
  const moveWordToGuessed = (word) => {
    setSkippedWords(prev => prev.filter(w => w !== word));
    setGuessedWords(prev => [...prev, word]);
  };

  const moveWordToSkipped = (word) => {
    setGuessedWords(prev => prev.filter(w => w !== word));
    setSkippedWords(prev => [...prev, word]);
  };

  const removeWord = (word, fromGuessed) => {
    if (fromGuessed) {
      setGuessedWords(prev => prev.filter(w => w !== word));
    } else {
      setSkippedWords(prev => prev.filter(w => w !== word));
    }
  };

  // Handle last word continue guess
  const handleLastWordGuessed = () => {
    setGuessedWords(prev => [...prev, lastWord]);
    setLastWord(null);
  };

  const handleLastWordSkipped = () => {
    setSkippedWords(prev => [...prev, lastWord]);
    setLastWord(null);
  };

  // Render round end screen
  const renderRoundEnd = () => {
    const currentTeam = teams[currentTeamIndex];
    const correctPoints = guessedWords.length;
    const skipPoints = settings.skipPenalty * skippedWords.length;
    const totalPoints = correctPoints + skipPoints;

    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.roundEndHeader, { backgroundColor: currentTeam.color }]}>
          <Text style={styles.roundEndTeam}>{currentTeam.name}</Text>
          <Text style={styles.roundEndPoints}>+{totalPoints} points</Text>
        </View>

        {/* Last word - Continue guessing option */}
        {lastWord && settings.lastWordRule === 'continue' && (
          <View style={[styles.lastWordContinue, { backgroundColor: theme.colors.surface, borderColor: theme.colors.warning }]}>
            <Text style={[styles.lastWordContinueTitle, { color: theme.colors.text }]}>
              Last word:
            </Text>
            <Text style={[styles.lastWordContinueWord, { color: theme.colors.primary }]}>
              "{lastWord}"
            </Text>
            <Text style={[styles.lastWordContinueHint, { color: theme.colors.textSecondary }]}>
              Take your time to guess!
            </Text>
            <View style={styles.lastWordButtons}>
              <TouchableOpacity
                style={[styles.lastWordButton, { backgroundColor: theme.colors.success }]}
                onPress={handleLastWordGuessed}
              >
                <Text style={styles.buttonText}>✓ Guessed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.lastWordButton, { backgroundColor: theme.colors.danger }]}
                onPress={handleLastWordSkipped}
              >
                <Text style={styles.buttonText}>✗ Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.wordsList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.wordsListTitle, { color: theme.colors.success }]}>
            Correct ({guessedWords.length})
          </Text>
          {guessedWords.map((word, i) => (
            <View key={i} style={styles.editableWordRow}>
              <Text style={[styles.wordItemText, { color: theme.colors.text }]}>✓ {word}</Text>
              <View style={styles.wordActions}>
                <TouchableOpacity
                  style={[styles.wordActionButton, { backgroundColor: theme.colors.danger }]}
                  onPress={() => moveWordToSkipped(word)}
                >
                  <Text style={styles.wordActionText}>−</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.wordActionButton, { backgroundColor: theme.colors.textSecondary }]}
                  onPress={() => removeWord(word, true)}
                >
                  <Text style={styles.wordActionText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {guessedWords.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.colors.textTertiary }]}>No words guessed</Text>
          )}

          <Text style={[styles.wordsListTitle, { color: theme.colors.danger, marginTop: 16 }]}>
            Skipped ({skippedWords.length}) {settings.skipPenalty !== 0 && `(${settings.skipPenalty * skippedWords.length} pts)`}
          </Text>
          {skippedWords.map((word, i) => (
            <View key={i} style={styles.editableWordRow}>
              <Text style={[styles.wordItemText, { color: theme.colors.textSecondary }]}>✗ {word}</Text>
              <View style={styles.wordActions}>
                <TouchableOpacity
                  style={[styles.wordActionButton, { backgroundColor: theme.colors.success }]}
                  onPress={() => moveWordToGuessed(word)}
                >
                  <Text style={styles.wordActionText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.wordActionButton, { backgroundColor: theme.colors.textSecondary }]}
                  onPress={() => removeWord(word, false)}
                >
                  <Text style={styles.wordActionText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {skippedWords.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.colors.textTertiary }]}>No words skipped</Text>
          )}
        </View>

        {/* Last word handling for other rules */}
        {lastWord && settings.lastWordRule !== 'lost' && settings.lastWordRule !== 'continue' && (
          <View style={[styles.lastWordSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.lastWordTitle, { color: theme.colors.text }]}>
              Last word: "{lastWord}"
            </Text>
            <Text style={[styles.lastWordSubtitle, { color: theme.colors.textSecondary }]}>
              {settings.lastWordRule === 'nextTeam'
                ? `Goes to ${teams[(currentTeamIndex + 1) % teams.length].name}`
                : 'All teams can try!'}
            </Text>
          </View>
        )}

        {/* Current standings */}
        <View style={[styles.standings, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.standingsTitle, { color: theme.colors.text }]}>Standings</Text>
          {[...teams]
            .map((t, i) => ({
              ...t,
              displayScore: t.score + (i === currentTeamIndex ? totalPoints : 0)
            }))
            .sort((a, b) => b.displayScore - a.displayScore)
            .map((team, i) => (
              <View key={team.id} style={[styles.standingRow, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.standingName, { color: theme.colors.text }]}>
                  {i + 1}. {team.name}
                </Text>
                <Text style={[styles.standingScore, { color: team.color }]}>
                  {team.displayScore} pts
                </Text>
              </View>
            ))}
        </View>

        <TouchableOpacity
          style={[styles.nextTeamButton, { backgroundColor: theme.colors.success }]}
          onPress={nextTeam}
        >
          <Text style={styles.buttonText}>
            Next: {teams[(currentTeamIndex + 1) % teams.length].name}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // Render game over screen
  const renderGameOver = () => {
    const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
    const winner = sortedTeams[0];

    return (
      <View style={styles.gameOverContainer}>
        <View style={[styles.winnerBanner, { backgroundColor: winner.color }]}>
          <Text style={styles.winnerEmoji}>🏆</Text>
          <Text style={styles.winnerTitle}>{winner.name}</Text>
          <Text style={styles.winnerScore}>{winner.score} points</Text>
        </View>

        <View style={[styles.finalStandings, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.finalStandingsTitle, { color: theme.colors.text }]}>Final Results</Text>
          {sortedTeams.map((team, i) => (
            <View key={team.id} style={[styles.finalStandingRow, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.finalStandingRank, { color: theme.colors.textSecondary }]}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
              </Text>
              <Text style={[styles.finalStandingName, { color: theme.colors.text }]}>
                {team.name}
              </Text>
              <Text style={[styles.finalStandingScore, { color: team.color }]}>
                {team.score}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.gameOverButtons}>
          <TouchableOpacity
            style={[styles.playAgainButton, { backgroundColor: theme.colors.success }]}
            onPress={playAgain}
          >
            <Text style={styles.buttonText}>Play Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.newGameButton, { backgroundColor: theme.colors.primary }]}
            onPress={resetGame}
          >
            <Text style={styles.buttonText}>New Game</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Settings modal
  const renderSettingsModal = () => (
    <Modal
      visible={showSettings}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSettings(false)}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
        <View style={[styles.settingsModal, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Game Settings</Text>

          {/* Round Duration */}
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Round Duration</Text>
          <View style={styles.optionRow}>
            {[30, 60, 90].map(time => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  settings.roundTime === time && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setSettings(prev => ({ ...prev, roundTime: time }))}
              >
                <Text style={[
                  styles.optionText,
                  { color: settings.roundTime === time ? '#fff' : theme.colors.text },
                ]}>
                  {time}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Skip Penalty */}
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Skip Penalty</Text>
          <View style={styles.optionRow}>
            {[0, -1].map(penalty => (
              <TouchableOpacity
                key={penalty}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  settings.skipPenalty === penalty && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setSettings(prev => ({ ...prev, skipPenalty: penalty }))}
              >
                <Text style={[
                  styles.optionText,
                  { color: settings.skipPenalty === penalty ? '#fff' : theme.colors.text },
                ]}>
                  {penalty === 0 ? 'None' : `${penalty} pt`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Target Score */}
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Target Score</Text>
          <View style={styles.optionRow}>
            {[20, 30, 50].map(score => (
              <TouchableOpacity
                key={score}
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  settings.targetScore === score && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setSettings(prev => ({ ...prev, targetScore: score }))}
              >
                <Text style={[
                  styles.optionText,
                  { color: settings.targetScore === score ? '#fff' : theme.colors.text },
                ]}>
                  {score} pts
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Last Word Rule */}
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>When Timer Ends</Text>
          <View style={styles.optionColumn}>
            {[
              { value: 'lost', label: 'Word is lost' },
              { value: 'continue', label: 'Continue guessing' },
              { value: 'nextTeam', label: 'Goes to next team' },
              { value: 'allTeams', label: 'All teams try' },
            ].map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButtonWide,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  settings.lastWordRule === option.value && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
                onPress={() => setSettings(prev => ({ ...prev, lastWordRule: option.value }))}
              >
                <Text style={[
                  styles.optionText,
                  { color: settings.lastWordRule === option.value ? '#fff' : theme.colors.text },
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sound Toggle */}
          <TouchableOpacity
            style={[styles.soundToggle, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            onPress={() => setSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
          >
            <Text style={[styles.soundToggleText, { color: theme.colors.text }]}>
              Sound & Vibration
            </Text>
            <Text style={{ fontSize: 24 }}>
              {settings.soundEnabled ? '🔔' : '🔕'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.closeModalButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowSettings(false)}
          >
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {phase === 'setup' && renderSetup()}
      {phase === 'ready' && renderReady()}
      {phase === 'playing' && renderPlaying()}
      {phase === 'paused' && (
        <>
          {renderPlaying()}
          {renderPaused()}
        </>
      )}
      {phase === 'roundEnd' && renderRoundEnd()}
      {phase === 'gameOver' && renderGameOver()}
      {renderSettingsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Section titles
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },

  // Team count
  teamCountRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  teamCountButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  teamCountText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Team cards
  teamCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  teamCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    borderBottomWidth: 2,
    flex: 1,
    padding: 0,
  },
  shuffleButton: {
    padding: 8,
    marginLeft: 8,
  },

  // Categories
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 14,
  },

  // Settings button
  settingsButton: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Settings preview
  settingsPreview: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 13,
  },

  // Start button
  startButton: {
    marginTop: 20,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  // Info section
  infoSection: {
    marginTop: 20,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Ready screen
  readyContainer: {
    flex: 1,
  },
  readyTeamBanner: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  readyTeamText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  readyRoundText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 4,
  },
  readyContent: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  readySubtitle: {
    fontSize: 16,
    marginBottom: 30,
  },
  practiceCard: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  practiceSwipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  practiceArrow: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  practiceHintText: {
    fontSize: 18,
    fontWeight: '600',
  },
  practiceDivider: {
    height: 1,
    marginVertical: 8,
  },
  timerPreview: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 30,
  },
  timerPreviewLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  timerPreviewValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  startRoundButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  startRoundButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  backToSetupButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
  },
  backToSetupText: {
    fontSize: 14,
  },

  // Playing screen
  playingContainer: {
    flex: 1,
    alignItems: 'center',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  teamIndicator: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  teamIndicatorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timerContainer: {
    marginTop: 16,
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  scoreItem: {
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 2,
    minWidth: 60,
  },
  activeScoreItem: {
    borderBottomWidth: 4,
  },
  scoreTeamName: {
    fontSize: 11,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  wordCard: {
    width: '100%',
    padding: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  categoryLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  wordText: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  streakBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  swipeHints: {
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
  },
  swipeHint: {
    fontSize: 14,
    fontWeight: '600',
  },
  roundStats: {
    flexDirection: 'row',
    gap: 24,
    paddingVertical: 16,
  },
  roundStatText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pauseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 100,
  },
  pausedModal: {
    borderRadius: 20,
    padding: 30,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  pausedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  resumeButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  quitButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  quitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Round end
  roundEndHeader: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
  },
  roundEndTeam: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  roundEndPoints: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 4,
  },
  wordsList: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  wordsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  wordItem: {
    fontSize: 15,
    paddingVertical: 3,
  },
  editableWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  wordItemText: {
    fontSize: 15,
    flex: 1,
  },
  wordActions: {
    flexDirection: 'row',
    gap: 8,
  },
  wordActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  lastWordContinue: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 16,
  },
  lastWordContinueTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  lastWordContinueWord: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  lastWordContinueHint: {
    fontSize: 13,
    marginBottom: 16,
  },
  lastWordButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  lastWordButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  lastWordSection: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  lastWordTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  lastWordSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  standings: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  standingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  standingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  standingName: {
    fontSize: 16,
  },
  standingScore: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextTeamButton: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },

  // Game over
  gameOverContainer: {
    flex: 1,
  },
  winnerBanner: {
    padding: 40,
    alignItems: 'center',
  },
  winnerEmoji: {
    fontSize: 60,
  },
  winnerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
  },
  winnerScore: {
    color: '#fff',
    fontSize: 20,
    marginTop: 4,
  },
  finalStandings: {
    margin: 20,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  finalStandingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  finalStandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  finalStandingRank: {
    fontSize: 20,
    width: 40,
  },
  finalStandingName: {
    fontSize: 16,
    flex: 1,
  },
  finalStandingScore: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  gameOverButtons: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    gap: 12,
  },
  playAgainButton: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  newGameButton: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },

  // Settings modal
  settingsModal: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionColumn: {
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionButtonWide: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  soundToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 20,
  },
  soundToggleText: {
    fontSize: 16,
  },
  closeModalButton: {
    marginTop: 24,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
});
