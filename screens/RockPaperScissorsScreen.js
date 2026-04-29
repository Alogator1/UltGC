import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';
import AdBanner from '../components/AdBanner';

const CHOICES = [
  { id: 'rock', emoji: '🪨', label: 'Rock' },
  { id: 'paper', emoji: '📄', label: 'Paper' },
  { id: 'scissors', emoji: '✂️', label: 'Scissors' },
];

const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

function getResult(a, b) {
  if (a === b) return 'draw';
  return BEATS[a] === b ? 'win' : 'lose';
}

const EMPTY_SCORES = { me: 0, opponent: 0, draws: 0 };

export default function RockPaperScissorsScreen() {
  const { theme } = useTheme();
  const room = useRoom('RPS');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  // ── Offline state ─────────────────────────────────────────────────────────────
  const [myChoice, setMyChoice] = useState(null);
  const [aiChoice, setAiChoice] = useState(null);
  const [scores, setScores] = useState(EMPTY_SCORES);
  const [phase, setPhase] = useState('picking'); // 'picking' | 'result'
  const [offlineResult, setOfflineResult] = useState('');
  const [roundCount, setRoundCount] = useState(1);

  // ── Animations ────────────────────────────────────────────────────────────────
  const revealAnim = useRef(new Animated.Value(0)).current;

  const animateReveal = () => {
    revealAnim.setValue(0);
    Animated.spring(revealAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  };

  // ── Online derived state ──────────────────────────────────────────────────────
  const onlinePicks = room.sharedState?.picks ?? {};
  const onlineScores = room.sharedState?.scores ?? {};
  const onlineRound = room.sharedState?.round ?? 1;
  const onlineRevealed = room.sharedState?.revealed ?? false;

  const myOnlinePick = onlinePicks[room.userId];
  const opponentPlayer = room.players.find((p) => p.id !== room.userId);
  const opponentId = opponentPlayer?.id;
  const opponentPick = opponentId ? onlinePicks[opponentId] : null;
  const bothPicked = !!(myOnlinePick && opponentPick);
  const isWaiting = room.isOnline && room.players.length < 2;

  // Track which reveal we've already animated
  const handledRevealRef = useRef(null);

  // ── Online: host resolves round when both players have picked ─────────────────
  useEffect(() => {
    if (!room.isOnline || !bothPicked || onlineRevealed || !room.isHost) return;
    const key = `${onlineRound}-${onlinePicks[room.userId]}-${onlinePicks[opponentId]}`;
    if (handledRevealRef.current === key) return;
    handledRevealRef.current = key;

    const result = getResult(onlinePicks[room.userId], onlinePicks[opponentId]);
    const myNew = (onlineScores[room.userId] ?? 0) + (result === 'win' ? 1 : 0);
    const oppNew = (onlineScores[opponentId] ?? 0) + (result === 'lose' ? 1 : 0);
    const drawNew = (onlineScores.draws ?? 0) + (result === 'draw' ? 1 : 0);

    room.updateSharedState({
      picks: onlinePicks,
      scores: { ...onlineScores, [room.userId]: myNew, [opponentId]: oppNew, draws: drawNew },
      round: onlineRound,
      revealed: true,
    });
  }, [bothPicked, onlineRevealed, room.isHost, onlineRound]);

  // ── Online: animate reveal when state flips to revealed ──────────────────────
  useEffect(() => {
    if (room.isOnline && onlineRevealed && bothPicked) {
      animateReveal();
    }
  }, [onlineRevealed]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { room.deleteRoom(); };
  }, []);

  // ── Online: host initialises shared state when room is created ───────────────
  useEffect(() => {
    if (room.isOnline && room.isHost && room.sharedState?.round === undefined) {
      room.updateSharedState({ picks: {}, scores: {}, round: 1, revealed: false });
    }
  }, [room.isOnline, room.isHost]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handlePick = (choice) => {
    if (room.isOnline) {
      if (myOnlinePick || onlineRevealed) return;
      room.updateSharedState({
        picks: { ...onlinePicks, [room.userId]: choice },
        scores: onlineScores,
        round: onlineRound,
        revealed: false,
      });
    } else {
      const ai = CHOICES[Math.floor(Math.random() * 3)].id;
      const result = getResult(choice, ai);
      setMyChoice(choice);
      setAiChoice(ai);
      setOfflineResult(
        result === 'win' ? '🎉 You Win!' : result === 'lose' ? '😔 AI Wins!' : '🤝 Draw!'
      );
      setScores((prev) => ({
        me: prev.me + (result === 'win' ? 1 : 0),
        opponent: prev.opponent + (result === 'lose' ? 1 : 0),
        draws: prev.draws + (result === 'draw' ? 1 : 0),
      }));
      setPhase('result');
      animateReveal();
    }
  };

  const nextRound = () => {
    if (room.isOnline) {
      if (!room.isHost && !room.allCanEdit) return;
      room.updateSharedState({
        picks: {},
        scores: onlineScores,
        round: onlineRound + 1,
        revealed: false,
      });
    } else {
      setMyChoice(null);
      setAiChoice(null);
      setPhase('picking');
      setRoundCount((r) => r + 1);
    }
  };

  const resetGame = () => {
    Alert.alert('Reset Game', 'Reset all scores?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          if (room.isOnline) {
            if (!room.isHost && !room.allCanEdit) return;
            room.updateSharedState({ picks: {}, scores: {}, round: 1, revealed: false });
          } else {
            setMyChoice(null);
            setAiChoice(null);
            setScores(EMPTY_SCORES);
            setPhase('picking');
            setRoundCount(1);
          }
        },
      },
    ]);
  };

  // ── Derived display values ────────────────────────────────────────────────────

  const myName = room.players.find((p) => p.id === room.userId)?.displayName ?? 'You';
  const opponentName = opponentPlayer?.displayName ?? 'Opponent';

  const displayScores = room.isOnline
    ? {
        me: onlineScores[room.userId] ?? 0,
        opponent: onlineScores[opponentId] ?? 0,
        draws: onlineScores.draws ?? 0,
      }
    : scores;

  const showReveal = room.isOnline ? onlineRevealed : phase === 'result';
  const currentRound = room.isOnline ? onlineRound : roundCount;
  const canNextRound = !room.isOnline || room.isHost || room.allCanEdit;

  const onlineResultText = () => {
    if (!myOnlinePick || !opponentPick) return '';
    const r = getResult(myOnlinePick, opponentPick);
    return r === 'win' ? '🎉 You Win!' : r === 'lose' ? '😔 Opponent Wins!' : '🤝 Draw!';
  };

  const displayMyPick = room.isOnline ? myOnlinePick : myChoice;
  const displayOppPick = room.isOnline ? opponentPick : aiChoice;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Rock Paper Scissors</Text>
          <View style={styles.headerActions}>
            {!room.isOnline && (
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowRoomLobby(true)}
              >
                <Ionicons name="wifi" size={16} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.resetBtn, { backgroundColor: theme.colors.danger }]}
              onPress={resetGame}
            >
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Round + Scoreboard */}
        <Text style={[styles.roundText, { color: theme.colors.textSecondary }]}>Round {currentRound}</Text>

        <View style={[styles.scoreboard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: theme.colors.primary }]} numberOfLines={1}>
              {room.isOnline ? myName : 'You'}
            </Text>
            <Text style={[styles.scoreValue, { color: theme.colors.text }]}>{displayScores.me}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>Draws</Text>
            <Text style={[styles.scoreValue, { color: theme.colors.text }]}>{displayScores.draws}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: '#FF6B6B' }]} numberOfLines={1}>
              {room.isOnline ? opponentName : '🤖 AI'}
            </Text>
            <Text style={[styles.scoreValue, { color: theme.colors.text }]}>{displayScores.opponent}</Text>
          </View>
        </View>

        {/* Main game area */}
        {isWaiting ? (
          <View style={[styles.waitingBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Ionicons name="time-outline" size={40} color={theme.colors.textSecondary} />
            <Text style={[styles.waitingText, { color: theme.colors.textSecondary }]}>Waiting for opponent…</Text>
            <Text style={[styles.waitingSubtext, { color: theme.colors.textSecondary }]}>Room: {room.roomCode}</Text>
          </View>
        ) : showReveal ? (
          <Animated.View
            style={[
              styles.resultArea,
              {
                opacity: revealAnim,
                transform: [{ scale: revealAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
              },
            ]}
          >
            <View style={styles.choicesRow}>
              <View style={styles.choiceDisplay}>
                <Text style={styles.bigEmoji}>
                  {CHOICES.find((c) => c.id === displayMyPick)?.emoji ?? '?'}
                </Text>
                <Text style={[styles.choiceOwner, { color: theme.colors.primary }]}>
                  {room.isOnline ? myName : 'You'}
                </Text>
              </View>

              <Text style={[styles.vsText, { color: theme.colors.textSecondary }]}>VS</Text>

              <View style={styles.choiceDisplay}>
                <Text style={styles.bigEmoji}>
                  {CHOICES.find((c) => c.id === displayOppPick)?.emoji ?? '?'}
                </Text>
                <Text style={[styles.choiceOwner, { color: '#FF6B6B' }]}>
                  {room.isOnline ? opponentName : '🤖 AI'}
                </Text>
              </View>
            </View>

            <Text style={[styles.resultText, { color: theme.colors.text }]}>
              {room.isOnline ? onlineResultText() : offlineResult}
            </Text>

            {canNextRound && (
              <TouchableOpacity
                style={[styles.nextRoundBtn, { backgroundColor: theme.colors.primary }]}
                onPress={nextRound}
              >
                <Text style={styles.nextRoundBtnText}>Next Round</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        ) : room.isOnline && myOnlinePick ? (
          <View style={[styles.waitingBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={{ fontSize: 56 }}>{CHOICES.find((c) => c.id === myOnlinePick)?.emoji}</Text>
            <Text style={[styles.waitingText, { color: theme.colors.textSecondary }]}>Waiting for opponent's pick…</Text>
          </View>
        ) : (
          <View style={styles.pickArea}>
            <Text style={[styles.pickPrompt, { color: theme.colors.text }]}>Choose your move:</Text>
            <View style={styles.choicesRow}>
              {CHOICES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.choiceBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  onPress={() => handlePick(c.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.choiceBtnEmoji}>{c.emoji}</Text>
                  <Text style={[styles.choiceBtnLabel, { color: theme.colors.text }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      <AdBanner />

      <RoomLobby
        visible={showRoomLobby}
        onClose={() => setShowRoomLobby(false)}
        room={room}
        gameType="Rock Paper Scissors"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  resetBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  roundText: {
    fontSize: 14,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },

  scoreboard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  scoreItem: { alignItems: 'center', flex: 1 },
  scoreLabel: { fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  scoreValue: { fontSize: 26, fontWeight: 'bold' },

  waitingBox: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  waitingText: { fontSize: 18, fontWeight: '600' },
  waitingSubtext: { fontSize: 14 },

  pickArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  pickPrompt: { fontSize: 20, fontWeight: '600' },
  choicesRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceBtn: {
    width: 95,
    height: 110,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    gap: 6,
  },
  choiceBtnEmoji: { fontSize: 40 },
  choiceBtnLabel: { fontSize: 14, fontWeight: '600' },

  resultArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  choiceDisplay: { alignItems: 'center', gap: 6 },
  bigEmoji: { fontSize: 70 },
  choiceOwner: { fontSize: 14, fontWeight: '700' },
  vsText: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 8 },
  resultText: { fontSize: 28, fontWeight: 'bold', marginTop: 8 },

  nextRoundBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  nextRoundBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
