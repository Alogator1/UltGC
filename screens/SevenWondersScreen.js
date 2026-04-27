import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';
import { STORAGE_KEYS } from '../constants/gameConfig';
import { SEVEN_WONDERS_COLORS as PLAYER_COLORS } from '../constants/colors';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';

const STORAGE_KEY = STORAGE_KEYS.SEVEN_WONDERS;

const DEFAULT_PLAYER_DATA = {
  military: 0, treasury: 0, wonder: 0, civilian: 0,
  commerce: 0, guilds: 0, science: { compass: 0, gear: 0, tablet: 0 },
};

export default function SevenWondersScreen() {
  const { theme } = useTheme();
  const room = useRoom('SevenWonders');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  // ── Offline state ────────────────────────────────────────────────────────────
  const [localPlayers, setLocalPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], color: PLAYER_COLORS[0], ...DEFAULT_PLAYER_DATA, science: { compass: 0, gear: 0, tablet: 0 } },
  ]);
  const [editingId, setEditingId] = useState(null);
  const [results, setResults] = useState(null);

  // ── Online helpers ───────────────────────────────────────────────────────────

  const canEdit = (playerId) =>
    !room.isOnline || room.allCanEdit || playerId === room.userId;

  const getPlayerData = (playerId) => {
    const p = room.players.find((r) => r.id === playerId);
    const pd = p?.playerData ?? {};
    return {
      military: pd.military ?? 0,
      treasury: pd.treasury ?? 0,
      wonder: pd.wonder ?? 0,
      civilian: pd.civilian ?? 0,
      commerce: pd.commerce ?? 0,
      guilds: pd.guilds ?? 0,
      science: {
        compass: pd.science?.compass ?? 0,
        gear: pd.science?.gear ?? 0,
        tablet: pd.science?.tablet ?? 0,
      },
    };
  };

  // Derive display players
  const players = room.isOnline
    ? [...room.players]
        .sort((a, b) => (b.id === room.userId ? 1 : 0) - (a.id === room.userId ? 1 : 0))
        .map((p, i) => ({
          id: p.id,
          name: p.displayName,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          military: p.playerData?.military ?? 0,
          treasury: p.playerData?.treasury ?? 0,
          wonder: p.playerData?.wonder ?? 0,
          civilian: p.playerData?.civilian ?? 0,
          commerce: p.playerData?.commerce ?? 0,
          guilds: p.playerData?.guilds ?? 0,
          science: {
            compass: p.playerData?.science?.compass ?? 0,
            gear: p.playerData?.science?.gear ?? 0,
            tablet: p.playerData?.science?.tablet ?? 0,
          },
        }))
    : localPlayers;

  // ── Persistence ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedData) {
          const { players: savedPlayers } = JSON.parse(savedData);
          setLocalPlayers(savedPlayers);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    loadData();
    return () => { room.deleteRoom(); };
  }, []);

  useEffect(() => {
    if (room.isOnline) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ players: localPlayers })).catch(console.error);
  }, [localPlayers, room.isOnline]);

  // ── Score helpers ────────────────────────────────────────────────────────────

  const calculateSciencePoints = (science) => {
    const { compass, gear, tablet } = science;
    return (compass * compass) + (gear * gear) + (tablet * tablet) + Math.min(compass, gear, tablet) * 7;
  };

  const calculateTotalScore = (player) => {
    return player.military + Math.floor(player.treasury / 3) + player.wonder +
      player.civilian + calculateSciencePoints(player.science) + player.commerce + player.guilds;
  };

  const calculateScores = () => {
    const scores = players.map((player) => ({
      player,
      breakdown: {
        military: player.military,
        treasury: Math.floor(player.treasury / 3),
        wonder: player.wonder,
        civilian: player.civilian,
        science: calculateSciencePoints(player.science),
        commerce: player.commerce,
        guilds: player.guilds,
      },
      total: calculateTotalScore(player),
    }));
    scores.sort((a, b) => b.total - a.total);
    setResults(scores);
  };

  // ── Player management (offline only) ────────────────────────────────────────

  const addPlayer = () => {
    if (localPlayers.length >= 7) { Alert.alert('Max Players', '7 Wonders supports up to 7 players.'); return; }
    const newId = localPlayers.length > 0 ? Math.max(...localPlayers.map((p) => p.id)) + 1 : 1;
    setLocalPlayers([...localPlayers, {
      id: newId, name: `Player ${newId}`, color: PLAYER_COLORS[localPlayers.length % PLAYER_COLORS.length],
      ...DEFAULT_PLAYER_DATA, science: { compass: 0, gear: 0, tablet: 0 },
    }]);
  };

  const removePlayer = (id) => {
    if (localPlayers.length <= 1) { Alert.alert('Cannot Remove', 'You must have at least one player.'); return; }
    setLocalPlayers(localPlayers.filter((p) => p.id !== id));
  };

  const updatePlayerName = (id, name) => {
    setLocalPlayers(localPlayers.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  // ── Mutations ────────────────────────────────────────────────────────────────

  const adjustScore = (id, field, amount) => {
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

  const updateScore = (id, field, value) => {
    const parsed = Math.max(0, parseInt(value) || 0);
    if (room.isOnline) {
      if (!canEdit(id)) return;
      const pd = getPlayerData(id);
      room.updatePlayerData(id, { ...pd, [field]: parsed });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: parsed } : p))
      );
    }
  };

  const adjustScience = (id, type, amount) => {
    if (room.isOnline) {
      if (!canEdit(id)) return;
      const pd = getPlayerData(id);
      room.updatePlayerData(id, { ...pd, science: { ...pd.science, [type]: Math.max(0, pd.science[type] + amount) } });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, science: { ...p.science, [type]: Math.max(0, p.science[type] + amount) } } : p))
      );
    }
  };

  const updateScience = (id, type, value) => {
    const parsed = Math.max(0, parseInt(value) || 0);
    if (room.isOnline) {
      if (!canEdit(id)) return;
      const pd = getPlayerData(id);
      room.updatePlayerData(id, { ...pd, science: { ...pd.science, [type]: parsed } });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, science: { ...p.science, [type]: parsed } } : p))
      );
    }
  };

  const resetGame = () => {
    if (room.isOnline && !room.isHost && !room.allCanEdit) return;
    Alert.alert('Reset Game', 'Are you sure you want to reset all scores?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive',
        onPress: () => {
          if (room.isOnline) {
            room.players.forEach((p) => {
              room.updatePlayerData(p.id, { ...DEFAULT_PLAYER_DATA, science: { compass: 0, gear: 0, tablet: 0 } });
            });
          } else {
            setLocalPlayers((prev) => prev.map((p) => ({
              ...p, military: 0, treasury: 0, wonder: 0, civilian: 0,
              commerce: 0, guilds: 0, science: { compass: 0, gear: 0, tablet: 0 },
            })));
          }
          setResults(null);
        },
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>🏛️ 7 Wonders Scorer</Text>
          <View style={styles.headerButtons}>
            {!room.isOnline && (
              <TouchableOpacity
                style={[styles.onlineBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowRoomLobby(true)}
              >
                <Ionicons name="wifi" size={16} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.resetButton, { backgroundColor: theme.colors.danger }]} onPress={resetGame}>
              <Text style={styles.resetButtonText}>Reset Game</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.playersSection}>
          {players.map((player) => (
            <View
              key={player.id}
              style={[
                styles.playerCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderLeftColor: player.color, borderLeftWidth: 6 },
                player.id === room.userId && room.isOnline && { borderColor: theme.colors.primary, borderWidth: 2, borderLeftColor: player.color, borderLeftWidth: 6 },
              ]}
            >
              <View style={styles.playerHeader}>
                {editingId === player.id && !room.isOnline ? (
                  <TextInput
                    style={[styles.nameInput, { color: theme.colors.text, borderBottomColor: theme.colors.primary }]}
                    value={player.name}
                    onChangeText={(text) => updatePlayerName(player.id, text)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                ) : (
                  <TouchableOpacity onPress={() => !room.isOnline && setEditingId(player.id)}>
                    <Text style={[styles.playerName, { color: theme.colors.text }]}>{player.name}</Text>
                  </TouchableOpacity>
                )}
                {!room.isOnline && (
                  <TouchableOpacity style={[styles.removeButton, { backgroundColor: theme.colors.danger }]} onPress={() => removePlayer(player.id)}>
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Military */}
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreLabel, { color: theme.colors.text }]}>⚔️ Military</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'military', -1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.scoreInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={player.military.toString()}
                    onChangeText={(text) => updateScore(player.id, 'military', text)}
                    keyboardType="numeric"
                    editable={canEdit(player.id)}
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'military', 1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Treasury */}
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreLabel, { color: theme.colors.text }]}>💰 Treasury (÷3)</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'treasury', -1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.scoreInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={player.treasury.toString()}
                    onChangeText={(text) => updateScore(player.id, 'treasury', text)}
                    keyboardType="numeric"
                    editable={canEdit(player.id)}
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'treasury', 1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Wonder */}
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreLabel, { color: theme.colors.text }]}>🏗️ Wonder</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'wonder', -1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.scoreInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={player.wonder.toString()}
                    onChangeText={(text) => updateScore(player.id, 'wonder', text)}
                    keyboardType="numeric"
                    editable={canEdit(player.id)}
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'wonder', 1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Civilian */}
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreLabel, { color: theme.colors.text }]}>🏘️ Civilian</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'civilian', -1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.scoreInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={player.civilian.toString()}
                    onChangeText={(text) => updateScore(player.id, 'civilian', text)}
                    keyboardType="numeric"
                    editable={canEdit(player.id)}
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'civilian', 1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Science */}
              <View style={[styles.scienceSection, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.scienceTitle, { color: theme.colors.text }]}>🔬 Science</Text>

                {[['compass', '🧭 Compass'], ['gear', '⚙️ Gear'], ['tablet', '📜 Tablet']].map(([key, label]) => (
                  <View key={key} style={styles.scienceItemRow}>
                    <Text style={[styles.scienceLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
                    <View style={styles.scienceControls}>
                      <TouchableOpacity style={[styles.scienceButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScience(player.id, key, -1)} disabled={!canEdit(player.id)}>
                        <Text style={styles.scienceButtonText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.scienceInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                        value={player.science[key].toString()}
                        onChangeText={(text) => updateScience(player.id, key, text)}
                        keyboardType="numeric"
                        editable={canEdit(player.id)}
                        placeholderTextColor={theme.colors.textTertiary}
                      />
                      <TouchableOpacity style={[styles.scienceButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScience(player.id, key, 1)} disabled={!canEdit(player.id)}>
                        <Text style={styles.scienceButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Commerce */}
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreLabel, { color: theme.colors.text }]}>🏪 Commerce</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'commerce', -1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.scoreInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={player.commerce.toString()}
                    onChangeText={(text) => updateScore(player.id, 'commerce', text)}
                    keyboardType="numeric"
                    editable={canEdit(player.id)}
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'commerce', 1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Guilds */}
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreLabel, { color: theme.colors.text }]}>👥 Guilds</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'guilds', -1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.scoreInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={player.guilds.toString()}
                    onChangeText={(text) => updateScore(player.id, 'guilds', text)}
                    keyboardType="numeric"
                    editable={canEdit(player.id)}
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                  <TouchableOpacity style={[styles.adjustButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]} onPress={() => adjustScore(player.id, 'guilds', 1)} disabled={!canEdit(player.id)}>
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.totalRow, { borderTopColor: theme.colors.border }]}>
                <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>Total Score:</Text>
                <Text style={[styles.totalValue, { color: theme.colors.primary }]}>{calculateTotalScore(player)}</Text>
              </View>
            </View>
          ))}

          {!room.isOnline && (
            <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.success }]} onPress={addPlayer}>
              <Text style={styles.addButtonText}>+ Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.calculateButton, { backgroundColor: theme.colors.warning }]} onPress={calculateScores}>
          <Text style={styles.calculateButtonText}>🏆 Calculate Final Scores</Text>
        </TouchableOpacity>

        <View style={[styles.infoSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>📖 Scoring Guide</Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
            • ⚔️ Military: Points from conflicts{'\n'}
            • 💰 Treasury: 1 point per 3 coins{'\n'}
            • 🏗️ Wonder: Points from stages{'\n'}
            • 🏘️ Civilian: Blue card points{'\n'}
            • 🔬 Science: n² per symbol + 7 per set{'\n'}
            • 🏪 Commerce: Yellow card points{'\n'}
            • 👥 Guilds: Purple card points
            {!room.isOnline ? '\n• ✏️ Tap player names to edit' : ''}
          </Text>
        </View>
      </ScrollView>

      {/* Results Modal */}
      <Modal visible={results !== null} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.resultsTitle, { color: theme.colors.text }]}>🏆 Final Scores</Text>
            <ScrollView style={styles.resultsScroll}>
              {results?.map((result, index) => (
                <View key={result.player.id} style={[styles.resultCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <View style={styles.resultHeader}>
                    <Text style={[styles.resultRank, { color: theme.colors.primary }]}>#{index + 1}</Text>
                    <Text style={[styles.resultName, { color: theme.colors.text }]}>{result.player.name}</Text>
                    <Text style={[styles.resultTotal, { color: theme.colors.success }]}>{result.total}</Text>
                  </View>
                  <View style={styles.breakdown}>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>Military: {result.breakdown.military}</Text>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>Treasury: {result.breakdown.treasury}</Text>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>Wonder: {result.breakdown.wonder}</Text>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>Civilian: {result.breakdown.civilian}</Text>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>Science: {result.breakdown.science}</Text>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>Commerce: {result.breakdown.commerce}</Text>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>Guilds: {result.breakdown.guilds}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.colors.primary }]} onPress={() => setResults(null)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <RoomLobby
        visible={showRoomLobby}
        onClose={() => setShowRoomLobby(false)}
        room={room}
        gameType="SevenWonders"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  headerButtons: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  onlineBtn: { borderRadius: 8, padding: 8, justifyContent: 'center', alignItems: 'center' },
  resetButton: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  resetButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  playersSection: { marginBottom: 20 },
  playerCard: { borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1 },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  playerName: { fontSize: 20, fontWeight: '600' },
  nameInput: { fontSize: 20, fontWeight: '600', borderBottomWidth: 2, minWidth: 150, padding: 0 },
  removeButton: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 24 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scoreLabel: { fontSize: 16, flex: 1, fontWeight: '500' },
  scoreControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adjustButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  adjustButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  scoreInput: { padding: 8, borderRadius: 6, width: 50, textAlign: 'center', fontSize: 16, borderWidth: 1 },
  scienceSection: { borderRadius: 8, padding: 12, marginVertical: 10, borderWidth: 1 },
  scienceTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  scienceItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scienceLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
  scienceControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scienceButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  scienceButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  scienceInput: { padding: 8, borderRadius: 6, width: 50, textAlign: 'center', fontSize: 16, borderWidth: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  totalLabel: { fontSize: 16, fontWeight: '600' },
  totalValue: { fontSize: 24, fontWeight: 'bold' },
  addButton: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  calculateButton: { borderRadius: 12, padding: 18, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  calculateButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  infoSection: { padding: 15, borderRadius: 12, borderWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  text: { fontSize: 14, lineHeight: 22 },
  disabledBtn: { opacity: 0.4 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 20, padding: 20, maxHeight: '80%' },
  resultsTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  resultsScroll: { maxHeight: 400 },
  resultCard: { padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  resultRank: { fontSize: 18, fontWeight: 'bold' },
  resultName: { fontSize: 18, fontWeight: 'bold', flex: 1, marginLeft: 10 },
  resultTotal: { fontSize: 24, fontWeight: 'bold' },
  breakdown: { paddingLeft: 10 },
  breakdownText: { fontSize: 12, marginBottom: 2 },
  closeButton: { padding: 15, borderRadius: 10, marginTop: 15 },
  closeButtonText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 16 },
});
