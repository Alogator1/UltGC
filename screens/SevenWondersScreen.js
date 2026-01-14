import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sevenWondersGameData';
const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22'];

export default function SevenWondersScreen() {
  const [players, setPlayers] = useState([
    {
      id: 1,
      name: 'Player 1',
      color: PLAYER_COLORS[0],
      military: 0,
      treasury: 0,
      wonder: 0,
      civilian: 0,
      science: { compass: 0, gear: 0, tablet: 0 },
      commerce: 0,
      guilds: 0
    }
  ]);
  const [editingId, setEditingId] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveData();
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

  const calculateSciencePoints = (science) => {
    const { compass, gear, tablet } = science;
    const identicalPoints = (compass * compass) + (gear * gear) + (tablet * tablet);
    const sets = Math.min(compass, gear, tablet);
    const setPoints = sets * 7;
    return identicalPoints + setPoints;
  };

  const calculateTotalScore = (player) => {
    const sciencePoints = calculateSciencePoints(player.science);
    const treasuryPoints = Math.floor(player.treasury / 3);
    return player.military + treasuryPoints + player.wonder + player.civilian +
           sciencePoints + player.commerce + player.guilds;
  };

  const calculateScores = () => {
    const scores = players.map(player => ({
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
      total: calculateTotalScore(player)
    }));

    scores.sort((a, b) => b.total - a.total);
    setResults(scores);
  };

  const addPlayer = () => {
    if (players.length >= 7) {
      Alert.alert('Max Players', '7 Wonders supports up to 7 players.');
      return;
    }
    const newId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 1;
    setPlayers([...players, {
      id: newId,
      name: `Player ${newId}`,
      color: PLAYER_COLORS[players.length % PLAYER_COLORS.length],
      military: 0,
      treasury: 0,
      wonder: 0,
      civilian: 0,
      science: { compass: 0, gear: 0, tablet: 0 },
      commerce: 0,
      guilds: 0
    }]);
  };

  const removePlayer = (id) => {
    if (players.length > 1) {
      setPlayers(players.filter(p => p.id !== id));
    } else {
      Alert.alert('Cannot Remove', 'You must have at least one player.');
    }
  };

  const updateScore = (id, field, value) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, [field]: Math.max(0, parseInt(value) || 0) } : p
    ));
  };

  const adjustScore = (id, category, amount) => {
    setPlayers(players.map(p => {
      if (p.id === id) {
        const currentValue = p[category];
        return { ...p, [category]: Math.max(0, currentValue + amount) };
      }
      return p;
    }));
  };

  const updateScience = (id, type, value) => {
    setPlayers(players.map(p =>
      p.id === id ? {
        ...p,
        science: { ...p.science, [type]: Math.max(0, parseInt(value) || 0) }
      } : p
    ));
  };

  const adjustScience = (id, type, amount) => {
    setPlayers(players.map(p =>
      p.id === id ? {
        ...p,
        science: { ...p.science, [type]: Math.max(0, p.science[type] + amount) }
      } : p
    ));
  };

  const updatePlayerName = (id, name) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, name } : p
    ));
  };

  const resetGame = () => {
    Alert.alert(
      'Reset Game',
      'Are you sure you want to reset all scores?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setPlayers(players.map(p => ({
              ...p,
              military: 0,
              treasury: 0,
              wonder: 0,
              civilian: 0,
              science: { compass: 0, gear: 0, tablet: 0 },
              commerce: 0,
              guilds: 0
            })));
            setResults(null);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>🏛️ 7 Wonders Scorer</Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
            <Text style={styles.resetButtonText}>Reset Game</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.playersSection}>
          {players.map((player) => (
            <View key={player.id} style={[styles.playerCard, { borderLeftColor: player.color, borderLeftWidth: 6 }]}>
              <View style={styles.playerHeader}>
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
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removePlayer(player.id)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>⚔️ Military</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'military', -1)}
                  >
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.scoreInput}
                    value={player.military.toString()}
                    onChangeText={(text) => updateScore(player.id, 'military', text)}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'military', 1)}
                  >
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>💰 Treasury (÷3)</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'treasury', -1)}
                  >
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.scoreInput}
                    value={player.treasury.toString()}
                    onChangeText={(text) => updateScore(player.id, 'treasury', text)}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'treasury', 1)}
                  >
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>🏗️ Wonder</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'wonder', -1)}
                  >
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.scoreInput}
                    value={player.wonder.toString()}
                    onChangeText={(text) => updateScore(player.id, 'wonder', text)}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'wonder', 1)}
                  >
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>🏘️ Civilian</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'civilian', -1)}
                  >
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.scoreInput}
                    value={player.civilian.toString()}
                    onChangeText={(text) => updateScore(player.id, 'civilian', text)}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'civilian', 1)}
                  >
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.scienceSection}>
                <Text style={styles.scienceTitle}>🔬 Science</Text>
                <View style={styles.scienceRow}>
                  <View style={styles.scienceItem}>
                    <Text style={styles.scienceLabel}>🧭 Compass</Text>
                    <View style={styles.scienceControls}>
                      <TouchableOpacity
                        style={styles.scienceButton}
                        onPress={() => adjustScience(player.id, 'compass', -1)}
                      >
                        <Text style={styles.scienceButtonText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.scienceInput}
                        value={player.science.compass.toString()}
                        onChangeText={(text) => updateScience(player.id, 'compass', text)}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.scienceButton}
                        onPress={() => adjustScience(player.id, 'compass', 1)}
                      >
                        <Text style={styles.scienceButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.scienceItem}>
                    <Text style={styles.scienceLabel}>⚙️ Gear</Text>
                    <View style={styles.scienceControls}>
                      <TouchableOpacity
                        style={styles.scienceButton}
                        onPress={() => adjustScience(player.id, 'gear', -1)}
                      >
                        <Text style={styles.scienceButtonText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.scienceInput}
                        value={player.science.gear.toString()}
                        onChangeText={(text) => updateScience(player.id, 'gear', text)}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.scienceButton}
                        onPress={() => adjustScience(player.id, 'gear', 1)}
                      >
                        <Text style={styles.scienceButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.scienceItem}>
                    <Text style={styles.scienceLabel}>📜 Tablet</Text>
                    <View style={styles.scienceControls}>
                      <TouchableOpacity
                        style={styles.scienceButton}
                        onPress={() => adjustScience(player.id, 'tablet', -1)}
                      >
                        <Text style={styles.scienceButtonText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.scienceInput}
                        value={player.science.tablet.toString()}
                        onChangeText={(text) => updateScience(player.id, 'tablet', text)}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.scienceButton}
                        onPress={() => adjustScience(player.id, 'tablet', 1)}
                      >
                        <Text style={styles.scienceButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>🏪 Commerce</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'commerce', -1)}
                  >
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.scoreInput}
                    value={player.commerce.toString()}
                    onChangeText={(text) => updateScore(player.id, 'commerce', text)}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'commerce', 1)}
                  >
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>👥 Guilds</Text>
                <View style={styles.scoreControls}>
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'guilds', -1)}
                  >
                    <Text style={styles.adjustButtonText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.scoreInput}
                    value={player.guilds.toString()}
                    onChangeText={(text) => updateScore(player.id, 'guilds', text)}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.adjustButton}
                    onPress={() => adjustScore(player.id, 'guilds', 1)}
                  >
                    <Text style={styles.adjustButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addPlayer}>
            <Text style={styles.addButtonText}>+ Add Player</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.calculateButton} onPress={calculateScores}>
          <Text style={styles.calculateButtonText}>🏆 Calculate Final Scores</Text>
        </TouchableOpacity>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>📖 Scoring Guide</Text>
          <Text style={styles.text}>
            • ⚔️ Military: Points from conflicts{'\n'}
            • 💰 Treasury: 1 point per 3 coins{'\n'}
            • 🏗️ Wonder: Points from stages{'\n'}
            • 🏘️ Civilian: Blue card points{'\n'}
            • 🔬 Science: n² per symbol + 7 per set{'\n'}
            • 🏪 Commerce: Yellow card points{'\n'}
            • 👥 Guilds: Purple card points{'\n'}
            • ✏️ Tap player names to edit
          </Text>
        </View>
      </ScrollView>

      <Modal visible={results !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.resultsTitle}>🏆 Final Scores</Text>
            <ScrollView style={styles.resultsScroll}>
              {results?.map((result, index) => (
                <View key={result.player.id} style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultRank}>#{index + 1}</Text>
                    <Text style={styles.resultName}>{result.player.name}</Text>
                    <Text style={styles.resultTotal}>{result.total}</Text>
                  </View>
                  <View style={styles.breakdown}>
                    <Text style={styles.breakdownText}>Military: {result.breakdown.military}</Text>
                    <Text style={styles.breakdownText}>Treasury: {result.breakdown.treasury}</Text>
                    <Text style={styles.breakdownText}>Wonder: {result.breakdown.wonder}</Text>
                    <Text style={styles.breakdownText}>Civilian: {result.breakdown.civilian}</Text>
                    <Text style={styles.breakdownText}>Science: {result.breakdown.science}</Text>
                    <Text style={styles.breakdownText}>Commerce: {result.breakdown.commerce}</Text>
                    <Text style={styles.breakdownText}>Guilds: {result.breakdown.guilds}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setResults(null)}
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
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    fontWeight: '500',
  },
  scoreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreInput: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
    width: 50,
    textAlign: 'center',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  scienceSection: {
    backgroundColor: '#E8F4FF',
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
  },
  scienceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  scienceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scienceItem: {
    alignItems: 'center',
  },
  scienceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  scienceControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scienceButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scienceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scienceInput: {
    backgroundColor: '#fff',
    padding: 5,
    borderRadius: 5,
    width: 36,
    textAlign: 'center',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ddd',
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
  calculateButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  resultsScroll: {
    maxHeight: 400,
  },
  resultCard: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  resultName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 10,
    color: '#333',
  },
  resultTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
  },
  breakdown: {
    paddingLeft: 10,
  },
  breakdownText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
  },
  closeButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
});
