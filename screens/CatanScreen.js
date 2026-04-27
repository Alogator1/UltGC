import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';

const STORAGE_KEY = 'catanGameData';
const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'];
const EMPTY_DICE = { dice1: 1, dice2: 1, total: 2 };

export default function CatanScreen() {
  const { theme } = useTheme();
  const room = useRoom('Catan');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  // ── Offline state ────────────────────────────────────────────────────────────
  const [localPlayers, setLocalPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], color: PLAYER_COLORS[0], settlements: 0, cities: 0, devCards: 0, hasLongestRoad: false, hasLargestArmy: false },
  ]);
  const [editingId, setEditingId] = useState(null);
  const [diceRoll, setDiceRoll] = useState(EMPTY_DICE);
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState(null);

  // ── Online helpers ───────────────────────────────────────────────────────────
  // Per-player stats live in playerData; bonuses + dice live in sharedState

  const canEdit = (playerId) =>
    !room.isOnline || room.allCanEdit || playerId === room.userId;

  const isOwn = (playerId) => !room.isOnline || playerId === room.userId;

  const getPlayerData = (playerId) => {
    const p = room.players.find((r) => r.id === playerId);
    return {
      settlements: p?.playerData?.settlements ?? 0,
      cities: p?.playerData?.cities ?? 0,
      devCards: p?.playerData?.devCards ?? 0,
    };
  };

  // Derive display players list
  const players = room.isOnline
    ? [...room.players]
        .sort((a, b) => (b.id === room.userId ? 1 : 0) - (a.id === room.userId ? 1 : 0))
        .map((p, i) => ({
          id: p.id,
          name: p.displayName,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          settlements: p.playerData?.settlements ?? 0,
          cities: p.playerData?.cities ?? 0,
          devCards: p.playerData?.devCards ?? 0,
          hasLongestRoad: room.sharedState?.longestRoadHolder === p.id,
          hasLargestArmy: room.sharedState?.largestArmyHolder === p.id,
        }))
    : localPlayers;

  const activeDice = room.isOnline ? (room.sharedState?.diceRoll ?? EMPTY_DICE) : diceRoll;

  const calculateVP = (player) =>
    player.settlements +
    player.cities * 2 +
    player.devCards +
    (player.hasLongestRoad ? 2 : 0) +
    (player.hasLargestArmy ? 2 : 0);

  // ── Load / save (offline) ────────────────────────────────────────────────────

  useEffect(() => {
    loadData();
    return () => { room.deleteRoom(); };
  }, []);

  useEffect(() => {
    if (room.isOnline) return;
    saveData();
    const winningPlayer = localPlayers.find((p) => calculateVP(p) >= 10);
    if (winningPlayer) setWinner(winningPlayer);
  }, [localPlayers, room.isOnline]);

  // Online winner check
  useEffect(() => {
    if (!room.isOnline) return;
    const winningPlayer = players.find((p) => calculateVP(p) >= 10);
    if (winningPlayer && !winner) setWinner(winningPlayer);
  }, [room.players, room.sharedState, room.isOnline]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const { players: saved } = JSON.parse(savedData);
        setLocalPlayers(saved);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ players: localPlayers }));
    } catch (err) {
      console.error('Error saving data:', err);
    }
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const adjustValue = (id, field, amount) => {
    if (room.isOnline) {
      if (!canEdit(id)) return;
      const pd = getPlayerData(id);
      room.updatePlayerData(id, { ...pd, [field]: Math.max(0, pd[field] + amount) });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: Math.max(0, p[field] + amount) } : p))
      );
    }
  };

  const updatePlayerName = (id, name) => {
    setLocalPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  // Longest Road / Largest Army: stored in sharedState as holder userId (or null)
  // Only your own card's button is interactive in online mode
  const toggleLongestRoad = (id) => {
    if (room.isOnline) {
      if (!isOwn(id)) return;
      const current = room.sharedState?.longestRoadHolder;
      room.updateSharedState({
        ...(room.sharedState || {}),
        longestRoadHolder: current === id ? null : id,
      });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, hasLongestRoad: !p.hasLongestRoad }
            : { ...p, hasLongestRoad: false }
        )
      );
    }
  };

  const toggleLargestArmy = (id) => {
    if (room.isOnline) {
      if (!isOwn(id)) return;
      const current = room.sharedState?.largestArmyHolder;
      room.updateSharedState({
        ...(room.sharedState || {}),
        largestArmyHolder: current === id ? null : id,
      });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, hasLargestArmy: !p.hasLargestArmy }
            : { ...p, hasLargestArmy: false }
        )
      );
    }
  };

  const rollDice = () => {
    setIsRolling(true);
    let iterations = 0;

    const interval = setInterval(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      if (!room.isOnline) setDiceRoll({ dice1: d1, dice2: d2, total: d1 + d2 });
      iterations++;

      if (iterations >= 10) {
        clearInterval(interval);
        setIsRolling(false);
        const fd1 = Math.floor(Math.random() * 6) + 1;
        const fd2 = Math.floor(Math.random() * 6) + 1;
        const result = { dice1: fd1, dice2: fd2, total: fd1 + fd2 };
        if (room.isOnline) {
          room.updateSharedState({ ...(room.sharedState || {}), diceRoll: result });
        } else {
          setDiceRoll(result);
        }
      }
    }, 100);
  };

  const resetGame = () => {
    Alert.alert('Reset Game', 'Reset the game and all scores?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setWinner(null);
          if (room.isOnline) {
            if (!room.isHost && !room.allCanEdit) return;
            room.players.forEach((p) => {
              room.updatePlayerData(p.id, { settlements: 0, cities: 0, devCards: 0 });
            });
            room.updateSharedState({
              diceRoll: EMPTY_DICE,
              longestRoadHolder: null,
              largestArmyHolder: null,
            });
          } else {
            setLocalPlayers((prev) =>
              prev.map((p) => ({
                ...p,
                settlements: 0,
                cities: 0,
                devCards: 0,
                hasLongestRoad: false,
                hasLargestArmy: false,
              }))
            );
          }
        },
      },
    ]);
  };

  const addPlayer = () => {
    if (localPlayers.length >= 6) {
      Alert.alert('Max Players', 'Catan supports up to 6 players.');
      return;
    }
    const newId = localPlayers.length > 0 ? Math.max(...localPlayers.map((p) => p.id)) + 1 : 1;
    setLocalPlayers((prev) => [
      ...prev,
      {
        id: newId,
        name: `Player ${newId}`,
        color: PLAYER_COLORS[prev.length % PLAYER_COLORS.length],
        settlements: 0, cities: 0, devCards: 0,
        hasLongestRoad: false, hasLargestArmy: false,
      },
    ]);
  };

  const removePlayer = (id) => {
    if (localPlayers.length <= 1) {
      Alert.alert('Cannot Remove', 'You must have at least one player.');
      return;
    }
    setLocalPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>🏝️ Catan Tracker</Text>
          <View style={styles.headerRow}>
            {!room.isOnline && (
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowRoomLobby(true)}
              >
                <Ionicons name="wifi" size={16} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.resetButton, { backgroundColor: theme.colors.danger }]}
              onPress={resetGame}
            >
              <Text style={styles.resetButtonText}>Reset Game</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dice */}
        <TouchableOpacity
          style={[
            styles.diceButton,
            { backgroundColor: isRolling ? theme.colors.textSecondary : theme.colors.primary },
          ]}
          onPress={rollDice}
          disabled={isRolling}
        >
          <View style={styles.diceRow}>
            <View style={[styles.dice, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.diceText, { color: theme.colors.text }]}>{activeDice.dice1}</Text>
            </View>
            <View style={[styles.dice, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.diceText, { color: theme.colors.text }]}>{activeDice.dice2}</Text>
            </View>
          </View>
          <Text style={styles.totalText}>🎲 Total: {activeDice.total}</Text>
        </TouchableOpacity>

        {/* Players */}
        <View style={styles.playersSection}>
          {players.map((player) => {
            const vp = calculateVP(player);
            const editable = canEdit(player.id);
            const own = isOwn(player.id);
            const isMe = player.id === room.userId && room.isOnline;

            return (
              <View
                key={player.id}
                style={[
                  styles.playerCard,
                  {
                    borderLeftColor: player.color,
                    borderLeftWidth: 6,
                    backgroundColor: theme.colors.surface,
                    borderColor: isMe ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                {/* Player header */}
                <View style={styles.playerHeader}>
                  <View style={styles.playerInfo}>
                    {editingId === player.id && !room.isOnline ? (
                      <TextInput
                        style={[styles.nameInput, { color: theme.colors.text, borderBottomColor: theme.colors.primary }]}
                        value={player.name}
                        onChangeText={(text) => updatePlayerName(player.id, text)}
                        onBlur={() => setEditingId(null)}
                        autoFocus
                      />
                    ) : (
                      <TouchableOpacity onPress={() => !room.isOnline && setEditingId(player.id)}>
                        <Text style={[styles.playerName, { color: theme.colors.text }]}>
                          {player.name}{isMe ? ' (You)' : ''}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <Text style={[styles.victoryPoints, { color: theme.colors.primary }]}>{vp} VP</Text>
                  </View>
                  {!room.isOnline && (
                    <TouchableOpacity
                      style={[styles.removeButton, { backgroundColor: theme.colors.danger }]}
                      onPress={() => removePlayer(player.id)}
                    >
                      <Text style={styles.removeButtonText}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Stats */}
                <View style={styles.statsColumn}>
                  {[
                    { field: 'settlements', label: '🏠 Settlements' },
                    { field: 'cities', label: '🏰 Cities' },
                    { field: 'devCards', label: '🃏 VP Cards' },
                  ].map(({ field, label }) => (
                    <View key={field} style={styles.statRow}>
                      <Text style={[styles.statLabel, { color: theme.colors.text }]}>{label}</Text>
                      <View style={styles.statControls}>
                        <TouchableOpacity
                          style={[styles.statButton, { backgroundColor: editable ? theme.colors.primary : theme.colors.border }]}
                          onPress={() => adjustValue(player.id, field, -1)}
                          disabled={!editable}
                        >
                          <Text style={styles.statButtonText}>−</Text>
                        </TouchableOpacity>
                        <Text style={[styles.statValue, { color: theme.colors.text }]}>{player[field]}</Text>
                        <TouchableOpacity
                          style={[styles.statButton, { backgroundColor: editable ? theme.colors.primary : theme.colors.border }]}
                          onPress={() => adjustValue(player.id, field, 1)}
                          disabled={!editable}
                        >
                          <Text style={styles.statButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Bonus badges — interactive only on your own card */}
                <View style={styles.bonusRow}>
                  <TouchableOpacity
                    style={[
                      styles.bonusButton,
                      { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                      player.hasLongestRoad && { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
                      !own && styles.bonusButtonDisabled,
                    ]}
                    onPress={() => toggleLongestRoad(player.id)}
                    disabled={!own}
                  >
                    <Text style={[styles.bonusButtonText, { color: player.hasLongestRoad ? '#fff' : theme.colors.textSecondary }]}>
                      🛤️ Longest Road{player.hasLongestRoad ? ' (+2)' : ''}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.bonusButton,
                      { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                      player.hasLargestArmy && { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
                      !own && styles.bonusButtonDisabled,
                    ]}
                    onPress={() => toggleLargestArmy(player.id)}
                    disabled={!own}
                  >
                    <Text style={[styles.bonusButtonText, { color: player.hasLargestArmy ? '#fff' : theme.colors.textSecondary }]}>
                      ⚔️ Largest Army{player.hasLargestArmy ? ' (+2)' : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {!room.isOnline && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.colors.success }]}
              onPress={addPlayer}
            >
              <Text style={styles.addButtonText}>+ Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.infoSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>📖 Victory Points</Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
            {'• 🏠 Settlement: 1 VP each\n• 🏰 City: 2 VP each\n• 🃏 VP Development Card: 1 VP each\n• 🛤️ Longest Road: 2 VP (5+ roads)\n• ⚔️ Largest Army: 2 VP (3+ knights)\n• 🏆 First to 10 VP wins!'}
            {room.isOnline ? '\n• Tap bonus buttons on your own card to claim them' : '\n• ✏️ Tap player names to edit'}
          </Text>
        </View>
      </ScrollView>

      {/* Winner modal */}
      <Modal visible={winner !== null} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.winnerEmoji}>🎉</Text>
            <Text style={[styles.winnerTitle, { color: theme.colors.text }]}>🏆 Winner!</Text>
            <Text style={[styles.winnerName, { color: theme.colors.primary }]}>{winner?.name}</Text>
            <Text style={[styles.winnerPoints, { color: theme.colors.textSecondary }]}>
              {winner && calculateVP(winner)} Victory Points
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setWinner(null)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <RoomLobby
        visible={showRoomLobby}
        onClose={() => setShowRoomLobby(false)}
        room={room}
        gameType="Catan"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  resetButton: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  resetButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  diceButton: {
    padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  diceRow: { flexDirection: 'row', gap: 20 },
  dice: {
    width: 60, height: 60, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },
  diceText: { fontSize: 32, fontWeight: 'bold' },
  totalText: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 10 },

  playersSection: { marginBottom: 20 },
  playerCard: { borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1 },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  nameInput: { fontSize: 20, fontWeight: '600', borderBottomWidth: 2, marginBottom: 4, padding: 0 },
  victoryPoints: { fontSize: 24, fontWeight: 'bold' },
  removeButton: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 24 },

  statsColumn: { marginBottom: 12 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statLabel: { fontSize: 16, fontWeight: '500' },
  statControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statButton: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  statButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statValue: { fontSize: 20, fontWeight: 'bold', minWidth: 24, textAlign: 'center' },

  bonusRow: { flexDirection: 'row', gap: 10 },
  bonusButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 2 },
  bonusButtonDisabled: { opacity: 0.5 },
  bonusButtonText: { fontSize: 12, fontWeight: '600' },

  addButton: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  infoSection: { padding: 15, borderRadius: 12, borderWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  text: { fontSize: 14, lineHeight: 22 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: {
    padding: 30, borderRadius: 20, alignItems: 'center', minWidth: 280,
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 10,
  },
  winnerEmoji: { fontSize: 60, marginBottom: 16 },
  winnerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 12 },
  winnerName: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  winnerPoints: { fontSize: 18, marginBottom: 24 },
  closeButton: { padding: 15, borderRadius: 10, minWidth: 120 },
  closeButtonText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 16 },
});
