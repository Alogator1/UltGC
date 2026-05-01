import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AdBanner from '../components/AdBanner';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';
import GameHeader from '../components/GameHeader';

const SCORE_CATS = [
  { id: 'birds',      label: '🐦 Birds Played',    hint: '1 pt each' },
  { id: 'roundGoals', label: '🎯 Round Goals',      hint: 'Points from 4 round end tiles' },
  { id: 'eggs',       label: '🥚 Eggs',             hint: '1 pt each' },
  { id: 'food',       label: '🌾 Food on Cards',    hint: '1 pt each' },
  { id: 'tucked',     label: '📄 Tucked Cards',     hint: '1 pt each' },
  { id: 'bonus',      label: '⭐ Bonus Cards',      hint: 'Varies by card' },
];

function emptyScores() {
  return Object.fromEntries(SCORE_CATS.map(c => [c.id, 0]));
}

function calcTotal(scores) {
  return Object.values(scores).reduce((a, b) => a + b, 0);
}

export default function WingspanScreen({ route }) {
  const { theme } = useTheme();
  const room = useRoom('Wingspan');
  const [showRoomLobby, setShowRoomLobby] = useState(false);
  const [players, setPlayers] = useState(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      name: `Player ${i + 1}`,
      scores: emptyScores(),
    }))
  );
  const [playerCount, setPlayerCount] = useState(2);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    return () => { room.deleteRoom(); };
  }, []);

  useEffect(() => {
    if (route?.params?.joinRoomOnly && !room.isOnline) {
      setShowRoomLobby(true);
    }
  }, [route?.params?.joinRoomOnly, room.isOnline]);

  useEffect(() => {
    if (room.isOnline) {
      setStarted(true);
      const me = room.players.find((p) => p.id === room.userId);
      if (me && !me.playerData?.scores) {
        room.updateMyPlayerData({ scores: emptyScores() });
      }
    }
  }, [room.isOnline, room.players.length]);

  const active = room.isOnline
    ? [...room.players]
        .sort((a, b) => (b.id === room.userId ? 1 : 0) - (a.id === room.userId ? 1 : 0))
        .map((p) => ({
          id: p.id,
          name: p.displayName,
          scores: { ...emptyScores(), ...(p.playerData?.scores || {}) },
        }))
    : players.slice(0, playerCount);

  const adjust = (pid, catId, delta) => {
    if (room.isOnline) {
      if (!room.allCanEdit && pid !== room.userId) return;
      const target = room.players.find((p) => p.id === pid);
      const current = { ...emptyScores(), ...(target?.playerData?.scores || {}) };
      room.updatePlayerData(pid, {
        ...(target?.playerData || {}),
        scores: { ...current, [catId]: Math.max(0, current[catId] + delta) },
      });
      return;
    }

    setPlayers(prev => prev.map(p => {
      if (p.id !== pid) return p;
      return { ...p, scores: { ...p.scores, [catId]: Math.max(0, p.scores[catId] + delta) } };
    }));
  };

  const setName = (pid, name) => {
    if (room.isOnline) return;
    setPlayers(prev => prev.map(p => p.id === pid ? { ...p, name } : p));
  };

  const reset = () => {
    Alert.alert('New Game', 'Reset all scores?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: () => {
          if (room.isOnline) {
            if (!room.isHost && !room.allCanEdit) return;
            room.players.forEach((p) => room.updatePlayerData(p.id, {
              ...(p.playerData || {}),
              scores: emptyScores(),
            }));
            return;
          }
          setPlayers(prev => prev.map(p => ({ ...p, scores: emptyScores() })));
          setStarted(false);
        },
      },
    ]);
  };

  if (!started) {
    return (
      <View style={[styles.setupContainer, { backgroundColor: theme.colors.background }]}>
        <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />
        <View style={styles.setupContent}>
          <GameHeader
            title="🦅 Wingspan"
            showOnline={!room.isOnline}
            onOnlinePress={() => setShowRoomLobby(true)}
            style={{ width: '88%' }}
          />

          <View style={[styles.setupCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Players</Text>
            <View style={styles.countRow}>
              {[2, 3, 4, 5].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.countBtn, {
                    backgroundColor: playerCount === n ? theme.colors.primary : theme.colors.surface,
                    borderColor: theme.colors.border,
                  }]}
                  onPress={() => setPlayerCount(n)}
                >
                  <Text style={[styles.countBtnTxt, { color: playerCount === n ? '#fff' : theme.colors.text }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {Array.from({ length: playerCount }, (_, i) => (
              <TextInput
                key={i}
                style={[styles.nameInput, {
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                }]}
                value={players[i].name}
                onChangeText={t => setName(i, t)}
                placeholder={`Player ${i + 1}`}
                placeholderTextColor={theme.colors.textSecondary}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => setStarted(true)}
          >
            <Text style={styles.startBtnTxt}>Start Tracking</Text>
          </TouchableOpacity>
        </View>
        <RoomLobby
          visible={showRoomLobby}
          onClose={() => setShowRoomLobby(false)}
          room={room}
          gameType="Wingspan"
        />
      </View>
    );
  }

  const ranked = [...active].sort((a, b) => calcTotal(b.scores) - calcTotal(a.scores));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />
      <GameHeader
        title="🦅 Wingspan"
        showOnline={!room.isOnline}
        onOnlinePress={() => setShowRoomLobby(true)}
        style={{ paddingHorizontal: 16, paddingTop: 12, marginBottom: 8 }}
        actions={[{
          label: 'New Game',
          color: theme.colors.surface,
          outline: true,
          borderColor: theme.colors.border,
          textColor: theme.colors.text,
          onPress: reset,
        }]}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.rankCard, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.rankTitle, { color: theme.colors.textSecondary }]}>STANDINGS</Text>
          {ranked.map((p, i) => (
            <View key={p.id} style={styles.rankRow}>
              <Text style={{ fontSize: 18, width: 32 }}>{i === 0 ? '🏆' : `${i + 1}.`}</Text>
              <Text style={[styles.rankName, { color: theme.colors.text }]}>{p.name}</Text>
              <Text style={[styles.rankScore, { color: theme.colors.primary }]}>{calcTotal(p.scores)} pts</Text>
            </View>
          ))}
        </View>

        {active.map(player => (
          <View key={player.id} style={[styles.playerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.playerHeader}>
              <Text style={[styles.playerName, { color: theme.colors.text }]}>{player.name}</Text>
              <Text style={[styles.playerTotal, { color: theme.colors.primary }]}>{calcTotal(player.scores)} pts</Text>
            </View>
            {SCORE_CATS.map(cat => (
              <View key={cat.id} style={[styles.catRow, { borderTopColor: theme.colors.border }]}>
                <View style={styles.catInfo}>
                  <Text style={[styles.catLabel, { color: theme.colors.text }]}>{cat.label}</Text>
                  <Text style={[styles.catHint, { color: theme.colors.textSecondary }]}>{cat.hint}</Text>
                </View>
                <View style={styles.stepper}>
                <TouchableOpacity
                    style={[
                      styles.stepBtn,
                      { backgroundColor: theme.colors.surface },
                      room.isOnline && !room.allCanEdit && player.id !== room.userId && styles.disabledBtn,
                    ]}
                    onPress={() => adjust(player.id, cat.id, -1)}
                    disabled={room.isOnline && !room.allCanEdit && player.id !== room.userId}
                  >
                    <Text style={[styles.stepTxt, { color: theme.colors.text }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.stepVal, { color: theme.colors.text }]}>{player.scores[cat.id]}</Text>
                  <TouchableOpacity
                    style={[
                      styles.stepBtn,
                      { backgroundColor: theme.colors.primary },
                      room.isOnline && !room.allCanEdit && player.id !== room.userId && styles.disabledBtn,
                    ]}
                    onPress={() => adjust(player.id, cat.id, 1)}
                    disabled={room.isOnline && !room.allCanEdit && player.id !== room.userId}
                  >
                    <Text style={[styles.stepTxt, { color: '#fff' }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <AdBanner />
      <RoomLobby
        visible={showRoomLobby}
        onClose={() => setShowRoomLobby(false)}
        room={room}
        gameType="Wingspan"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  setupContainer: { flex: 1 },
  setupContent: { flex: 1, alignItems: 'center', paddingTop: 20 },
  setupHeader: { width: '88%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleLarge: { fontSize: 32, fontWeight: 'bold' },
  sub: { fontSize: 15, marginTop: 6, marginBottom: 20 },
  setupCard: { width: '88%', borderRadius: 8, borderWidth: 1, padding: 20, gap: 14, marginBottom: 24 },
  fieldLabel: { fontSize: 16, fontWeight: '600' },
  countRow: { flexDirection: 'row', gap: 10 },
  countBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  countBtnTxt: { fontSize: 18, fontWeight: 'bold' },
  nameInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  startBtn: { width: '88%', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  startBtnTxt: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  onlineButton: { width: 38, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  newGameBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  newGameTxt: { fontSize: 14, fontWeight: '600' },
  scroll: { padding: 14, paddingBottom: 40 },

  rankCard: { borderRadius: 12, padding: 12, marginBottom: 12 },
  rankTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  rankName: { flex: 1, fontSize: 15, fontWeight: '600' },
  rankScore: { fontSize: 15, fontWeight: 'bold' },

  playerCard: { borderRadius: 12, marginBottom: 12, borderWidth: 1, overflow: 'hidden' },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  playerName: { fontSize: 17, fontWeight: 'bold' },
  playerTotal: { fontSize: 20, fontWeight: 'bold' },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1 },
  catInfo: { flex: 1 },
  catLabel: { fontSize: 14, fontWeight: '600' },
  catHint: { fontSize: 11, marginTop: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  disabledBtn: { opacity: 0.35 },
  stepTxt: { fontSize: 20, fontWeight: 'bold' },
  stepVal: { fontSize: 16, fontWeight: 'bold', minWidth: 28, textAlign: 'center' },
});
