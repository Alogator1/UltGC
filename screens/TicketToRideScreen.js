import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, Animated, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAYER_COLORS = [
  { name: 'Blue', color: '#0066CC' },
  { name: 'Red', color: '#DC143C' },
  { name: 'Green', color: '#228B22' },
  { name: 'Yellow', color: '#FFD700' },
  { name: 'Black', color: '#333333' },
];

const ROUTE_POINTS = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 10,
  6: 15,
  7: 18,
  8: 21,
};

export default function TicketToRideScreen() {
  const [players, setPlayers] = useState([
    { id: 1, name: 'Player 1', color: PLAYER_COLORS[0], score: 0 },
    { id: 2, name: 'Player 2', color: PLAYER_COLORS[1], score: 0 },
    { id: 3, name: 'Player 3', color: PLAYER_COLORS[2], score: 0 },
    { id: 4, name: 'Player 4', color: PLAYER_COLORS[3], score: 0 },
    { id: 5, name: 'Player 5', color: PLAYER_COLORS[4], score: 0 },

  ]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [showUndo, setShowUndo] = useState(false);
  const [showFinishGame, setShowFinishGame] = useState(false);
  const [showWinners, setShowWinners] = useState(false);
  const [longestRouteBonus, setLongestRouteBonus] = useState(10);
  const [customInputs, setCustomInputs] = useState({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const undoTimerRef = useRef(null);

  const getAvailableColor = () => {
    const usedColors = players.map(p => p.color.name);
    return PLAYER_COLORS.find(c => !usedColors.includes(c.name)) || PLAYER_COLORS[0];
  };

  const addPlayer = () => {
    if (players.length >= 5) {
      Alert.alert('Maximum Players', 'Ticket to Ride supports up to 5 players');
      return;
    }
    const newId = Math.max(...players.map(p => p.id), 0) + 1;
    const color = getAvailableColor();
    setPlayers([...players, { id: newId, name: `Player ${newId}`, color, score: 0 }]);
  };

  const removePlayer = (id) => {
    if (players.length <= 1) {
      Alert.alert('Cannot Remove', 'You need at least one player!');
      return;
    }
    setPlayers(players.filter(p => p.id !== id));
    if (selectedPlayerId === id) {
      setSelectedPlayerId(players[0].id);
    }
  };

  const showUndoButton = () => {
    setShowUndo(true);

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Clear existing timer if any
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }

    // Set timer to hide undo button after 5 seconds
    undoTimerRef.current = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowUndo(false);
        setLastAction(null);
      });
    }, 5000);
  };

  const addRoutePoints = (trainLength) => {
    if (!selectedPlayerId) {
      Alert.alert('No Player Selected', 'Please select a player first');
      return;
    }

    const points = ROUTE_POINTS[trainLength];
    const previousState = [...players];
    const previousSelectedId = selectedPlayerId;

    setPlayers(players.map(p =>
      p.id === selectedPlayerId ? { ...p, score: p.score + points } : p
    ));

    setLastAction({
      type: 'route',
      playerId: previousSelectedId,
      points,
      previousState,
      previousSelectedId,
    });

    setSelectedPlayerId(null);
    showUndoButton();
  };

  const undoLastAction = () => {
    if (lastAction && lastAction.type === 'route') {
      setPlayers(lastAction.previousState);
      setSelectedPlayerId(lastAction.previousSelectedId);
      setLastAction(null);
      setShowUndo(false);

      // Clear timer
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }

      // Reset animation
      fadeAnim.setValue(0);
    }
  };

  // Load saved data on mount
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('ticketToRideGameData');
        if (savedData) {
          const data = JSON.parse(savedData);
          setPlayers(data.players || players);
          setLongestRouteBonus(data.longestRouteBonus || 10);
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
          longestRouteBonus,
        };
        await AsyncStorage.setItem('ticketToRideGameData', JSON.stringify(dataToSave));
      } catch (error) {
        console.error('Error saving game data:', error);
      }
    };
    saveGameData();
  }, [players, longestRouteBonus]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const updateName = (id, newName) => {
    setPlayers(players.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const adjustScore = (id, delta) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, score: Math.max(0, p.score + delta) } : p
    ));
  };

  const adjustDestinationTickets = (id, delta) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, score: p.score + delta } : p
    ));
  };

  const toggleLongestRoute = (id) => {
    setPlayers(players.map(p => {
      if (p.id === id) {
        // If this player already has the bonus, remove it
        const hasBonus = p.longestRoute || false;
        return {
          ...p,
          longestRoute: !hasBonus,
          score: hasBonus ? p.score - longestRouteBonus : p.score + longestRouteBonus
        };
      } else if (p.longestRoute) {
        // Remove bonus from any other player
        return { ...p, longestRoute: false, score: p.score - longestRouteBonus };
      }
      return p;
    }));
  };

  const applyCustomPoints = (id) => {
    const points = parseInt(customInputs[id] || '0');
    if (!isNaN(points) && points !== 0) {
      adjustDestinationTickets(id, points);
      setCustomInputs({ ...customInputs, [id]: '' });
    }
  };

  const finishGame = () => {
    setShowWinners(true);
  };

  const getSortedPlayers = () => {
    return [...players].sort((a, b) => b.score - a.score);
  };

  const getMedalEmoji = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return '';
  };

  const resetGame = () => {
    Alert.alert(
      'Reset Game',
      'Are you sure you want to reset all scores and start over? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setPlayers(players.map(p => ({
              ...p,
              score: 0,
              longestRoute: false,
            })));
            setSelectedPlayerId(null);
            setLastAction(null);
            setShowUndo(false);
            setShowFinishGame(false);
            setShowWinners(false);
            setCustomInputs({});
            if (undoTimerRef.current) {
              clearTimeout(undoTimerRef.current);
            }
            fadeAnim.setValue(0);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Ticket to Ride Scorer</Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
            <Text style={styles.resetButtonText}>Reset Game</Text>
          </TouchableOpacity>
        </View>

        {/* Players Section */}
        <View style={styles.playersSection}>
          {players.map(player => (
            <TouchableOpacity
              key={player.id}
              style={[
                styles.playerCard,
                selectedPlayerId === player.id && styles.playerCardSelected,
                { borderLeftColor: player.color.color, borderLeftWidth: 6 }
              ]}
              onPress={() => setSelectedPlayerId(selectedPlayerId === player.id ? null : player.id)}
            >
              <View style={styles.playerHeader}>
                <View style={styles.playerInfo}>
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
                  <View style={[styles.colorBadge, { backgroundColor: player.color.color }]}>
                    <Text style={styles.colorText}>{player.color.name}</Text>
                  </View>
                </View>

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
                  onPress={() => adjustScore(player.id, -1)}
                >
                  <Text style={styles.scoreButtonText}>−</Text>
                </TouchableOpacity>

                <View style={styles.scoreDisplay}>
                  <Text style={styles.scoreLabel}>Score</Text>
                  <Text style={styles.scoreNumber}>{player.score}</Text>
                </View>

                <TouchableOpacity
                  style={styles.scoreButton}
                  onPress={() => adjustScore(player.id, 1)}
                >
                  <Text style={styles.scoreButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addPlayer}>
            <Text style={styles.addButtonText}>+ Add Player</Text>
          </TouchableOpacity>
        </View>

        {/* Route Scoring Section */}
        <View style={styles.routeSection}>
          <Text style={styles.sectionTitle}>Claim Route</Text>
          {selectedPlayerId ? (
            <View style={styles.selectedPlayerIndicator}>
              <Text style={styles.selectedPlayerLabel}>Selected Player:</Text>
              <View style={styles.selectedPlayerBadge}>
                <View style={[styles.selectedPlayerColorDot, { backgroundColor: players.find(p => p.id === selectedPlayerId)?.color.color }]} />
                <Text style={styles.selectedPlayerName}>{players.find(p => p.id === selectedPlayerId)?.name}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.sectionSubtitle}>
              Select player above, then tap route length:
            </Text>
          )}

          <View style={styles.routeButtons}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(length => (
              <TouchableOpacity
                key={length}
                style={styles.routeButton}
                onPress={() => addRoutePoints(length)}
              >
                <Text style={styles.routeLength}>{length}</Text>
                <Text style={styles.routePoints}>+{ROUTE_POINTS[length]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Undo Button */}
        {showUndo && (
          <Animated.View style={[styles.undoContainer, { opacity: fadeAnim }]}>
            <TouchableOpacity style={styles.undoButton} onPress={undoLastAction}>
              <Text style={styles.undoText}>↺ Undo Last Route</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Finish Game Button */}
        <TouchableOpacity
          style={styles.finishGameButton}
          onPress={() => setShowFinishGame(!showFinishGame)}
        >
          <Text style={styles.finishGameText}>
            {showFinishGame ? '▼ Hide Final Scoring' : '▶ Finish Game & Final Scoring'}
          </Text>
        </TouchableOpacity>

        {/* Final Scoring Section */}
        {showFinishGame && (
          <View style={styles.finalScoringSection}>
            <Text style={styles.finalScoringTitle}>Destination Tickets & Bonuses</Text>

            <View style={styles.longestRouteBonusConfig}>
              <Text style={styles.bonusConfigLabel}>Longest Route Bonus:</Text>
              <View style={styles.bonusConfigControls}>
                <TouchableOpacity
                  style={styles.bonusButton}
                  onPress={() => setLongestRouteBonus(Math.max(1, longestRouteBonus - 1))}
                >
                  <Text style={styles.bonusButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.bonusValue}>{longestRouteBonus}</Text>
                <TouchableOpacity
                  style={styles.bonusButton}
                  onPress={() => setLongestRouteBonus(longestRouteBonus + 1)}
                >
                  <Text style={styles.bonusButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {players.map(player => (
              <View key={`final-${player.id}`} style={styles.finalPlayerCard}>
                <View style={[styles.playerColorBar, { backgroundColor: player.color.color }]} />

                <View style={styles.finalPlayerContent}>
                  <Text style={styles.finalPlayerName}>{player.name}</Text>

                  <View style={styles.destinationTicketSection}>
                    <Text style={styles.destinationLabel}>Destination Tickets:</Text>
                    <View style={styles.destinationControls}>
                      <TouchableOpacity
                        style={styles.ticketButtonSmall}
                        onPress={() => adjustDestinationTickets(player.id, 1)}
                      >
                        <Text style={styles.ticketButtonText}>+1</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ticketButtonSmall}
                        onPress={() => adjustDestinationTickets(player.id, 5)}
                      >
                        <Text style={styles.ticketButtonText}>+5</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ticketButtonSmall}
                        onPress={() => adjustDestinationTickets(player.id, 10)}
                      >
                        <Text style={styles.ticketButtonText}>+10</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ticketButtonSmall, styles.ticketButtonNegative]}
                        onPress={() => adjustDestinationTickets(player.id, -1)}
                      >
                        <Text style={styles.ticketButtonText}>-1</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ticketButtonSmall, styles.ticketButtonNegative]}
                        onPress={() => adjustDestinationTickets(player.id, -5)}
                      >
                        <Text style={styles.ticketButtonText}>-5</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ticketButtonSmall, styles.ticketButtonNegative]}
                        onPress={() => adjustDestinationTickets(player.id, -10)}
                      >
                        <Text style={styles.ticketButtonText}>-10</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.customInputContainer}>
                      <TextInput
                        style={styles.customInput}
                        placeholder="Custom"
                        keyboardType="numeric"
                        value={customInputs[player.id] || ''}
                        onChangeText={(text) => setCustomInputs({ ...customInputs, [player.id]: text })}
                      />
                      <TouchableOpacity
                        style={styles.applyButton}
                        onPress={() => applyCustomPoints(player.id)}
                      >
                        <Text style={styles.applyButtonText}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.longestRouteButton,
                      player.longestRoute && styles.longestRouteButtonActive
                    ]}
                    onPress={() => toggleLongestRoute(player.id)}
                  >
                    <Text style={[
                      styles.longestRouteText,
                      player.longestRoute && styles.longestRouteTextActive
                    ]}>
                      {player.longestRoute ? `✓ Longest Route (+${longestRouteBonus})` : 'Longest Route'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View style={styles.finalScoreInfo}>
              <Text style={styles.finalScoreInfoText}>
                • Use quick buttons (+1, +5, +10, -1, -5, -10) or custom input{'\n'}
                • Only ONE player can have the Longest Route bonus{'\n'}
                • Adjust Longest Route bonus value if needed (default: 10)
              </Text>
            </View>

            <TouchableOpacity
              style={styles.showWinnersButton}
              onPress={finishGame}
            >
              <Text style={styles.showWinnersButtonText}>🎉 Finish the Game & Show Winners 🎉</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Scoring Guide</Text>
          <Text style={styles.text}>
            Route Points:{'\n'}
            • 1 train = 1 point{'\n'}
            • 2 trains = 2 points{'\n'}
            • 3 trains = 4 points{'\n'}
            • 4 trains = 7 points{'\n'}
            • 5 trains = 10 points{'\n'}
            • 6 trains = 15 points{'\n'}
            • 7 trains = 18 points{'\n'}
            • 8 trains = 21 points
          </Text>
        </View>
      </ScrollView>

      {/* Winners Modal */}
      <Modal
        visible={showWinners}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWinners(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.winnersModal}>
            <Text style={styles.winnersTitle}>🎉 Game Finished! 🎉</Text>
            <Text style={styles.winnersSubtitle}>Final Rankings</Text>

            <View style={styles.podiumContainer}>
              {getSortedPlayers().slice(0, 3).map((player, index) => (
                <View key={player.id} style={styles.podiumPlace}>
                  <Text style={styles.medalEmoji}>{getMedalEmoji(index)}</Text>
                  <View style={styles.podiumPlayerInfo}>
                    <Text style={styles.podiumRank}>{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : 'rd'} Place</Text>
                    <View style={[styles.podiumColorBadge, { backgroundColor: player.color.color }]}>
                      <Text style={styles.podiumColorText}>{player.color.name}</Text>
                    </View>
                    <Text style={styles.podiumPlayerName}>{player.name}</Text>
                    <Text style={styles.podiumScore}>{player.score} points</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowWinners(false)}
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
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  headerContainer: {
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
    marginBottom: 25,
  },
  playerCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  playerCardSelected: {
    backgroundColor: '#E8F4FF',
    borderColor: '#007AFF',
    borderWidth: 2,
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
    marginBottom: 6,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    marginBottom: 6,
    padding: 0,
  },
  colorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  colorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  },
  scoreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreButtonText: {
    color: '#fff',
    fontSize: 24,
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
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
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
  routeSection: {
    backgroundColor: '#FFF9E6',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  selectedPlayerIndicator: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  selectedPlayerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '600',
  },
  selectedPlayerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedPlayerColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedPlayerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  routeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  routeButton: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeLength: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  routePoints: {
    color: '#fff',
    fontSize: 10,
    marginTop: 2,
  },
  infoSection: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
  },
  undoContainer: {
    marginBottom: 20,
  },
  undoButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  undoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  finishGameButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  finishGameText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  finalScoringSection: {
    backgroundColor: '#F0F9FF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#34C759',
  },
  finalScoringTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  finalPlayerCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
  },
  playerColorBar: {
    width: 6,
  },
  finalPlayerContent: {
    flex: 1,
    padding: 12,
  },
  finalPlayerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  destinationTicketSection: {
    marginBottom: 10,
  },
  destinationLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  destinationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 4,
  },
  ticketButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  ticketButtonSmall: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  ticketButtonPositive: {
    backgroundColor: '#34C759',
  },
  ticketButtonNegative: {
    backgroundColor: '#FF3B30',
  },
  ticketButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  customInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginRight: 8,
    fontSize: 14,
  },
  applyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  longestRouteBonusConfig: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  bonusConfigLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  bonusConfigControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bonusButton: {
    backgroundColor: '#FFD700',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bonusButtonText: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bonusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginHorizontal: 12,
    minWidth: 30,
    textAlign: 'center',
  },
  longestRouteButton: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  longestRouteButtonActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFA500',
  },
  longestRouteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  longestRouteTextActive: {
    color: '#333',
  },
  finalScoreInfo: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  finalScoreInfoText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#666',
  },
  showWinnersButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  showWinnersButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  winnersModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  winnersTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  winnersSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 18,
    color: '#666',
    fontWeight: '600',
  },
  podiumContainer: {
    marginBottom: 18,
  },
  podiumPlace: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  medalEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  podiumPlayerInfo: {
    alignItems: 'center',
    width: '100%',
  },
  podiumRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  podiumColorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  podiumColorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  podiumPlayerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  podiumScore: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

