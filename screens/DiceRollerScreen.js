import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';
import { DICE_TYPES } from '../constants/gameConfig';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';
import GameHeader from '../components/GameHeader';

// Count how many of each dice type a player has selected
function countsByType(dice) {
  const counts = {};
  for (const d of dice) {
    counts[d.type] = (counts[d.type] || 0) + 1;
  }
  return counts;
}

// Human-readable summary of selected dice, e.g. "2×d6 + 1×d20"
function diceSummary(dice) {
  const counts = countsByType(dice);
  return Object.entries(counts)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([type, count]) => `${count}×d${type}`)
    .join('  +  ');
}

export default function DiceRollerScreen() {
  const { theme } = useTheme();
  const room = useRoom('DiceRoller');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  const [localPlayers, setLocalPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], dice: [], rolls: [], hideHistory: false },
  ]);
  const [nextId, setNextId] = useState(2);
  const [editingId, setEditingId] = useState(null);
  const [animatingPlayers, setAnimatingPlayers] = useState(new Set());

  const players = room.isOnline
    ? [...room.players]
        .sort((a, b) => (b.id === room.userId ? 1 : 0) - (a.id === room.userId ? 1 : 0))
        .map((p) => ({
          id: p.id,
          name: p.displayName,
          dice: p.playerData?.dice || [],
          rolls: p.playerData?.rolls || [],
          hideHistory: p.playerData?.hideHistory || false,
        }))
    : localPlayers;

  const canEdit = (playerId) =>
    !room.isOnline || room.allCanEdit || playerId === room.userId;

  const isOwn = (playerId) => !room.isOnline || playerId === room.userId;

  const getPlayerData = (playerId) => {
    const p = room.players.find((r) => r.id === playerId);
    return {
      dice: p?.playerData?.dice || [],
      rolls: p?.playerData?.rolls || [],
      hideHistory: p?.playerData?.hideHistory || false,
    };
  };

  const toggleHideHistory = (playerId) => {
    if (room.isOnline) {
      if (!isOwn(playerId)) return;
      const pd = getPlayerData(playerId);
      room.updatePlayerData(playerId, { ...pd, hideHistory: !pd.hideHistory });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, hideHistory: !p.hideHistory } : p))
      );
    }
  };

  useEffect(() => {
    const loadGameData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('diceRollerGameData');
        if (savedData) {
          const data = JSON.parse(savedData);
          const withDefaults = (data.players || localPlayers).map((p) => ({
            ...p,
            dice: p.dice || [],
            rolls: p.rolls || [],
          }));
          setLocalPlayers(withDefaults);
          setNextId(data.nextId || nextId);
        }
      } catch (err) {
        console.error('Error loading game data:', err);
      }
    };
    loadGameData();
    return () => { room.deleteRoom(); };
  }, []);

  useEffect(() => {
    if (room.isOnline) return;
    AsyncStorage.setItem('diceRollerGameData', JSON.stringify({ players: localPlayers, nextId })).catch(console.error);
  }, [localPlayers, nextId, room.isOnline]);

  // ── Dice management ─────────────────────────────────────────────────────────

  const addDice = (playerId, diceType) => {
    if (room.isOnline) {
      if (!canEdit(playerId)) return;
      const pd = getPlayerData(playerId);
      room.updatePlayerData(playerId, {
        ...pd,
        dice: [...pd.dice, { id: Date.now() + Math.random(), type: diceType }],
      });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId
            ? { ...p, dice: [...p.dice, { id: Date.now() + Math.random(), type: diceType }] }
            : p
        )
      );
    }
  };

  const removeDice = (playerId, diceType) => {
    if (room.isOnline) {
      if (!canEdit(playerId)) return;
      const pd = getPlayerData(playerId);
      const idx = pd.dice.map((d) => d.type).lastIndexOf(diceType);
      if (idx === -1) return;
      const newDice = [...pd.dice];
      newDice.splice(idx, 1);
      room.updatePlayerData(playerId, { ...pd, dice: newDice });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== playerId) return p;
          const idx = p.dice.map((d) => d.type).lastIndexOf(diceType);
          if (idx === -1) return p;
          const newDice = [...p.dice];
          newDice.splice(idx, 1);
          return { ...p, dice: newDice };
        })
      );
    }
  };

  const clearDice = (playerId) => {
    if (room.isOnline) {
      if (!canEdit(playerId)) return;
      const pd = getPlayerData(playerId);
      room.updatePlayerData(playerId, { ...pd, dice: [] });
    } else {
      setLocalPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, dice: [] } : p)));
    }
  };

  const clearRolls = (playerId) => {
    if (room.isOnline) {
      if (!canEdit(playerId)) return;
      const pd = getPlayerData(playerId);
      room.updatePlayerData(playerId, { ...pd, rolls: [] });
    } else {
      setLocalPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, rolls: [] } : p)));
    }
  };

  const clearAllRolls = () => {
    Alert.alert('Clear All Rolls', 'Clear all roll history for every player?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          if (room.isOnline) {
            players.forEach((p) => { if (canEdit(p.id)) clearRolls(p.id); });
          } else {
            setLocalPlayers((prev) => prev.map((p) => ({ ...p, rolls: [] })));
          }
        },
      },
    ]);
  };

  // ── Rolling ──────────────────────────────────────────────────────────────────

  const rollForPlayer = (playerId) => {
    const player = players.find((p) => p.id === playerId);
    if (!player || player.dice.length === 0) {
      Alert.alert('No Dice', 'Add some dice first!');
      return;
    }
    if (!canEdit(playerId)) return;

    setAnimatingPlayers((prev) => new Set(prev).add(playerId));

    let count = 0;
    const interval = setInterval(() => {
      if (++count < 10) return;
      clearInterval(interval);

      const results = player.dice.map((d) => ({
        diceId: d.id,
        type: d.type,
        result: Math.floor(Math.random() * d.type) + 1,
      }));
      const total = results.reduce((s, r) => s + r.result, 0);
      const rollData = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        results,
        total,
      };

      if (room.isOnline) {
        const pd = getPlayerData(playerId);
        room.updatePlayerData(playerId, { ...pd, rolls: [rollData, ...pd.rolls].slice(0, 10) });
      } else {
        setLocalPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId ? { ...p, rolls: [rollData, ...p.rolls].slice(0, 10) } : p
          )
        );
      }

      setAnimatingPlayers((prev) => {
        const next = new Set(prev);
        next.delete(playerId);
        return next;
      });
    }, 50);
  };

  const rollAll = () => {
    const eligible = players.filter((p) => p.dice.length > 0 && canEdit(p.id));
    if (eligible.length === 0) {
      Alert.alert('No Dice', 'Add dice to at least one player first!');
      return;
    }
    eligible.forEach((p) => rollForPlayer(p.id));
  };

  // ── Player management (offline only) ────────────────────────────────────────

  const addPlayer = () => {
    setLocalPlayers((prev) => [
      ...prev,
      { id: nextId, name: `Player ${nextId}`, dice: [], rolls: [], hideHistory: false },
    ]);
    setNextId((n) => n + 1);
  };

  const removePlayer = (id) => {
    if (localPlayers.length === 1) {
      Alert.alert('Cannot Remove', 'At least one player must remain.');
      return;
    }
    setLocalPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePlayerName = (id, name) => {
    setLocalPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <GameHeader
          title="Dice Roller"
          showOnline={!room.isOnline}
          onOnlinePress={() => setShowRoomLobby(true)}
          actions={[{ icon: 'trash-outline', color: theme.colors.danger, onPress: clearAllRolls, accessibilityLabel: 'Clear rolls' }]}
        />

        {/* Roll all — hidden in online mode when only the user can edit their own dice */}
        {(!room.isOnline || room.allCanEdit) && (
          <TouchableOpacity
            style={[styles.rollAllBtn, { backgroundColor: theme.colors.success }]}
            onPress={rollAll}
          >
            <Ionicons name="dice-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.rollAllBtnText}>Roll All Players</Text>
          </TouchableOpacity>
        )}

        {/* Player cards */}
        {players.map((player) => {
          const isMe = player.id === room.userId && room.isOnline;
          const editable = canEdit(player.id);
          const own = isOwn(player.id);
          const isAnimating = animatingPlayers.has(player.id);
          const counts = countsByType(player.dice);
          const totalDice = player.dice.length;
          const summary = totalDice > 0 ? diceSummary(player.dice) : null;
          // Others see hidden history as a placeholder; owner always sees their own rolls
          const historyVisible = own || !player.hideHistory;

          return (
            <View
              key={player.id}
              style={[
                styles.playerCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                isMe && { borderColor: theme.colors.primary, borderWidth: 2 },
              ]}
            >
              {/* Player header */}
              <View style={styles.playerHeader}>
                <View style={styles.playerHeaderLeft}>
                  {isMe && (
                    <View style={[styles.meBadge, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.meBadgeText}>YOU</Text>
                    </View>
                  )}
                  {editingId === player.id && !room.isOnline ? (
                    <TextInput
                      style={[styles.nameInput, { color: theme.colors.text, borderBottomColor: theme.colors.primary }]}
                      value={player.name}
                      onChangeText={(t) => updatePlayerName(player.id, t)}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity onPress={() => !room.isOnline && setEditingId(player.id)}>
                      <Text style={[styles.playerName, { color: theme.colors.text }]}>{player.name}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.headerBtns}>
                  {/* Hide/show history toggle — only your own card */}
                  {own && (
                    <TouchableOpacity
                      style={[
                        styles.iconBtnSm,
                        { backgroundColor: player.hideHistory ? theme.colors.warning : theme.colors.surface,
                          borderColor: theme.colors.border, borderWidth: 1 },
                      ]}
                      onPress={() => toggleHideHistory(player.id)}
                    >
                      <Ionicons
                        name={player.hideHistory ? 'eye-off-outline' : 'eye-outline'}
                        size={15}
                        color={player.hideHistory ? '#fff' : theme.colors.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                  {!room.isOnline && (
                    <TouchableOpacity
                      style={[styles.iconBtnSm, { backgroundColor: theme.colors.danger }]}
                      onPress={() => removePlayer(player.id)}
                    >
                      <Ionicons name="close" size={15} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Dice selector grid */}
              {editable && (
                <View style={styles.dicePickerSection}>
                  <View style={styles.diceGrid}>
                    {DICE_TYPES.map((type) => {
                      const count = counts[type] || 0;
                      const active = count > 0;
                      return (
                        <View key={type} style={styles.diceCell}>
                          <TouchableOpacity
                            style={[
                              styles.diceTypeCard,
                              {
                                backgroundColor: active ? theme.colors.primary : theme.colors.background,
                                borderColor: active ? theme.colors.primary : theme.colors.border,
                              },
                            ]}
                            onPress={() => addDice(player.id, type)}
                          >
                            <Text style={[styles.diceTypeName, { color: active ? '#fff' : theme.colors.text }]}>
                              d{type}
                            </Text>
                            {active && (
                              <View style={styles.countBadge}>
                                <Text style={styles.countBadgeText}>{count}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                          {active && (
                            <TouchableOpacity
                              style={[styles.removeOneDiceBtn, { backgroundColor: theme.colors.danger }]}
                              onPress={() => removeDice(player.id, type)}
                            >
                              <Ionicons name="remove" size={12} color="#fff" />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>

                  {/* Summary + clear */}
                  {summary && (
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {summary}
                      </Text>
                      <TouchableOpacity onPress={() => clearDice(player.id)}>
                        <Text style={[styles.clearDiceText, { color: theme.colors.danger }]}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Dice summary for observers (non-editable) */}
              {!editable && (
                <Text style={[styles.observerDice, { color: theme.colors.textSecondary }]}>
                  {summary || 'No dice selected'}
                </Text>
              )}

              {/* Roll button */}
              {editable && (
                <TouchableOpacity
                  style={[
                    styles.rollBtn,
                    {
                      backgroundColor:
                        totalDice === 0 || isAnimating
                          ? theme.colors.border
                          : theme.colors.primary,
                    },
                  ]}
                  onPress={() => rollForPlayer(player.id)}
                  disabled={totalDice === 0 || isAnimating}
                >
                  <Ionicons name="dice-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.rollBtnText}>
                    {isAnimating ? 'Rolling...' : `Roll  (${totalDice} ${totalDice === 1 ? 'die' : 'dice'})`}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Roll history */}
              {player.rolls.length > 0 && (
                <View style={[styles.historySection, { borderTopColor: theme.colors.border }]}>
                  <View style={styles.historyHeader}>
                    <Text style={[styles.historyTitle, { color: theme.colors.textSecondary }]}>
                      Roll History
                      {own && player.hideHistory ? '  (hidden from others)' : ''}
                    </Text>
                    {editable && historyVisible && (
                      <TouchableOpacity onPress={() => clearRolls(player.id)}>
                        <Text style={[styles.clearHistoryText, { color: theme.colors.danger }]}>Clear</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {!historyVisible && (
                    <Text style={[styles.hiddenNote, { color: theme.colors.textSecondary }]}>
                      This player has hidden their roll history.
                    </Text>
                  )}

                  {historyVisible && player.rolls.map((roll) => {
                    // Group results by dice type for compact display
                    const grouped = {};
                    for (const r of roll.results) {
                      if (!grouped[r.type]) grouped[r.type] = [];
                      grouped[r.type].push(r.result);
                    }
                    return (
                      <View key={roll.id} style={[styles.rollEntry, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                        <View style={styles.rollEntryTop}>
                          <Text style={[styles.rollTimestamp, { color: theme.colors.textSecondary }]}>
                            {roll.timestamp}
                          </Text>
                          <View style={[styles.totalBadge, { backgroundColor: theme.colors.success }]}>
                            <Text style={styles.totalBadgeText}>{roll.total}</Text>
                          </View>
                        </View>
                        <View style={styles.rollResults}>
                          {Object.entries(grouped)
                            .sort((a, b) => Number(a[0]) - Number(b[0]))
                            .map(([type, values]) =>
                              values.map((val, i) => (
                                <View
                                  key={`${type}-${i}`}
                                  style={[
                                    styles.resultChip,
                                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary },
                                  ]}
                                >
                                  <Text style={[styles.resultChipType, { color: theme.colors.primary }]}>d{type}</Text>
                                  <Text style={[styles.resultChipValue, { color: theme.colors.text }]}>{val}</Text>
                                </View>
                              ))
                            )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {!room.isOnline && (
          <TouchableOpacity
            style={[styles.addPlayerBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={addPlayer}
          >
            <Ionicons name="person-add-outline" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.addPlayerBtnText, { color: theme.colors.primary }]}>Add Player</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <RoomLobby
        visible={showRoomLobby}
        onClose={() => setShowRoomLobby(false)}
        room={room}
        gameType="DiceRoller"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 30, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Roll all
  rollAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  rollAllBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  // Player card
  playerCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  playerHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  meBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  meBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  playerName: { fontSize: 20, fontWeight: '700' },
  nameInput: {
    fontSize: 20,
    fontWeight: '700',
    borderBottomWidth: 2,
    minWidth: 120,
    padding: 2,
  },
  headerBtns: { flexDirection: 'row', gap: 6 },
  iconBtnSm: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dice picker
  dicePickerSection: { marginBottom: 12 },
  diceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  diceCell: {
    alignItems: 'center',
    width: '18%',
  },
  diceTypeCard: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diceTypeName: { fontSize: 14, fontWeight: '700' },
  countBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  countBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#000' },
  removeOneDiceBtn: {
    marginTop: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Summary row
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  summaryText: { fontSize: 13, flex: 1, fontWeight: '500' },
  clearDiceText: { fontSize: 13, fontWeight: '600', paddingLeft: 12 },
  observerDice: { fontSize: 13, fontStyle: 'italic', marginBottom: 10 },

  // Roll button
  rollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  rollBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // History
  historySection: { borderTopWidth: 1, marginTop: 14, paddingTop: 12 },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  clearHistoryText: { fontSize: 13, fontWeight: '600' },
  hiddenNote: { fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },

  rollEntry: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  rollEntryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rollTimestamp: { fontSize: 12 },
  totalBadge: {
    minWidth: 36,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  totalBadgeText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  rollResults: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  resultChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
  },
  resultChipType: { fontSize: 10, fontWeight: '600', marginBottom: 1 },
  resultChipValue: { fontSize: 18, fontWeight: 'bold' },

  // Add player
  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 4,
  },
  addPlayerBtnText: { fontSize: 16, fontWeight: '600' },
});
