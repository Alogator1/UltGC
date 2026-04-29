import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';

export default function UnoScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { isPremium } = useSubscription();
  const room = useRoom('Uno');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  // ── Offline state ────────────────────────────────────────────────────────────
  const [gameStarted, setGameStarted] = useState(false);
  const [winCondition, setWinCondition] = useState('lowest');
  const [targetScore, setTargetScore] = useState('500');
  const [localPlayers, setLocalPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], totalScore: 0, roundScore: '' },
    { id: 2, name: DEFAULT_PLAYER_NAMES[1], totalScore: 0, roundScore: '' },
  ]);
  const [nextId, setNextId] = useState(3);
  const [currentRound, setCurrentRound] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const [winner, setWinner] = useState(null);
  const winnerAlertedRoundRef = useRef(null); // prevent double winner alert in online mode

  // ── Online-derived values ────────────────────────────────────────────────────

  const effectiveGameStarted = room.isOnline
    ? (room.sharedState?.gameStarted ?? false)
    : gameStarted;

  const effectiveWinCondition = room.isOnline
    ? (room.sharedState?.winCondition ?? winCondition)
    : winCondition;

  const effectiveTargetScore = room.isOnline
    ? (room.sharedState?.targetScore ?? targetScore)
    : targetScore;

  const effectiveCurrentRound = room.isOnline
    ? (room.sharedState?.currentRound ?? 1)
    : currentRound;

  // Derive display players
  const players = room.isOnline
    ? [...room.players]
        .sort((a, b) => (b.id === room.userId ? 1 : 0) - (a.id === room.userId ? 1 : 0))
        .map((p) => ({
          id: p.id,
          name: p.displayName,
          totalScore: p.playerData?.totalScore ?? 0,
          roundScore: p.playerData?.roundScore ?? '',
        }))
    : localPlayers;

  // ── Persistence ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadGameData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('unoGameData');
        if (savedData) {
          const data = JSON.parse(savedData);
          setGameStarted(data.gameStarted || false);
          setWinCondition(data.winCondition || 'lowest');
          setTargetScore(data.targetScore || '500');
          setLocalPlayers(data.players || localPlayers);
          setNextId(data.nextId || 3);
          setCurrentRound(data.currentRound || 1);
        }
      } catch (err) {
        console.error('Error loading game data:', err);
      }
    };
    loadGameData();
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

  useEffect(() => {
    if (room.isOnline) return;
    AsyncStorage.setItem('unoGameData', JSON.stringify({
      gameStarted, winCondition, targetScore, players: localPlayers, nextId, currentRound,
    })).catch(console.error);
  }, [gameStarted, winCondition, targetScore, localPlayers, nextId, currentRound, room.isOnline]);

  // Winner detection in online mode
  useEffect(() => {
    if (!room.isOnline || !room.sharedState?.gameStarted) return;
    const round = room.sharedState?.currentRound ?? 1;
    if (winnerAlertedRoundRef.current === round) return;

    const target = parseInt(effectiveTargetScore);
    const cond = effectiveWinCondition;
    const gamePlayers = players;

    if (cond === 'lowest') {
      const losers = gamePlayers.filter((p) => p.totalScore >= target);
      if (losers.length > 0) {
        const sorted = [...gamePlayers].sort((a, b) => a.totalScore - b.totalScore);
        winnerAlertedRoundRef.current = round;
        setWinner(sorted[0]);
        setShowWinner(true);
      }
    } else {
      const winners = gamePlayers.filter((p) => p.totalScore >= target);
      if (winners.length > 0) {
        const sorted = [...winners].sort((a, b) => b.totalScore - a.totalScore);
        winnerAlertedRoundRef.current = round;
        setWinner(sorted[0]);
        setShowWinner(true);
      }
    }
  }, [room.players, room.sharedState, room.isOnline]);

  // ── Player management (offline only) ────────────────────────────────────────

  const addPlayer = () => {
    setLocalPlayers([...localPlayers, { id: nextId, name: `Player ${nextId}`, totalScore: 0, roundScore: '' }]);
    setNextId(nextId + 1);
  };

  const removePlayer = (id) => {
    if (localPlayers.length <= 2) { Alert.alert('Cannot Remove', 'You need at least 2 players!'); return; }
    setLocalPlayers(localPlayers.filter((p) => p.id !== id));
  };

  const updatePlayerName = (id, name) => {
    setLocalPlayers(localPlayers.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  // ── Round score input ────────────────────────────────────────────────────────

  const updateRoundScore = (id, score) => {
    if (room.isOnline) {
      if (id !== room.userId) return; // each player edits only their own
      const p = room.players.find((r) => r.id === id);
      const pd = { totalScore: p?.playerData?.totalScore ?? 0, roundScore: score };
      room.updatePlayerData(id, pd);
    } else {
      setLocalPlayers(localPlayers.map((p) => (p.id === id ? { ...p, roundScore: score } : p)));
    }
  };

  // ── Game start ───────────────────────────────────────────────────────────────

  const startGame = () => {
    const target = parseInt(effectiveTargetScore);
    if (isNaN(target) || target <= 0) { Alert.alert('Invalid Target', 'Please enter a valid target score'); return; }
    if (room.isOnline) {
      room.updateSharedState({ gameStarted: true, winCondition: effectiveWinCondition, targetScore: effectiveTargetScore, currentRound: 1 });
    } else {
      setGameStarted(true);
    }
  };

  // ── Next round ───────────────────────────────────────────────────────────────

  const nextRound = () => {
    if (room.isOnline) {
      if (!room.isHost && !room.allCanEdit) return;
      const cond = effectiveWinCondition;
      if (cond === 'highest') {
        const roundWinners = room.players.filter((p) => (parseInt(p.playerData?.roundScore) || 0) === 0);
        if (roundWinners.length === 0) {
          Alert.alert('No Winner', 'At least one player must have 0 points for this round');
          return;
        }
        if (roundWinners.length > 1) {
          const buttons = roundWinners.map((p) => ({ text: p.displayName, onPress: () => distributeOnline(p.id) }));
          buttons.push({ text: 'Cancel', style: 'cancel' });
          Alert.alert('Multiple Winners', 'Who won this round?', buttons);
          return;
        }
        distributeOnline(roundWinners[0].id);
      } else {
        const updates = room.players.map((p) => ({
          id: p.id,
          totalScore: (p.playerData?.totalScore ?? 0) + (parseInt(p.playerData?.roundScore) || 0),
          roundScore: '',
        }));
        Promise.all(updates.map((u) => room.updatePlayerData(u.id, { totalScore: u.totalScore, roundScore: u.roundScore }))).then(() => {
          room.updateSharedState({ ...room.sharedState, currentRound: effectiveCurrentRound + 1 });
        });
      }
    } else {
      const cond = winCondition;
      if (cond === 'highest') {
        const roundWinners = localPlayers.filter((p) => (parseInt(p.roundScore) || 0) === 0);
        if (roundWinners.length === 0) {
          Alert.alert('No Winner', 'At least one player must have 0 points for this round (leave empty or enter 0)');
          return;
        }
        if (roundWinners.length > 1) {
          const buttons = roundWinners.map((p) => ({ text: p.name, onPress: () => distributeOffline(p.id) }));
          buttons.push({ text: 'Cancel', style: 'cancel' });
          Alert.alert('Multiple Winners', 'Multiple players have 0 points. Who won this round?', buttons);
          return;
        }
        distributeOffline(roundWinners[0].id);
      } else {
        const updated = localPlayers.map((p) => ({
          ...p, totalScore: p.totalScore + (parseInt(p.roundScore) || 0), roundScore: '',
        }));
        setLocalPlayers(updated);
        setCurrentRound(currentRound + 1);
        setTimeout(() => checkForWinnerOffline(updated), 0);
      }
    }
  };

  const distributeOnline = (winnerId) => {
    const totalPoints = room.players.reduce((sum, p) => p.id === winnerId ? sum : sum + (parseInt(p.playerData?.roundScore) || 0), 0);
    const updates = room.players.map((p) => ({
      id: p.id,
      totalScore: p.id === winnerId ? (p.playerData?.totalScore ?? 0) + totalPoints : (p.playerData?.totalScore ?? 0),
      roundScore: '',
    }));
    Promise.all(updates.map((u) => room.updatePlayerData(u.id, { totalScore: u.totalScore, roundScore: u.roundScore }))).then(() => {
      room.updateSharedState({ ...room.sharedState, currentRound: effectiveCurrentRound + 1 });
    });
  };

  const distributeOffline = (winnerId) => {
    const totalPoints = localPlayers.reduce((sum, p) => p.id === winnerId ? sum : sum + (parseInt(p.roundScore) || 0), 0);
    const updated = localPlayers.map((p) => ({
      ...p, totalScore: p.id === winnerId ? p.totalScore + totalPoints : p.totalScore, roundScore: '',
    }));
    setLocalPlayers(updated);
    setCurrentRound(currentRound + 1);
    setTimeout(() => checkForWinnerOffline(updated), 0);
  };

  const checkForWinnerOffline = (playersToCheck) => {
    const target = parseInt(targetScore);
    if (winCondition === 'lowest') {
      const losers = playersToCheck.filter((p) => p.totalScore >= target);
      if (losers.length > 0) {
        const sorted = [...playersToCheck].sort((a, b) => a.totalScore - b.totalScore);
        setWinner(sorted[0]);
        setShowWinner(true);
      }
    } else {
      const winners = playersToCheck.filter((p) => p.totalScore >= target);
      if (winners.length > 0) {
        const sorted = [...winners].sort((a, b) => b.totalScore - a.totalScore);
        setWinner(sorted[0]);
        setShowWinner(true);
      }
    }
  };

  const resetGame = () => {
    if (room.isOnline && !room.isHost && !room.allCanEdit) return;
    Alert.alert('Reset Game', 'Are you sure you want to reset the game?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive',
        onPress: () => {
          if (room.isOnline) {
            room.players.forEach((p) => room.updatePlayerData(p.id, { totalScore: 0, roundScore: '' }));
            room.updateSharedState({ gameStarted: false, currentRound: 1, winCondition: effectiveWinCondition, targetScore: effectiveTargetScore });
          } else {
            setGameStarted(false);
            setLocalPlayers(localPlayers.map((p) => ({ ...p, totalScore: 0, roundScore: '' })));
            setCurrentRound(1);
          }
          winnerAlertedRoundRef.current = null;
          setShowWinner(false);
          setWinner(null);
        },
      },
    ]);
  };

  // ── Setup screen ─────────────────────────────────────────────────────────────

  if (!effectiveGameStarted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.setupHeader}>
            <Text style={styles.title}>UNO Score Tracker</Text>
            {!room.isOnline && (
              <TouchableOpacity style={[styles.onlineBtn, { backgroundColor: theme.colors.primary }]} onPress={() => setShowRoomLobby(true)}>
                <Ionicons name="wifi" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.setupSection, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Game Setup</Text>

            <Text style={[styles.label, { color: theme.colors.text }]}>Win Condition:</Text>
            <View style={styles.buttonGroup}>
              {['lowest', 'highest'].map((cond) => (
                <TouchableOpacity
                  key={cond}
                  style={[
                    styles.optionButton,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    effectiveWinCondition === cond && [styles.optionButtonActive, { borderColor: '#DC143C', backgroundColor: theme.dark ? '#3d1f1f' : '#FFE8E8' }],
                    room.isOnline && !room.isHost && styles.disabledBtn,
                  ]}
                  onPress={() => {
                    if (room.isOnline) {
                      if (!room.isHost) return;
                      room.updateSharedState({ ...room.sharedState, winCondition: cond });
                    } else {
                      setWinCondition(cond);
                    }
                  }}
                  disabled={room.isOnline && !room.isHost}
                >
                  <Text style={[styles.optionButtonText, { color: theme.colors.textSecondary }, effectiveWinCondition === cond && styles.optionButtonTextActive]}>
                    {cond === 'lowest' ? 'Lowest Score Wins' : 'Highest Score Wins'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>Target Score:</Text>
            <TextInput
              style={[styles.targetInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={effectiveTargetScore}
              onChangeText={(val) => {
                if (room.isOnline) {
                  if (!room.isHost) return;
                  room.updateSharedState({ ...room.sharedState, targetScore: val });
                } else {
                  setTargetScore(val);
                }
              }}
              keyboardType="numeric"
              placeholder="Enter target score"
              placeholderTextColor={theme.colors.textTertiary}
              editable={!room.isOnline || room.isHost}
            />

            {!room.isOnline && (
              <>
                <Text style={[styles.label, { color: theme.colors.text }]}>Players:</Text>
                {localPlayers.map((player) => (
                  <View key={player.id} style={[styles.playerSetupCard, { backgroundColor: theme.colors.surface }]}>
                    {editingId === player.id ? (
                      <TextInput
                        style={[styles.nameInput, { color: theme.colors.text }]}
                        value={player.name}
                        onChangeText={(text) => updatePlayerName(player.id, text)}
                        onBlur={() => setEditingId(null)}
                        autoFocus
                      />
                    ) : (
                      <TouchableOpacity onPress={() => setEditingId(player.id)}>
                        <Text style={[styles.playerSetupName, { color: theme.colors.text }]}>{player.name}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.removeButton, { backgroundColor: theme.colors.danger }]} onPress={() => removePlayer(player.id)}>
                      <Text style={styles.removeButtonText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={[styles.addPlayerButton, { backgroundColor: theme.colors.primary }]} onPress={addPlayer}>
                  <Text style={styles.addPlayerButtonText}>+ Add Player</Text>
                </TouchableOpacity>
              </>
            )}

            {room.isOnline && (
              <View style={[styles.onlinePlayersList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Players in Room ({room.players.length}):</Text>
                {room.players.map((p) => (
                  <Text key={p.id} style={[styles.onlinePlayerName, { color: theme.colors.text }]}>• {p.displayName}</Text>
                ))}
              </View>
            )}

            {(!room.isOnline || room.isHost) && (
              <TouchableOpacity style={styles.startButton} onPress={startGame}>
                <Text style={styles.startButtonText}>Start Game</Text>
              </TouchableOpacity>
            )}
            {room.isOnline && !room.isHost && (
              <Text style={[styles.waitingText, { color: theme.colors.textSecondary }]}>Waiting for host to start the game…</Text>
            )}
          </View>
        </ScrollView>
        <RoomLobby visible={showRoomLobby} onClose={handleCloseLobby} room={room} gameType="Uno" />
      </View>
    );
  }

  // ── Game screen ──────────────────────────────────────────────────────────────

  const canAdvanceRound = !room.isOnline || room.isHost || room.allCanEdit;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>UNO - Round {effectiveCurrentRound}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {effectiveWinCondition === 'lowest' ? 'Lowest' : 'Highest'} score wins • Target: {effectiveTargetScore}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {!room.isOnline && (
              <TouchableOpacity style={[styles.onlineBtn, { backgroundColor: theme.colors.primary }]} onPress={() => setShowRoomLobby(true)}>
                <Ionicons name="wifi" size={16} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.resetButton, { backgroundColor: theme.colors.danger }]} onPress={resetGame}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.tableContainer, { backgroundColor: theme.colors.card }]}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.nameColumn]}>Player</Text>
            <Text style={[styles.tableHeaderText, styles.scoreColumn]}>Total</Text>
            <Text style={[styles.tableHeaderText, styles.roundColumn]}>This Round</Text>
          </View>

          {players.map((player) => {
            const canEditRound = !room.isOnline || player.id === room.userId;
            return (
              <View
                key={player.id}
                style={[
                  styles.tableRow,
                  { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
                  player.id === room.userId && room.isOnline && { borderLeftColor: theme.colors.primary, borderLeftWidth: 3 },
                ]}
              >
                <Text style={[styles.tableCellText, styles.nameColumn, { color: theme.colors.text }]}>{player.name}</Text>
                <Text style={[styles.tableCellText, styles.scoreColumn, styles.totalScore]}>{player.totalScore}</Text>
                <TextInput
                  style={[
                    styles.roundInput, styles.roundColumn,
                    { backgroundColor: theme.dark ? '#2C2C2E' : '#f0f0f0', borderColor: theme.colors.border, color: theme.colors.text },
                    !canEditRound && { opacity: 0.4 },
                  ]}
                  value={player.roundScore}
                  onChangeText={(text) => updateRoundScore(player.id, text)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.colors.textTertiary}
                  editable={canEditRound}
                />
              </View>
            );
          })}
        </View>

        {effectiveWinCondition === 'highest' && (
          <View style={[styles.infoBox, { backgroundColor: theme.dark ? '#1a2f3d' : '#E8F4FF' }]}>
            <Text style={[styles.infoText, { color: theme.dark ? '#5DADE2' : '#0066CC' }]}>
              ℹ️ Leave empty or enter 0 for the player who won this round. All other players' points go to the winner.
            </Text>
          </View>
        )}
        {effectiveWinCondition === 'lowest' && (
          <View style={[styles.infoBox, { backgroundColor: theme.dark ? '#1a2f3d' : '#E8F4FF' }]}>
            <Text style={[styles.infoText, { color: theme.dark ? '#5DADE2' : '#0066CC' }]}>
              ℹ️ Enter each player's score for this round. Empty cells are treated as 0.
            </Text>
          </View>
        )}

        {canAdvanceRound ? (
          <TouchableOpacity style={[styles.nextRoundButton, { backgroundColor: theme.colors.success }]} onPress={nextRound}>
            <Text style={styles.nextRoundButtonText}>Next Round</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.nextRoundButton, { backgroundColor: theme.colors.success, opacity: 0.4 }]}>
            <Text style={styles.nextRoundButtonText}>Waiting for host to advance…</Text>
          </View>
        )}
      </ScrollView>

      {/* Winner Modal */}
      <Modal visible={showWinner} transparent animationType="fade" onRequestClose={() => setShowWinner(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.winnerModal, { backgroundColor: theme.colors.background }]}>
            <Text style={styles.winnerEmoji}>🎉</Text>
            <Text style={[styles.winnerTitle, { color: theme.colors.text }]}>Game Over!</Text>
            <Text style={styles.winnerName}>{winner?.name}</Text>
            <Text style={[styles.winnerMessage, { color: theme.colors.textSecondary }]}>wins with {winner?.totalScore} points!</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.newGameButton, { backgroundColor: theme.colors.success }]} onPress={() => { setShowWinner(false); resetGame(); }}>
                <Text style={styles.newGameButtonText}>New Game</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.colors.primary }]} onPress={() => setShowWinner(false)}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <RoomLobby visible={showRoomLobby} onClose={handleCloseLobby} room={room} gameType="Uno" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  setupHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#DC143C', marginBottom: 4 },
  subtitle: { fontSize: 14 },
  onlineBtn: { borderRadius: 8, padding: 8, justifyContent: 'center', alignItems: 'center' },
  resetButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  resetButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  setupSection: { borderRadius: 12, padding: 20 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 10, marginTop: 15 },
  buttonGroup: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  optionButton: { flex: 1, borderWidth: 2, borderRadius: 10, padding: 12, alignItems: 'center' },
  optionButtonActive: { borderColor: '#DC143C' },
  optionButtonText: { fontSize: 14, fontWeight: '600' },
  optionButtonTextActive: { color: '#DC143C' },
  targetInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  playerSetupCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, padding: 12, marginBottom: 8 },
  playerSetupName: { fontSize: 16 },
  nameInput: { fontSize: 16, borderBottomWidth: 2, borderBottomColor: '#DC143C', padding: 0, minWidth: 150 },
  removeButton: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold', lineHeight: 20 },
  addPlayerButton: { borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 10 },
  addPlayerButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  onlinePlayersList: { borderRadius: 8, padding: 12, borderWidth: 1, marginTop: 10 },
  onlinePlayerName: { fontSize: 15, marginVertical: 3 },
  startButton: { backgroundColor: '#DC143C', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 20 },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  waitingText: { textAlign: 'center', marginTop: 20, fontSize: 15, fontStyle: 'italic' },
  tableContainer: { borderRadius: 12, overflow: 'hidden', marginBottom: 15 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#DC143C', padding: 12 },
  tableHeaderText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  nameColumn: { flex: 2 },
  scoreColumn: { flex: 1, textAlign: 'center' },
  roundColumn: { flex: 1, textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, padding: 12 },
  tableCellText: { fontSize: 16 },
  totalScore: { fontWeight: 'bold', color: '#DC143C' },
  roundInput: { borderRadius: 6, padding: 8, fontSize: 16, textAlign: 'center', borderWidth: 1 },
  infoBox: { borderRadius: 8, padding: 12, marginBottom: 15 },
  infoText: { fontSize: 14, lineHeight: 20 },
  nextRoundButton: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 },
  nextRoundButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  disabledBtn: { opacity: 0.4 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  winnerModal: { borderRadius: 20, padding: 30, width: '100%', maxWidth: 350, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 10 },
  winnerEmoji: { fontSize: 72, marginBottom: 16 },
  winnerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  winnerName: { fontSize: 32, fontWeight: 'bold', color: '#DC143C', marginBottom: 8, textAlign: 'center' },
  winnerMessage: { fontSize: 20, marginBottom: 30, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  newGameButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  newGameButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
