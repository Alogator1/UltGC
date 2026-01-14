import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'catanGameData';
const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'];

export default function CatanScreen() {
  const [players, setPlayers] = useState([
    { id: 1, name: 'Player 1', color: PLAYER_COLORS[0], settlements: 0, cities: 0, devCards: 0, hasLongestRoad: false, hasLargestArmy: false }
  ]);
  const [editingId, setEditingId] = useState(null);
  const [diceRoll, setDiceRoll] = useState({ dice1: 1, dice2: 1, total: 2 });
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveData();
    checkForWinner();
  }, [players]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const { players: savedPlayers } = JSON.parse(savedData);
        setPlayers(savedPlayers);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ players }));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const calculateVictoryPoints = (player) => {
    const settlementPoints = player.settlements * 1;
    const cityPoints = player.cities * 2;
    const devCardPoints = player.devCards * 1;
    const longestRoadPoints = player.hasLongestRoad ? 2 : 0;
    const largestArmyPoints = player.hasLargestArmy ? 2 : 0;
    return settlementPoints + cityPoints + devCardPoints + longestRoadPoints + largestArmyPoints;
  };

  const checkForWinner = () => {
    const winningPlayer = players.find(p => calculateVictoryPoints(p) >= 10);
    if (winningPlayer) {
      setWinner(winningPlayer);
    }
  };

  const addPlayer = () => {
    if (players.length >= 6) {
      Alert.alert('Max Players', 'Catan supports up to 6 players.');
      return;
    }
    const newId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 1;
    setPlayers([...players, {
      id: newId,
      name: `Player ${newId}`,
      color: PLAYER_COLORS[players.length % PLAYER_COLORS.length],
      settlements: 0,
      cities: 0,
      devCards: 0,
      hasLongestRoad: false,
      hasLargestArmy: false
    }]);
  };

  const removePlayer = (id) => {
    if (players.length > 1) {
      setPlayers(players.filter(p => p.id !== id));
    } else {
      Alert.alert('Cannot Remove', 'You must have at least one player.');
    }
  };

  const adjustValue = (id, field, amount) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, [field]: Math.max(0, p[field] + amount) } : p
    ));
  };

  const updatePlayerName = (id, name) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, name } : p
    ));
  };

  const toggleLongestRoad = (id) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, hasLongestRoad: !p.hasLongestRoad } : { ...p, hasLongestRoad: false }
    ));
  };

  const toggleLargestArmy = (id) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, hasLargestArmy: !p.hasLargestArmy } : { ...p, hasLargestArmy: false }
    ));
  };

  const rollDice = () => {
    setIsRolling(true);
    let iterations = 0;
    const maxIterations = 10;

    const interval = setInterval(() => {
      const tempDice1 = Math.floor(Math.random() * 6) + 1;
      const tempDice2 = Math.floor(Math.random() * 6) + 1;
      setDiceRoll({ dice1: tempDice1, dice2: tempDice2, total: tempDice1 + tempDice2 });

      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(interval);
        setIsRolling(false);
        const finalDice1 = Math.floor(Math.random() * 6) + 1;
        const finalDice2 = Math.floor(Math.random() * 6) + 1;
        setDiceRoll({ dice1: finalDice1, dice2: finalDice2, total: finalDice1 + finalDice2 });
      }
    }, 100);
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
            setPlayers(players.map(p => ({
              ...p,
              settlements: 0,
              cities: 0,
              devCards: 0,
              hasLongestRoad: false,
              hasLargestArmy: false
            })));
            setWinner(null);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>🏝️ Catan Tracker</Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
            <Text style={styles.resetButtonText}>Reset Game</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.diceButton, isRolling && styles.diceButtonRolling]}
          onPress={rollDice}
          disabled={isRolling}
        >
          <View style={styles.diceRow}>
            <View style={styles.dice}>
              <Text style={styles.diceText}>{diceRoll.dice1}</Text>
            </View>
            <View style={styles.dice}>
              <Text style={styles.diceText}>{diceRoll.dice2}</Text>
            </View>
          </View>
          <Text style={styles.totalText}>🎲 Total: {diceRoll.total}</Text>
        </TouchableOpacity>

        <View style={styles.playersSection}>
          {players.map((player) => {
            const vp = calculateVictoryPoints(player);
            return (
              <View key={player.id} style={[styles.playerCard, { borderLeftColor: player.color, borderLeftWidth: 6 }]}>
                <View style={styles.playerHeader}>
                  <View style={styles.playerInfo}>
                    {editingId === player.id ? (
                      <TextInput
                        style={styles.nameInput}
                        value={player.name}
                        onChangeText={(text) => updatePlayerName(player.id, text)}
                        onBlur={() => setEditingId(null)}
                        autoFocus
                      />
                    ) : (
                      <TouchableOpacity onPress={() => setEditingId(player.id)}>
                        <Text style={styles.playerName}>{player.name}</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={styles.victoryPoints}>{vp} VP</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePlayer(player.id)}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.statsColumn}>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>🏠 Settlements</Text>
                    <View style={styles.statControls}>
                      <TouchableOpacity
                        style={styles.statButton}
                        onPress={() => adjustValue(player.id, 'settlements', -1)}
                      >
                        <Text style={styles.statButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.statValue}>{player.settlements}</Text>
                      <TouchableOpacity
                        style={styles.statButton}
                        onPress={() => adjustValue(player.id, 'settlements', 1)}
                      >
                        <Text style={styles.statButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>🏰 Cities</Text>
                    <View style={styles.statControls}>
                      <TouchableOpacity
                        style={styles.statButton}
                        onPress={() => adjustValue(player.id, 'cities', -1)}
                      >
                        <Text style={styles.statButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.statValue}>{player.cities}</Text>
                      <TouchableOpacity
                        style={styles.statButton}
                        onPress={() => adjustValue(player.id, 'cities', 1)}
                      >
                        <Text style={styles.statButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>🃏 VP Cards</Text>
                    <View style={styles.statControls}>
                      <TouchableOpacity
                        style={styles.statButton}
                        onPress={() => adjustValue(player.id, 'devCards', -1)}
                      >
                        <Text style={styles.statButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.statValue}>{player.devCards}</Text>
                      <TouchableOpacity
                        style={styles.statButton}
                        onPress={() => adjustValue(player.id, 'devCards', 1)}
                      >
                        <Text style={styles.statButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.bonusRow}>
                  <TouchableOpacity
                    style={[styles.bonusButton, player.hasLongestRoad && styles.bonusButtonActive]}
                    onPress={() => toggleLongestRoad(player.id)}
                  >
                    <Text style={[styles.bonusButtonText, player.hasLongestRoad && styles.bonusButtonTextActive]}>
                      🛤️ Longest Road {player.hasLongestRoad ? '(+2)' : ''}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bonusButton, player.hasLargestArmy && styles.bonusButtonActive]}
                    onPress={() => toggleLargestArmy(player.id)}
                  >
                    <Text style={[styles.bonusButtonText, player.hasLargestArmy && styles.bonusButtonTextActive]}>
                      ⚔️ Largest Army {player.hasLargestArmy ? '(+2)' : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addButton} onPress={addPlayer}>
            <Text style={styles.addButtonText}>+ Add Player</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>📖 Victory Points</Text>
          <Text style={styles.text}>
            • 🏠 Settlement: 1 VP each{'\n'}
            • 🏰 City: 2 VP each{'\n'}
            • 🃏 VP Development Card: 1 VP each{'\n'}
            • 🛤️ Longest Road: 2 VP (5+ roads){'\n'}
            • ⚔️ Largest Army: 2 VP (3+ knights){'\n'}
            • 🏆 First to 10 VP wins!{'\n'}
            • ✏️ Tap player names to edit
          </Text>
        </View>
      </ScrollView>

      <Modal visible={winner !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.winnerEmoji}>🎉</Text>
            <Text style={styles.winnerTitle}>🏆 Winner!</Text>
            <Text style={styles.winnerName}>{winner?.name}</Text>
            <Text style={styles.winnerPoints}>{winner && calculateVictoryPoints(winner)} Victory Points</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setWinner(null)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  diceButton: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  diceButtonRolling: {
    backgroundColor: '#999',
  },
  diceRow: {
    flexDirection: 'row',
    gap: 20,
  },
  dice: {
    width: 60,
    height: 60,
    backgroundColor: '#fff',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  diceText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  playersSection: {
    marginBottom: 20,
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
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    marginBottom: 4,
    padding: 0,
  },
  victoryPoints: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
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
  statsColumn: {
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  statControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 24,
    textAlign: 'center',
  },
  bonusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bonusButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  bonusButtonActive: {
    backgroundColor: '#34C759',
    borderColor: '#2DA44E',
  },
  bonusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  bonusButtonTextActive: {
    color: '#fff',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  winnerEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  winnerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  winnerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  winnerPoints: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    minWidth: 120,
  },
  closeButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
});
