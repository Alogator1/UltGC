import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';

const DICE_TYPES = [2, 3, 4, 6, 8, 10, 12, 20, 100];

export default function DiceRollerScreen() {
  const { theme } = useTheme();
  const [players, setPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], dice: [], rolls: [] },
  ]);
  const [nextId, setNextId] = useState(2);
  const [editingId, setEditingId] = useState(null);
  const [animatingPlayers, setAnimatingPlayers] = useState(new Set());

  // Load saved data on mount
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('diceRollerGameData');
        if (savedData) {
          const data = JSON.parse(savedData);
          // Ensure all players have dice array for backwards compatibility
          const playersWithDefaults = (data.players || players).map(p => ({
            ...p,
            dice: p.dice || [],
            rolls: p.rolls || []
          }));
          setPlayers(playersWithDefaults);
          setNextId(data.nextId || nextId);
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
          players,
          nextId,
        };
        await AsyncStorage.setItem('diceRollerGameData', JSON.stringify(dataToSave));
      } catch (error) {
        console.error('Error saving game data:', error);
      }
    };
    saveGameData();
  }, [players, nextId]);

  const addPlayer = () => {
    setPlayers([...players, { id: nextId, name: `Player ${nextId}`, dice: [], rolls: [] }]);
    setNextId(nextId + 1);
  };

  const removePlayer = (id) => {
    if (players.length === 1) {
      Alert.alert('Cannot Remove', 'At least one player must remain.');
      return;
    }
    setPlayers(players.filter(player => player.id !== id));
  };

  const updatePlayerName = (id, name) => {
    setPlayers(players.map(player =>
      player.id === id ? { ...player, name } : player
    ));
  };

  const addDiceToPlayer = (playerId, diceType) => {
    setPlayers(players.map(player =>
      player.id === playerId
        ? { ...player, dice: [...player.dice, { id: Date.now() + Math.random(), type: diceType }] }
        : player
    ));
  };

  const removeDiceFromPlayer = (playerId, diceId) => {
    setPlayers(players.map(player =>
      player.id === playerId
        ? { ...player, dice: player.dice.filter(d => d.id !== diceId) }
        : player
    ));
  };

  const rollSingleDice = (sides) => {
    return Math.floor(Math.random() * sides) + 1;
  };

  const rollAllDiceForPlayer = (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player || player.dice.length === 0) {
      Alert.alert('No Dice', 'Add some dice first before rolling!');
      return;
    }

    // Start animation
    setAnimatingPlayers(prev => new Set(prev).add(playerId));

    // Simulate rolling animation with random numbers
    let animationCount = 0;
    const animationInterval = setInterval(() => {
      animationCount++;
      if (animationCount >= 10) {
        clearInterval(animationInterval);

        // Final roll with actual results
        const results = player.dice.map(dice => ({
          diceId: dice.id,
          type: dice.type,
          result: rollSingleDice(dice.type),
        }));

        const total = results.reduce((sum, r) => sum + r.result, 0);

        const rollData = {
          id: Date.now() + Math.random(),
          timestamp: new Date().toLocaleTimeString(),
          results,
          total,
        };

        setPlayers(players.map(player =>
          player.id === playerId
            ? { ...player, rolls: [rollData, ...player.rolls].slice(0, 10) }
            : player
        ));

        // End animation
        setAnimatingPlayers(prev => {
          const newSet = new Set(prev);
          newSet.delete(playerId);
          return newSet;
        });
      }
    }, 50);
  };

  const clearPlayerDice = (playerId) => {
    setPlayers(players.map(player =>
      player.id === playerId ? { ...player, dice: [] } : player
    ));
  };

  const clearPlayerRolls = (playerId) => {
    setPlayers(players.map(player =>
      player.id === playerId ? { ...player, rolls: [] } : player
    ));
  };

  const clearAllRolls = () => {
    Alert.alert(
      'Clear All Rolls',
      'Are you sure you want to clear all roll history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => setPlayers(players.map(player => ({ ...player, rolls: [] })))
        },
      ]
    );
  };

  const rollAllPlayers = () => {
    const playersWithDice = players.filter(p => p.dice.length > 0);

    if (playersWithDice.length === 0) {
      Alert.alert('No Dice', 'Add dice to at least one player before rolling!');
      return;
    }

    // Start animation for all players
    playersWithDice.forEach(player => {
      setAnimatingPlayers(prev => new Set(prev).add(player.id));
    });

    // Simulate rolling animation
    let animationCount = 0;
    const animationInterval = setInterval(() => {
      animationCount++;
      if (animationCount >= 10) {
        clearInterval(animationInterval);

        // Final roll with actual results
        const updatedPlayers = players.map(player => {
          if (player.dice.length === 0) return player;

          const results = player.dice.map(dice => ({
            diceId: dice.id,
            type: dice.type,
            result: rollSingleDice(dice.type),
          }));

          const total = results.reduce((sum, r) => sum + r.result, 0);

          const rollData = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toLocaleTimeString(),
            results,
            total,
          };

          return {
            ...player,
            rolls: [rollData, ...player.rolls].slice(0, 10)
          };
        });

        setPlayers(updatedPlayers);

        // End animation for all players
        setAnimatingPlayers(new Set());
      }
    }, 50);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.primary }]}>Dice Roller</Text>
          <TouchableOpacity
            style={[styles.clearAllButton, { backgroundColor: theme.colors.danger }]}
            onPress={clearAllRolls}
          >
            <Text style={styles.clearAllButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        {/* Roll All Players Button */}
        <TouchableOpacity
          style={[styles.rollAllPlayersButton, { backgroundColor: theme.colors.success }]}
          onPress={rollAllPlayers}
        >
          <Text style={styles.rollAllPlayersButtonText}>🎲 Roll All Players</Text>
        </TouchableOpacity>

        {/* Players */}
        {players.map((player) => (
          <View
            key={player.id}
            style={[
              styles.playerCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
            ]}
          >
            <View style={styles.playerHeader}>
              {editingId === player.id ? (
                <TextInput
                  style={[
                    styles.playerNameInput,
                    { color: theme.colors.text, borderBottomColor: theme.colors.primary }
                  ]}
                  value={player.name}
                  onChangeText={(text) => updatePlayerName(player.id, text)}
                  onBlur={() => setEditingId(null)}
                  autoFocus
                />
              ) : (
                <TouchableOpacity onPress={() => setEditingId(player.id)}>
                  <Text style={[styles.playerName, { color: theme.colors.text }]}>
                    {player.name}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: theme.colors.danger }]}
                onPress={() => removePlayer(player.id)}
              >
                <Text style={styles.deleteButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Player's Dice */}
            <View style={styles.diceSection}>
              {player.dice.length > 0 ? (
                <>
                  <View style={styles.diceSectionHeader}>
                    <Text style={[styles.diceSectionTitle, { color: theme.colors.primary }]}>
                      Selected Dice ({player.dice.length}):
                    </Text>
                    <TouchableOpacity
                      style={[styles.clearDiceButton, { backgroundColor: theme.colors.danger }]}
                      onPress={() => clearPlayerDice(player.id)}
                    >
                      <Text style={styles.clearDiceButtonText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  <View
                    style={[
                      styles.playerDiceList,
                      { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }
                    ]}
                  >
                    {player.dice.map((dice) => (
                      <View
                        key={dice.id}
                        style={[styles.diceChip, { backgroundColor: theme.colors.primary }]}
                      >
                        <Text style={styles.diceChipText}>d{dice.type}</Text>
                        <TouchableOpacity
                          style={styles.removeDiceButton}
                          onPress={() => removeDiceFromPlayer(player.id, dice.id)}
                        >
                          <Text style={styles.removeDiceText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={[styles.noDiceText, { color: theme.colors.textSecondary }]}>
                  Tap dice below to add
                </Text>
              )}

              <View style={styles.diceGrid}>
                {DICE_TYPES.map(dice => (
                  <TouchableOpacity
                    key={dice}
                    style={[
                      styles.diceButton,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
                    ]}
                    onPress={() => addDiceToPlayer(player.id, dice)}
                  >
                    <Text style={[styles.diceButtonText, { color: theme.colors.primary }]}>d{dice}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Roll Button */}
            <TouchableOpacity
              style={[
                styles.rollButton,
                {
                  backgroundColor:
                    player.dice.length === 0 ? theme.colors.border : theme.colors.primary
                }
              ]}
              onPress={() => rollAllDiceForPlayer(player.id)}
              disabled={player.dice.length === 0}
            >
              <Text style={styles.rollButtonText}>
                🎲 Roll All Dice ({player.dice.length})
              </Text>
            </TouchableOpacity>

            {/* Roll History */}
            {player.rolls.length > 0 && (
              <View style={[styles.rollHistory, { borderTopColor: theme.colors.border }]}>
                <View style={styles.rollHistoryHeader}>
                  <Text style={[styles.rollHistoryTitle, { color: theme.colors.textSecondary }]}>Recent Rolls:</Text>
                  <TouchableOpacity
                    style={[styles.clearHistoryButton, { backgroundColor: theme.colors.danger }]}
                    onPress={() => clearPlayerRolls(player.id)}
                  >
                    <Text style={styles.clearHistoryButtonText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.rollHistoryScroll}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                >
                  {player.rolls.map((roll) => (
                    <View
                      key={roll.id}
                      style={[styles.rollItem, { backgroundColor: theme.colors.card }]}
                    >
                      <Text style={[styles.rollTime, { color: theme.colors.textSecondary }]}>
                        {roll.timestamp}
                      </Text>
                      <View style={styles.rollResults}>
                        <View style={styles.diceResults}>
                          {roll.results.map((result, index) => (
                            <View
                              key={index}
                              style={[
                                styles.diceResultItem,
                                {
                                  backgroundColor: theme.colors.surface,
                                  borderColor: theme.colors.primary
                                }
                              ]}
                            >
                              <Text style={[styles.diceResultType, { color: theme.colors.primary }]}>d{result.type}</Text>
                              <Text style={[styles.diceResultValue, { color: theme.colors.text }]}>
                                {result.result}
                              </Text>
                            </View>
                          ))}
                        </View>
                        <Text style={[styles.rollTotal, { color: theme.colors.success }]}>= {roll.total}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.addPlayerButton, { backgroundColor: theme.colors.primary }]}
          onPress={addPlayer}
        >
          <Text style={styles.addPlayerButtonText}>+ Add Player</Text>
        </TouchableOpacity>

        <View
          style={[
            styles.infoSection,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>How to Use</Text>
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            • Each player can build their own dice set{'\n'}
            • Tap dice types (d2-d100) to add them{'\n'}
            • Selected dice shown in highlighted box{'\n'}
            • Use "Roll All Players" to roll everyone at once{'\n'}
            • Or roll individual players separately{'\n'}
            • Remove dice by tapping × on the chip{'\n'}
            • View roll history (last 10 rolls)
          </Text>
        </View>
      </ScrollView>
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
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  clearAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearAllButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rollAllPlayersButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  rollAllPlayersButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playerCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerName: {
    fontSize: 22,
    fontWeight: '600',
  },
  playerNameInput: {
    fontSize: 22,
    fontWeight: '600',
    borderBottomWidth: 2,
    padding: 4,
    minWidth: 150,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  diceSection: {
    marginBottom: -30,
    marginTop: 10
  },
  diceSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  diceSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  clearDiceButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearDiceButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  playerDiceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
  },
  diceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 3,
    gap: 5,
  },
  diceChipText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  removeDiceButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeDiceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  noDiceText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  diceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  diceButton: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  diceButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  rollButton: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  rollButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rollHistory: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  rollHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rollHistoryScroll: {
    maxHeight: 250,
  },
  rollHistoryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearHistoryButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearHistoryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  rollItem: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  rollTime: {
    fontSize: 12,
    marginBottom: 6,
  },
  rollResults: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diceResults: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  diceResultItem: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  diceResultType: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  diceResultValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rollTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  addPlayerButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addPlayerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoSection: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
});

