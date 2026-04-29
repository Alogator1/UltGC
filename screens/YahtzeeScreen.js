import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';

// ── Scoring categories ─────────────────────────────────────────────────────────

const UPPER_CATS = [
  { id: 'ones',   label: 'Ones',   hint: 'Sum of all 1s' },
  { id: 'twos',   label: 'Twos',   hint: 'Sum of all 2s' },
  { id: 'threes', label: 'Threes', hint: 'Sum of all 3s' },
  { id: 'fours',  label: 'Fours',  hint: 'Sum of all 4s' },
  { id: 'fives',  label: 'Fives',  hint: 'Sum of all 5s' },
  { id: 'sixes',  label: 'Sixes',  hint: 'Sum of all 6s' },
];

const LOWER_CATS = [
  { id: 'threeOfKind',  label: '3 of a Kind',    hint: 'Sum of all dice' },
  { id: 'fourOfKind',   label: '4 of a Kind',    hint: 'Sum of all dice' },
  { id: 'fullHouse',    label: 'Full House',      hint: '25 points' },
  { id: 'smStraight',   label: 'Small Straight',  hint: '30 points' },
  { id: 'lgStraight',   label: 'Large Straight',  hint: '40 points' },
  { id: 'yahtzee',      label: 'YAHTZEE!',        hint: '50 points' },
  { id: 'chance',       label: 'Chance',          hint: 'Sum of all dice' },
];

const ALL_CATS = [...UPPER_CATS, ...LOWER_CATS];
const UPPER_BONUS_THRESHOLD = 63;
const UPPER_BONUS = 35;

// ── Scoring functions ──────────────────────────────────────────────────────────

function countDice(dice) {
  const c = Array(7).fill(0);
  dice.forEach((d) => c[d]++);
  return c;
}

function calcScore(catId, dice) {
  const sum = dice.reduce((a, b) => a + b, 0);
  const counts = countDice(dice);

  switch (catId) {
    case 'ones':   return counts[1] * 1;
    case 'twos':   return counts[2] * 2;
    case 'threes': return counts[3] * 3;
    case 'fours':  return counts[4] * 4;
    case 'fives':  return counts[5] * 5;
    case 'sixes':  return counts[6] * 6;

    case 'threeOfKind':
      return counts.some((c) => c >= 3) ? sum : 0;
    case 'fourOfKind':
      return counts.some((c) => c >= 4) ? sum : 0;
    case 'fullHouse': {
      const vals = counts.slice(1).filter((c) => c > 0);
      return vals.length === 2 && (vals[0] === 2 || vals[0] === 3) ? 25 : 0;
    }
    case 'smStraight': {
      const unique = [...new Set(dice)].sort();
      const runs = [
        [1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6],
      ];
      return runs.some((r) => r.every((v) => unique.includes(v))) ? 30 : 0;
    }
    case 'lgStraight': {
      const sorted = [...new Set(dice)].sort();
      return (JSON.stringify(sorted) === '[1,2,3,4,5]' || JSON.stringify(sorted) === '[2,3,4,5,6]') ? 40 : 0;
    }
    case 'yahtzee':
      return counts.some((c) => c === 5) ? 50 : 0;
    case 'chance':
      return sum;
    default:
      return 0;
  }
}

function totalScore(scorecard) {
  const upperRaw = UPPER_CATS.reduce((s, c) => s + (scorecard[c.id] ?? 0), 0);
  const bonus = upperRaw >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
  const lower = LOWER_CATS.reduce((s, c) => s + (scorecard[c.id] ?? 0), 0);
  return upperRaw + bonus + lower;
}

function upperRawTotal(scorecard) {
  return UPPER_CATS.reduce((s, c) => s + (scorecard[c.id] ?? 0), 0);
}

function emptyScorecard() {
  return Object.fromEntries(ALL_CATS.map((c) => [c.id, null]));
}

function allFilled(scorecard) {
  return ALL_CATS.every((c) => scorecard[c.id] !== null);
}

// ── Default local player ───────────────────────────────────────────────────────

const NUM_DICE = 5;
const MAX_ROLLS = 3;

function freshDice() {
  return Array.from({ length: NUM_DICE }, () => Math.ceil(Math.random() * 6));
}

export default function YahtzeeScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { isPremium } = useSubscription();
  const room = useRoom('Yahtzee');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  // ── Offline: single-player scorecard ─────────────────────────────────────────
  const [scorecard, setScorecard] = useState(emptyScorecard());
  const [dice, setDice] = useState([1, 1, 1, 1, 1]);
  const [held, setHeld] = useState([false, false, false, false, false]);
  const [rollsLeft, setRollsLeft] = useState(MAX_ROLLS);
  const [gameOver, setGameOver] = useState(false);

  // ── Online: active player turn ────────────────────────────────────────────────
  // sharedState: { scorecards: { uid: scorecard }, dice, held, rollsLeft, activePlayerId, turnCount }
  const onlineSC = room.sharedState?.scorecards ?? {};
  const onlineDice = room.sharedState?.dice ?? [1, 1, 1, 1, 1];
  const onlineHeld = room.sharedState?.held ?? [false, false, false, false, false];
  const onlineRollsLeft = room.sharedState?.rollsLeft ?? MAX_ROLLS;
  const onlineActiveId = room.sharedState?.activePlayerId ?? null;
  const onlineTurnCount = room.sharedState?.turnCount ?? 0;

  const isMyTurn = room.isOnline && onlineActiveId === room.userId;
  const isWaiting = room.isOnline && room.players.length < 2;

  // ── Dice animation ────────────────────────────────────────────────────────────
  const shakeAnims = useRef(Array.from({ length: NUM_DICE }, () => new Animated.Value(0))).current;

  const shakeDice = (heldMask) => {
    const anims = shakeAnims
      .map((anim, i) => (!heldMask[i]
        ? Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 60, useNativeDriver: true }),
            Animated.timing(anim, { toValue: -1, duration: 60, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1, duration: 60, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 60, useNativeDriver: true }),
          ])
        : null))
      .filter(Boolean);
    Animated.parallel(anims).start();
  };

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (route.params?.joinRoomOnly && !isPremium) {
      setShowRoomLobby(true);
    }
    return () => { room.deleteRoom(); };
  }, []);

  const handleCloseLobby = () => {
    setShowRoomLobby(false);
    if (route.params?.joinRoomOnly && !room.isOnline) {
      navigation.goBack();
    }
  };

  // ── Online: host initialises shared state ─────────────────────────────────────
  useEffect(() => {
    if (!room.isOnline || !room.isHost || room.sharedState?.scorecards) return;
    const initSC = {};
    room.players.forEach((p) => { initSC[p.id] = emptyScorecard(); });
    room.updateSharedState({
      scorecards: initSC,
      dice: [1, 1, 1, 1, 1],
      held: [false, false, false, false, false],
      rollsLeft: MAX_ROLLS,
      activePlayerId: room.players[0]?.id ?? room.userId,
      turnCount: 0,
    });
  }, [room.isOnline, room.isHost, room.players.length]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const rollDice = () => {
    if (room.isOnline) {
      if (!isMyTurn || onlineRollsLeft <= 0) return;
      const newDice = onlineDice.map((d, i) => (onlineHeld[i] ? d : Math.ceil(Math.random() * 6)));
      shakeDice(onlineHeld);
      room.updateSharedState({
        ...room.sharedState,
        dice: newDice,
        rollsLeft: onlineRollsLeft - 1,
      });
    } else {
      if (rollsLeft <= 0) return;
      const newDice = dice.map((d, i) => (held[i] ? d : Math.ceil(Math.random() * 6)));
      shakeDice(held);
      setDice(newDice);
      setRollsLeft((r) => r - 1);
    }
  };

  const toggleHold = (i) => {
    if (room.isOnline) {
      if (!isMyTurn || onlineRollsLeft === MAX_ROLLS) return;
      const newHeld = [...onlineHeld];
      newHeld[i] = !newHeld[i];
      room.updateSharedState({ ...room.sharedState, held: newHeld });
    } else {
      if (rollsLeft === MAX_ROLLS) return;
      setHeld((prev) => { const n = [...prev]; n[i] = !n[i]; return n; });
    }
  };

  const scoreCategory = (catId) => {
    const activeDice = room.isOnline ? onlineDice : dice;
    const activeSC = room.isOnline ? (onlineSC[room.userId] ?? emptyScorecard()) : scorecard;

    if (activeSC[catId] !== null) return;
    if (room.isOnline && (!isMyTurn || onlineRollsLeft === MAX_ROLLS)) return;
    if (!room.isOnline && rollsLeft === MAX_ROLLS) return;

    const pts = calcScore(catId, activeDice);

    if (room.isOnline) {
      const updatedSC = { ...onlineSC, [room.userId]: { ...activeSC, [catId]: pts } };

      // Find next player
      const playerIds = room.players.map((p) => p.id);
      const idx = playerIds.indexOf(room.userId);
      const nextId = playerIds[(idx + 1) % playerIds.length];

      const newTurnCount = onlineTurnCount + 1;
      const totalTurns = playerIds.length * ALL_CATS.length;
      const isGameOver = newTurnCount >= totalTurns;

      room.updateSharedState({
        scorecards: updatedSC,
        dice: [1, 1, 1, 1, 1],
        held: [false, false, false, false, false],
        rollsLeft: MAX_ROLLS,
        activePlayerId: isGameOver ? null : nextId,
        turnCount: newTurnCount,
      });

      if (isGameOver) {
        const scores = playerIds.map((id) => ({
          name: room.players.find((p) => p.id === id)?.displayName ?? id,
          score: totalScore(updatedSC[id] ?? emptyScorecard()),
        }));
        const winner = scores.reduce((best, p) => (p.score > best.score ? p : best));
        Alert.alert('🎲 Game Over!', `${winner.name} wins with ${winner.score} points!`);
      }
    } else {
      const newSC = { ...scorecard, [catId]: pts };
      setScorecard(newSC);
      setDice([1, 1, 1, 1, 1]);
      setHeld([false, false, false, false, false]);
      setRollsLeft(MAX_ROLLS);

      if (allFilled(newSC)) {
        setGameOver(true);
        const final = totalScore(newSC);
        setTimeout(() => {
          Alert.alert('🎲 Game Over!', `Final Score: ${final} points!`, [
            { text: 'New Game', onPress: newGame },
          ]);
        }, 400);
      }
    }
  };

  const newGame = () => {
    if (room.isOnline) {
      if (!room.isHost && !room.allCanEdit) return;
      const initSC = {};
      room.players.forEach((p) => { initSC[p.id] = emptyScorecard(); });
      room.updateSharedState({
        scorecards: initSC,
        dice: [1, 1, 1, 1, 1],
        held: [false, false, false, false, false],
        rollsLeft: MAX_ROLLS,
        activePlayerId: room.players[0]?.id ?? room.userId,
        turnCount: 0,
      });
    } else {
      setScorecard(emptyScorecard());
      setDice([1, 1, 1, 1, 1]);
      setHeld([false, false, false, false, false]);
      setRollsLeft(MAX_ROLLS);
      setGameOver(false);
    }
  };

  // ── Active values for rendering ───────────────────────────────────────────────

  const activeDice = room.isOnline ? onlineDice : dice;
  const activeHeld = room.isOnline ? onlineHeld : held;
  const activeRollsLeft = room.isOnline ? onlineRollsLeft : rollsLeft;
  const activeSC = room.isOnline ? (onlineSC[room.userId] ?? emptyScorecard()) : scorecard;
  const canRoll = room.isOnline ? (isMyTurn && onlineRollsLeft > 0) : (rollsLeft > 0 && !gameOver);
  const hasRolled = activeRollsLeft < MAX_ROLLS;

  const upperRaw = upperRawTotal(activeSC);
  const bonusProgress = Math.min(upperRaw, UPPER_BONUS_THRESHOLD);
  const hasBonus = upperRaw >= UPPER_BONUS_THRESHOLD;
  const totalPts = totalScore(activeSC);

  // For online: figure out active player name
  const activePlayerName = room.players.find((p) => p.id === onlineActiveId)?.displayName ?? '';

  // ── Render ────────────────────────────────────────────────────────────────────

  const renderDie = (value, index) => {
    const isHeld = activeHeld[index];
    const shake = shakeAnims[index].interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });
    const canToggle = room.isOnline ? (isMyTurn && hasRolled) : hasRolled;

    return (
      <TouchableOpacity
        key={index}
        onPress={() => canToggle && toggleHold(index)}
        activeOpacity={canToggle ? 0.7 : 1}
      >
        <Animated.View
          style={[
            styles.die,
            { backgroundColor: isHeld ? theme.colors.warning : theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Animated.Text style={[styles.dieText, { transform: [{ translateX: shake }] }]}>
            {['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][value]}
          </Animated.Text>
          {isHeld && <Text style={styles.heldLabel}>HELD</Text>}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderCategory = (cat) => {
    const scored = activeSC[cat.id] !== null;
    const preview = !scored && hasRolled ? calcScore(cat.id, activeDice) : null;
    const canScore = !scored && hasRolled && (!room.isOnline || isMyTurn);

    return (
      <TouchableOpacity
        key={cat.id}
        style={[
          styles.catRow,
          { borderColor: theme.colors.border },
          scored && { backgroundColor: theme.colors.surface },
          canScore && preview !== null && preview > 0 && { backgroundColor: theme.colors.primary + '18' },
        ]}
        onPress={() => canScore && scoreCategory(cat.id)}
        activeOpacity={canScore ? 0.7 : 1}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.catLabel, { color: scored ? theme.colors.textSecondary : theme.colors.text }]}>
            {cat.label}
          </Text>
          <Text style={[styles.catHint, { color: theme.colors.textSecondary }]}>{cat.hint}</Text>
        </View>
        <Text
          style={[
            styles.catScore,
            {
              color: scored
                ? theme.colors.text
                : canScore && preview !== null
                ? preview > 0 ? theme.colors.primary : theme.colors.danger
                : theme.colors.textSecondary,
            },
          ]}
        >
          {scored ? activeSC[cat.id] : canScore && preview !== null ? preview : '—'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>🎲 Yahtzee</Text>
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
            style={[styles.iconBtn, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}
            onPress={() => Alert.alert('New Game', 'Start a new game?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'New Game', onPress: newGame },
            ])}
          >
            <Ionicons name="refresh" size={16} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Online turn indicator */}
      {room.isOnline && !isWaiting && (
        <View style={[styles.turnBanner, { backgroundColor: isMyTurn ? theme.colors.primary : theme.colors.surface }]}>
          <Text style={[styles.turnBannerText, { color: isMyTurn ? '#fff' : theme.colors.textSecondary }]}>
            {onlineActiveId === null ? 'Game Over' : isMyTurn ? 'Your Turn!' : `${activePlayerName}'s turn`}
          </Text>
        </View>
      )}

      {isWaiting ? (
        <View style={[styles.waitingBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Ionicons name="time-outline" size={40} color={theme.colors.textSecondary} />
          <Text style={[styles.waitingText, { color: theme.colors.textSecondary }]}>Waiting for opponent…</Text>
          <Text style={[styles.waitingSubtext, { color: theme.colors.textSecondary }]}>Room: {room.roomCode}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Score summary */}
          <View style={[styles.scoreSummary, { backgroundColor: theme.colors.card }]}>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>Upper: {upperRaw}</Text>
              <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>
                Bonus: {hasBonus ? `+${UPPER_BONUS} ✓` : `${bonusProgress}/${UPPER_BONUS_THRESHOLD}`}
              </Text>
              <Text style={[styles.totalLabel, { color: theme.colors.primary }]}>Total: {totalPts}</Text>
            </View>
          </View>

          {/* Dice */}
          <View style={styles.diceArea}>
            <View style={styles.diceRow}>
              {activeDice.map((v, i) => renderDie(v, i))}
            </View>

            <TouchableOpacity
              style={[
                styles.rollBtn,
                { backgroundColor: canRoll ? theme.colors.primary : theme.colors.textSecondary },
              ]}
              onPress={rollDice}
              disabled={!canRoll}
            >
              <Text style={styles.rollBtnText}>
                {activeRollsLeft === MAX_ROLLS
                  ? '🎲 Roll Dice'
                  : activeRollsLeft > 0
                  ? `🎲 Roll Again (${activeRollsLeft} left)`
                  : 'No rolls left — pick a category'}
              </Text>
            </TouchableOpacity>

            {hasRolled && activeRollsLeft > 0 && (
              <Text style={[styles.holdHint, { color: theme.colors.textSecondary }]}>
                Tap dice to hold them
              </Text>
            )}
          </View>

          {/* Online: other players' scores */}
          {room.isOnline && room.players.filter((p) => p.id !== room.userId).length > 0 && (
            <View style={[styles.opponentSection, { borderColor: theme.colors.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Other Players</Text>
              {room.players.filter((p) => p.id !== room.userId).map((p) => (
                <View key={p.id} style={[styles.opponentRow, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.opponentName, { color: theme.colors.text }]}>
                    {p.id === onlineActiveId ? '▶ ' : ''}{p.displayName}
                  </Text>
                  <Text style={[styles.opponentScore, { color: theme.colors.primary }]}>
                    {totalScore(onlineSC[p.id] ?? emptyScorecard())} pts
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Scorecard: Upper section */}
          <View style={[styles.section, { borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Upper Section</Text>
            {UPPER_CATS.map(renderCategory)}
            {hasBonus && (
              <View style={[styles.catRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.success + '22' }]}>
                <Text style={[styles.catLabel, { color: theme.colors.success, flex: 1 }]}>Bonus (≥63)</Text>
                <Text style={[styles.catScore, { color: theme.colors.success }]}>+{UPPER_BONUS}</Text>
              </View>
            )}
          </View>

          {/* Scorecard: Lower section */}
          <View style={[styles.section, { borderColor: theme.colors.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Lower Section</Text>
            {LOWER_CATS.map(renderCategory)}
          </View>
        </ScrollView>
      )}

      <RoomLobby
        visible={showRoomLobby}
        onClose={handleCloseLobby}
        room={room}
        gameType="Yahtzee"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },

  turnBanner: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  turnBannerText: { fontSize: 14, fontWeight: '700' },

  waitingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  waitingText: { fontSize: 18, fontWeight: '600' },
  waitingSubtext: { fontSize: 14 },

  scrollContent: { padding: 14, paddingBottom: 40 },

  scoreSummary: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: { fontSize: 13 },
  totalLabel: { fontSize: 16, fontWeight: 'bold' },

  diceArea: { alignItems: 'center', marginBottom: 14 },
  diceRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  die: {
    width: 58,
    height: 58,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dieText: { fontSize: 32 },
  heldLabel: { fontSize: 8, fontWeight: 'bold', color: '#fff', position: 'absolute', bottom: 3 },

  rollBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  rollBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  holdHint: { fontSize: 12, marginTop: 6 },

  opponentSection: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  opponentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  opponentName: { fontSize: 14, fontWeight: '600' },
  opponentScore: { fontSize: 14, fontWeight: 'bold' },

  section: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingVertical: 8,
    letterSpacing: 0.5,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  catLabel: { fontSize: 15, fontWeight: '600' },
  catHint: { fontSize: 11, marginTop: 1 },
  catScore: { fontSize: 18, fontWeight: 'bold', minWidth: 36, textAlign: 'right' },
});
