import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'counterGameData';
const AUTO_SAVE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export default function CounterScreen() {
  const [players, setPlayers] = useState([
    { id: 1, name: 'Player 1', score: 0 },
    { id: 2, name: 'Player 2', score: 0 },
  ]);
  const [editingId, setEditingId] = useState(null);
  const [editingScoreId, setEditingScoreId] = useState(null);
  const [scoreInput, setScoreInput] = useState('');
  const [lastSaveTime, setLastSaveTime] = useState(Date.now());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveData();
    }, 1000);
    return () => clearTimeout(timer);
  }, [players]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const { players: savedPlayers, timestamp } = JSON.parse(savedData);
        const timeDiff = Date.now() - timestamp;
        if (timeDiff < AUTO_SAVE_TIMEOUT) {
          setPlayers(savedPlayers);
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
        players,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      setLastSaveTime(Date.now());
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const addPlayer = () => {
    const newId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 1;
    setPlayers([...players, { id: newId, name: `Player ${newId}`, score: 0 }]);
  };

  const removePlayer = (id) => {
    if (players.length > 1) {
      setPlayers(players.filter(p => p.id !== id));
    } else {
      Alert.alert('Cannot Remove', 'You must have at least one player.');
    }
  };

  const updateScore = (id, delta) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, score: p.score + delta } : p
    ));
  };

  const updateName = (id, name) => {
    setPlayers(players.map(p =>
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
      setPlayers(players.map(p =>
        p.id === id ? { ...p, score: newScore } : p
      ));
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
          onPress: () => setPlayers(players.map(p => ({ ...p, score: 0 }))),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Score Counter</Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetScores}>
            <Text style={styles.resetButtonText}>Reset Scores</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.playersSection}>
          {players.map((player) => (
            <View key={player.id} style={styles.playerCard}>
              <View style={styles.playerHeader}>
                {editingId === player.id ? (
                  <TextInput
                    style={styles.nameInput}
                    value={player.name}
                    onChangeText={(text) => updateName(player.id, text)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                  />
                ) : (
                  <TouchableOpacity onPress={() => setEditingId(player.id)}>
                    <Text style={styles.playerName}>{player.name}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removePlayer(player.id)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.scoreContainer}>
                <TouchableOpacity
                  style={styles.scoreButton}
                  onPress={() => updateScore(player.id, -1)}
                >
                  <Text style={styles.scoreButtonText}>−</Text>
                </TouchableOpacity>

                <View style={styles.scoreDisplay}>
                  <Text style={styles.scoreLabel}>Score</Text>
                  {editingScoreId === player.id ? (
                    <TextInput
                      style={styles.scoreInput}
                      value={scoreInput}
                      onChangeText={setScoreInput}
                      onBlur={() => saveScore(player.id)}
                      keyboardType="numeric"
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity onPress={() => startEditScore(player.id, player.score)}>
                      <Text style={styles.scoreNumber}>{player.score}</Text>
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

          <TouchableOpacity style={styles.addButton} onPress={addPlayer}>
            <Text style={styles.addButtonText}>+ Add Player</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>How to Use</Text>
          <Text style={styles.text}>
            • Tap player names to edit them{'\n'}
            • Tap the score number to type a new value{'\n'}
            • Use +/- buttons to adjust scores{'\n'}
            • Quick buttons: +5, +10, -5, -10{'\n'}
            • Add more players as needed{'\n'}
            • Scores auto-save for 30 minutes
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
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
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    color: '#333',
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
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
    color: '#666',
    marginBottom: 5,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  scoreInput: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
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
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
  },
});
