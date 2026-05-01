import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';
import { STORAGE_KEYS, AUTO_SAVE_TIMEOUT } from '../constants/gameConfig';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';
import GameHeader from '../components/GameHeader';

const STORAGE_KEY = STORAGE_KEYS.COUNTER;

export default function CounterScreen() {
  const { theme } = useTheme();
  const room = useRoom('Counter');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  const [localPlayers, setLocalPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], score: 0 },
    { id: 2, name: DEFAULT_PLAYER_NAMES[1], score: 0 },
  ]);
  const [editingId, setEditingId] = useState(null);
  const [editingScoreId, setEditingScoreId] = useState(null);
  const [scoreInput, setScoreInput] = useState('');
  const [lastSaveTime, setLastSaveTime] = useState(Date.now());

  // Derive effective players list: either local or from online room
  const players = room.isOnline
    ? [...room.players]
        .sort((a, b) => (b.id === room.userId ? 1 : 0) - (a.id === room.userId ? 1 : 0))
        .map((p) => ({
          id: p.id,
          name: p.displayName,
          score: p.playerData?.score || 0,
        }))
    : localPlayers;

  useEffect(() => {
    loadData();
    return () => {
      room.deleteRoom();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveData();
    }, 1000);
    return () => clearTimeout(timer);
  }, [localPlayers]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const { players: savedPlayers, timestamp } = JSON.parse(savedData);
        const timeDiff = Date.now() - timestamp;
        if (timeDiff < AUTO_SAVE_TIMEOUT) {
          setLocalPlayers(savedPlayers);
          setLastSaveTime(timestamp);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveData = async () => {
    try {
      const dataToSave = {
        players: localPlayers,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      setLastSaveTime(Date.now());
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const addPlayer = () => {
    const newId = localPlayers.length > 0 ? Math.max(...localPlayers.map(p => p.id)) + 1 : 1;
    setLocalPlayers([...localPlayers, { id: newId, name: `Player ${newId}`, score: 0 }]);
  };

  const removePlayer = (id) => {
    if (localPlayers.length > 1) {
      setLocalPlayers(localPlayers.filter(p => p.id !== id));
    } else {
      Alert.alert('Cannot Remove', 'You must have at least one player.');
    }
  };

  const updateScore = (id, delta) => {
    if (room.isOnline) {
      if (!room.allCanEdit && id !== room.userId) return;
      const target = room.players.find(p => p.id === id);
      const currentScore = target?.playerData?.score || 0;
      room.updatePlayerData(id, { score: currentScore + delta });
    } else {
      setLocalPlayers(localPlayers.map(p =>
        p.id === id ? { ...p, score: p.score + delta } : p
      ));
    }
  };

  const updateName = (id, name) => {
    // Names are not editable in online mode
    if (room.isOnline) return;
    setLocalPlayers(localPlayers.map(p =>
      p.id === id ? { ...p, name } : p
    ));
  };

  const startEditScore = (id, currentScore) => {
    setEditingScoreId(id);
    setScoreInput(String(currentScore));
  };

  const saveScore = (id) => {
    const newScore = parseInt(scoreInput, 10);
    if (!isNaN(newScore)) {
      if (room.isOnline) {
        if (!room.allCanEdit && id !== room.userId) return;
        room.updatePlayerData(id, { score: newScore });
      } else {
        setLocalPlayers(localPlayers.map(p =>
          p.id === id ? { ...p, score: newScore } : p
        ));
      }
    }
    setEditingScoreId(null);
    setScoreInput('');
  };

  const resetScores = () => {
    Alert.alert(
      'Reset Scores',
      'Are you sure you want to reset all scores to 0?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            if (room.isOnline) {
              if (room.allCanEdit) {
                room.players.forEach(p => room.updatePlayerData(p.id, { score: 0 }));
              } else {
                room.updatePlayerData(room.userId, { score: 0 });
              }
            } else {
              setLocalPlayers(localPlayers.map(p => ({ ...p, score: 0 })));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <GameHeader
          title="Counter"
          showOnline={!room.isOnline}
          onOnlinePress={() => setShowRoomLobby(true)}
          actions={[{ label: 'Reset', color: theme.colors.danger, onPress: resetScores }]}
        />

        <View style={styles.playersSection}>
          {players.map((player) => (
            <View 
              key={player.id} 
              style={[
                styles.playerCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                }
              ]}
            >
              <View style={styles.playerHeader}>
                {editingId === player.id && !room.isOnline ? (
                  <TextInput
                    style={[
                      styles.nameInput,
                      {
                        color: theme.colors.text,
                        borderBottomColor: theme.colors.primary,
                      }
                    ]}
                    value={player.name}
                    onChangeText={(text) => updateName(player.id, text)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                  />
                ) : (
                  <TouchableOpacity onPress={() => !room.isOnline && setEditingId(player.id)}>
                    <Text style={[styles.playerName, { color: theme.colors.text }]}>{player.name}</Text>
                  </TouchableOpacity>
                )}
                {!room.isOnline && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePlayer(player.id)}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.scoreContainer}>
                <TouchableOpacity
                  style={styles.scoreButton}
                  onPress={() => updateScore(player.id, -1)}
                >
                  <Text style={styles.scoreButtonText}>−</Text>
                </TouchableOpacity>

                <View style={styles.scoreDisplay}>
                  <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>Score</Text>
                  {editingScoreId === player.id ? (
                    <TextInput
                      style={[
                        styles.scoreInput,
                        {
                          color: theme.colors.primary,
                          borderBottomColor: theme.colors.primary,
                        }
                      ]}
                      value={scoreInput}
                      onChangeText={setScoreInput}
                      onBlur={() => saveScore(player.id)}
                      keyboardType="numeric"
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity onPress={() => startEditScore(player.id, player.score)}>
                      <Text style={[styles.scoreNumber, { color: theme.colors.primary }]}>{player.score}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.scoreButton}
                  onPress={() => updateScore(player.id, 1)}
                >
                  <Text style={styles.scoreButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.quickButtonsRow}>
                <TouchableOpacity
                  style={[styles.quickButton, styles.decrementButton]}
                  onPress={() => updateScore(player.id, -10)}
                >
                  <Text style={styles.quickButtonText}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickButton, styles.decrementButton]}
                  onPress={() => updateScore(player.id, -5)}
                >
                  <Text style={styles.quickButtonText}>-5</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickButton, styles.incrementButton]}
                  onPress={() => updateScore(player.id, 5)}
                >
                  <Text style={styles.quickButtonText}>+5</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickButton, styles.incrementButton]}
                  onPress={() => updateScore(player.id, 10)}
                >
                  <Text style={styles.quickButtonText}>+10</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {!room.isOnline && (
            <TouchableOpacity style={styles.addButton} onPress={addPlayer}>
              <Text style={styles.addButtonText}>+ Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.infoSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>How to Use</Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
            • Tap player names to edit them{'\n'}
            • Tap the score number to type a new value{'\n'}
            • Use +/- buttons to adjust scores{'\n'}
            • Quick buttons: +5, +10, -5, -10{'\n'}
            • Add more players as needed{'\n'}
            • Scores auto-save for 30 minutes
          </Text>
        </View>
      </ScrollView>

      <RoomLobby
        visible={showRoomLobby}
        onClose={() => setShowRoomLobby(false)}
        room={room}
        gameType="Counter"
      />
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
  header: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  onlineButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  playersSection: {
    marginBottom: 30,
  },
  playerCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  playerName: {
    fontSize: 20,
    fontWeight: '600',
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    borderBottomWidth: 2,
    minWidth: 150,
    padding: 0,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  scoreButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  scoreDisplay: {
    alignItems: 'center',
    flex: 1,
  },
  scoreLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreInput: {
    fontSize: 48,
    fontWeight: 'bold',
    borderBottomWidth: 2,
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
  },
  quickButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  incrementButton: {
    backgroundColor: '#34C759',
  },
  decrementButton: {
    backgroundColor: '#FF3B30',
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoSection: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
  },
});
