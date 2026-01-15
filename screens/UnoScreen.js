import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';

export default function UnoScreen() {
  const { theme } = useTheme();
  const [gameStarted, setGameStarted] = useState(false);
  const [winCondition, setWinCondition] = useState('lowest'); // 'lowest' or 'highest'
  const [targetScore, setTargetScore] = useState('500');
  const [players, setPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], totalScore: 0, roundScore: '' },
    { id: 2, name: DEFAULT_PLAYER_NAMES[1], totalScore: 0, roundScore: '' },
  ]);
  const [nextId, setNextId] = useState(3);
  const [currentRound, setCurrentRound] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const [winner, setWinner] = useState(null);

  // Load saved data on mount
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('unoGameData');
        if (savedData) {
          const data = JSON.parse(savedData);
          setGameStarted(data.gameStarted || false);
          setWinCondition(data.winCondition || 'lowest');
          setTargetScore(data.targetScore || '500');
          setPlayers(data.players || players);
          setNextId(data.nextId || nextId);
          setCurrentRound(data.currentRound || 1);
        }
      } catch (error) {
        console.error('Error loading game data:', error);
      }
    };
    loadGameData();
  }, []);

  // Save data whenever it changes
  useEffect(() => {
    const saveGameData = async () => {
      try {
        const dataToSave = {
          gameStarted,
          winCondition,
          targetScore,
          players,
          nextId,
          currentRound,
        };
        await AsyncStorage.setItem('unoGameData', JSON.stringify(dataToSave));
      } catch (error) {
        console.error('Error saving game data:', error);
      }
    };
    saveGameData();
  }, [gameStarted, winCondition, targetScore, players, nextId, currentRound]);

  const addPlayer = () => {
    setPlayers([...players, { id: nextId, name: `Player ${nextId}`, totalScore: 0, roundScore: '' }]);
    setNextId(nextId + 1);
  };

  const removePlayer = (id) => {
    if (players.length <= 2) {
      Alert.alert('Cannot Remove', 'You need at least 2 players!');
      return;
    }
    setPlayers(players.filter(p => p.id !== id));
  };

  const updatePlayerName = (id, name) => {
    setPlayers(players.map(p => p.id === id ? { ...p, name } : p));
  };

  const updateRoundScore = (id, score) => {
    setPlayers(players.map(p => p.id === id ? { ...p, roundScore: score } : p));
  };

  const startGame = () => {
    const target = parseInt(targetScore);
    if (isNaN(target) || target <= 0) {
      Alert.alert('Invalid Target', 'Please enter a valid target score');
      return;
    }
    setGameStarted(true);
  };

  const nextRound = () => {
    if (winCondition === 'highest') {
      // Find player(s) with 0 or empty score (winner of this round)
      const roundWinners = players.filter(p => {
        const score = parseInt(p.roundScore) || 0;
        return score === 0;
      });

      if (roundWinners.length === 0) {
        Alert.alert('No Winner', 'At least one player must have 0 points for this round (leave empty or enter 0)');
        return;
      }

      // If multiple players have 0, ask which one won
      if (roundWinners.length > 1) {
        const buttons = roundWinners.map(p => ({
          text: p.name,
          onPress: () => distributePointsToWinner(p.id)
        }));
        buttons.push({ text: 'Cancel', style: 'cancel' });

        Alert.alert(
          'Multiple Winners',
          'Multiple players have 0 points. Who won this round?',
          buttons
        );
        return;
      }

      // Single winner - distribute points
      distributePointsToWinner(roundWinners[0].id);
    } else {
      // Lowest score wins - just add round scores to total (treat empty as 0)
      const updatedPlayers = players.map(p => ({
        ...p,
        totalScore: p.totalScore + (parseInt(p.roundScore) || 0),
        roundScore: ''
      }));

      setPlayers(updatedPlayers);
      setCurrentRound(currentRound + 1);

      // Check for winner with updated scores
      setTimeout(() => checkForWinner(updatedPlayers), 0);
    }
  };

  const distributePointsToWinner = (winnerId) => {
    // Calculate total points from all other players
    const totalPoints = players.reduce((sum, p) => {
      if (p.id === winnerId) return sum;
      const score = parseInt(p.roundScore) || 0;
      return sum + score;
    }, 0);

    const updatedPlayers = players.map(p => ({
      ...p,
      totalScore: p.id === winnerId ? p.totalScore + totalPoints : p.totalScore,
      roundScore: ''
    }));

    setPlayers(updatedPlayers);
    setCurrentRound(currentRound + 1);

    // Check for winner with updated scores
    setTimeout(() => checkForWinner(updatedPlayers), 0);
  };

  const checkForWinner = (playersToCheck = players) => {
    const target = parseInt(targetScore);

    if (winCondition === 'lowest') {
      // Check if anyone reached or exceeded target (they lose, others win)
      const losers = playersToCheck.filter(p => p.totalScore >= target);
      if (losers.length > 0) {
        // Find player with lowest score
        const sortedPlayers = [...playersToCheck].sort((a, b) => a.totalScore - b.totalScore);
        setWinner(sortedPlayers[0]);
        setShowWinner(true);
      }
    } else {
      // Check if anyone reached target (they win)
      const winners = playersToCheck.filter(p => p.totalScore >= target);
      if (winners.length > 0) {
        // Find player with highest score
        const sortedPlayers = [...winners].sort((a, b) => b.totalScore - a.totalScore);
        setWinner(sortedPlayers[0]);
        setShowWinner(true);
      }
    }
  };

  const resetGame = () => {
    Alert.alert(
      'Reset Game',
      'Are you sure you want to reset the game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setGameStarted(false);
            setPlayers(players.map(p => ({ ...p, totalScore: 0, roundScore: '' })));
            setCurrentRound(1);
            setShowWinner(false);
            setWinner(null);
          }
        },
      ]
    );
  };

  if (!gameStarted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>UNO Score Tracker</Text>

          <View style={[styles.setupSection, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Game Setup</Text>

            <Text style={[styles.label, { color: theme.colors.text }]}>Win Condition:</Text>
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  winCondition === 'lowest' && [styles.optionButtonActive, { borderColor: '#DC143C', backgroundColor: theme.dark ? '#3d1f1f' : '#FFE8E8' }]
                ]}
                onPress={() => setWinCondition('lowest')}
              >
                <Text style={[styles.optionButtonText, { color: theme.colors.textSecondary }, winCondition === 'lowest' && styles.optionButtonTextActive]}>
                  Lowest Score Wins
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  winCondition === 'highest' && [styles.optionButtonActive, { borderColor: '#DC143C', backgroundColor: theme.dark ? '#3d1f1f' : '#FFE8E8' }]
                ]}
                onPress={() => setWinCondition('highest')}
              >
                <Text style={[styles.optionButtonText, { color: theme.colors.textSecondary }, winCondition === 'highest' && styles.optionButtonTextActive]}>
                  Highest Score Wins
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>Target Score:</Text>
            <TextInput
              style={[styles.targetInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={targetScore}
              onChangeText={setTargetScore}
              keyboardType="numeric"
              placeholder="Enter target score"
              placeholderTextColor={theme.colors.textTertiary}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Players:</Text>
            {players.map(player => (
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
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.colors.danger }]}
                  onPress={() => removePlayer(player.id)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={[styles.addPlayerButton, { backgroundColor: theme.colors.primary }]} onPress={addPlayer}>
              <Text style={styles.addPlayerButtonText}>+ Add Player</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.startButton} onPress={startGame}>
              <Text style={styles.startButtonText}>Start Game</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>UNO - Round {currentRound}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {winCondition === 'lowest' ? 'Lowest' : 'Highest'} score wins • Target: {targetScore}
            </Text>
          </View>
          <TouchableOpacity style={[styles.resetButton, { backgroundColor: theme.colors.danger }]} onPress={resetGame}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.tableContainer, { backgroundColor: theme.colors.card }]}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.nameColumn]}>Player</Text>
            <Text style={[styles.tableHeaderText, styles.scoreColumn]}>Total</Text>
            <Text style={[styles.tableHeaderText, styles.roundColumn]}>This Round</Text>
          </View>

          {players.map(player => (
            <View key={player.id} style={[styles.tableRow, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.tableCellText, styles.nameColumn, { color: theme.colors.text }]}>{player.name}</Text>
              <Text style={[styles.tableCellText, styles.scoreColumn, styles.totalScore]}>
                {player.totalScore}
              </Text>
              <TextInput
                style={[styles.roundInput, styles.roundColumn, { backgroundColor: theme.dark ? '#2C2C2E' : '#f0f0f0', borderColor: theme.colors.border, color: theme.colors.text }]}
                value={player.roundScore}
                onChangeText={(text) => updateRoundScore(player.id, text)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.colors.textTertiary}
              />
            </View>
          ))}
        </View>

        {winCondition === 'highest' && (
          <View style={[styles.infoBox, { backgroundColor: theme.dark ? '#1a2f3d' : '#E8F4FF' }]}>
            <Text style={[styles.infoText, { color: theme.dark ? '#5DADE2' : '#0066CC' }]}>
              ℹ️ Leave empty or enter 0 for the player who won this round. All other players' points will go to the winner. If multiple players have 0, you'll be asked who won.
            </Text>
          </View>
        )}

        {winCondition === 'lowest' && (
          <View style={[styles.infoBox, { backgroundColor: theme.dark ? '#1a2f3d' : '#E8F4FF' }]}>
            <Text style={[styles.infoText, { color: theme.dark ? '#5DADE2' : '#0066CC' }]}>
              ℹ️ Enter each player's score for this round. Empty cells are treated as 0.
            </Text>
          </View>
        )}

        <TouchableOpacity style={[styles.nextRoundButton, { backgroundColor: theme.colors.success }]} onPress={nextRound}>
          <Text style={styles.nextRoundButtonText}>Next Round</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Winner Modal */}
      <Modal
        visible={showWinner}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWinner(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.winnerModal, { backgroundColor: theme.colors.background }]}>
            <Text style={styles.winnerEmoji}>🎉</Text>
            <Text style={[styles.winnerTitle, { color: theme.colors.text }]}>Game Over!</Text>
            <Text style={styles.winnerName}>{winner?.name}</Text>
            <Text style={[styles.winnerMessage, { color: theme.colors.textSecondary }]}>wins with {winner?.totalScore} points!</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.newGameButton, { backgroundColor: theme.colors.success }]}
                onPress={() => {
                  setShowWinner(false);
                  resetGame();
                }}
              >
                <Text style={styles.newGameButtonText}>New Game</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowWinner(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  setupSection: {
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 15,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  optionButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  optionButtonActive: {
    borderColor: '#DC143C',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionButtonTextActive: {
    color: '#DC143C',
  },
  targetInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  playerSetupCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  playerSetupName: {
    fontSize: 16,
  },
  nameInput: {
    fontSize: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#DC143C',
    padding: 0,
    minWidth: 150,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  addPlayerButton: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  addPlayerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#DC143C',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tableContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#DC143C',
    padding: 12,
  },
  tableHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  nameColumn: {
    flex: 2,
  },
  scoreColumn: {
    flex: 1,
    textAlign: 'center',
  },
  roundColumn: {
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    padding: 12,
  },
  tableCellText: {
    fontSize: 16,
  },
  totalScore: {
    fontWeight: 'bold',
    color: '#DC143C',
  },
  roundInput: {
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
  },
  infoBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  nextRoundButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  nextRoundButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  winnerModal: {
    borderRadius: 20,
    padding: 30,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  winnerEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  winnerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  winnerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#DC143C',
    marginBottom: 8,
    textAlign: 'center',
  },
  winnerMessage: {
    fontSize: 20,
    marginBottom: 30,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  newGameButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  newGameButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

