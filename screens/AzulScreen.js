import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';

const STORAGE_KEY = 'azulGameData';
const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12'];

// Azul tile colors with their emojis and colors
const TILE_COLORS = [
  { id: 'blue', emoji: '🔵', color: '#3498DB', name: 'Blue' },
  { id: 'yellow', emoji: '🟡', color: '#F1C40F', name: 'Yellow' },
  { id: 'red', emoji: '🔴', color: '#E74C3C', name: 'Red' },
  { id: 'black', emoji: '⚫', color: '#2C3E50', name: 'Black' },
  { id: 'cyan', emoji: '🩵', color: '#1ABC9C', name: 'Cyan' },
];

// Floor line penalties: -1, -1, -2, -2, -2, -3, -3
const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3];

// Standard Azul wall pattern (each row has tiles in specific order)
const WALL_PATTERN = [
  ['blue', 'yellow', 'red', 'black', 'cyan'],
  ['cyan', 'blue', 'yellow', 'red', 'black'],
  ['black', 'cyan', 'blue', 'yellow', 'red'],
  ['red', 'black', 'cyan', 'blue', 'yellow'],
  ['yellow', 'red', 'black', 'cyan', 'blue'],
];

const createEmptyWall = () => [
  [false, false, false, false, false],
  [false, false, false, false, false],
  [false, false, false, false, false],
  [false, false, false, false, false],
  [false, false, false, false, false],
];

export default function AzulScreen() {
  const { theme } = useTheme();
  const [players, setPlayers] = useState([
    {
      id: 1,
      name: DEFAULT_PLAYER_NAMES[0],
      color: PLAYER_COLORS[0],
      score: 0,
      wall: createEmptyWall(),
      floorTiles: 0,
      roundScore: 0,
      tilesPlacedThisRound: [], // Track which rows had tiles placed this round
    }
  ]);
  const [currentRound, setCurrentRound] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [results, setResults] = useState(null);
  const [showTilePlacer, setShowTilePlacer] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveData();
  }, [players, currentRound]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const { players: savedPlayers, currentRound: savedRound } = JSON.parse(savedData);
        setPlayers(savedPlayers);
        setCurrentRound(savedRound || 1);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ players, currentRound }));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const addPlayer = () => {
    if (players.length >= 4) {
      Alert.alert('Max Players', 'Azul supports 2-4 players.');
      return;
    }
    const newId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 1;
    setPlayers([...players, {
      id: newId,
      name: DEFAULT_PLAYER_NAMES[players.length] || `Player ${newId}`,
      color: PLAYER_COLORS[players.length % PLAYER_COLORS.length],
      score: 0,
      wall: createEmptyWall(),
      floorTiles: 0,
      roundScore: 0,
      tilesPlacedThisRound: [],
    }]);
  };

  const removePlayer = (id) => {
    if (players.length > 1) {
      setPlayers(players.filter(p => p.id !== id));
      if (selectedPlayerId === id) {
        setSelectedPlayerId(null);
      }
    } else {
      Alert.alert('Cannot Remove', 'You must have at least one player.');
    }
  };

  const updatePlayerName = (id, name) => {
    setPlayers(players.map(p =>
      p.id === id ? { ...p, name } : p
    ));
  };

  // Calculate points for placing a tile on the wall
  const calculateTilePlacementPoints = (wall, row, col) => {
    let points = 1;

    // Count horizontal adjacent tiles
    let horizontalCount = 1;
    // Check left
    for (let c = col - 1; c >= 0 && wall[row][c]; c--) {
      horizontalCount++;
    }
    // Check right
    for (let c = col + 1; c < 5 && wall[row][c]; c++) {
      horizontalCount++;
    }

    // Count vertical adjacent tiles
    let verticalCount = 1;
    // Check up
    for (let r = row - 1; r >= 0 && wall[r][col]; r--) {
      verticalCount++;
    }
    // Check down
    for (let r = row + 1; r < 5 && wall[r][col]; r++) {
      verticalCount++;
    }

    // Calculate points
    if (horizontalCount > 1 && verticalCount > 1) {
      points = horizontalCount + verticalCount;
    } else if (horizontalCount > 1) {
      points = horizontalCount;
    } else if (verticalCount > 1) {
      points = verticalCount;
    }

    return points;
  };

  // Toggle tile on wall and calculate points
  const toggleWallTile = (playerId, row, col) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const wasPlaced = player.wall[row][col];
    const tilesPlacedThisRound = player.tilesPlacedThisRound || [];
    const tilePlacedThisRound = tilesPlacedThisRound.includes(row);

    // If trying to place a tile in a row that already has a tile placed this round
    if (!wasPlaced && tilePlacedThisRound) {
      Alert.alert(
        'One Tile Per Row',
        'You can only place one tile per row each round. Remove the existing tile first if you want to change it.'
      );
      return;
    }

    setPlayers(players.map(p => {
      if (p.id === playerId) {
        const newWall = p.wall.map(r => [...r]);
        newWall[row][col] = !wasPlaced;

        let pointChange = 0;
        let newTilesPlacedThisRound = [...(p.tilesPlacedThisRound || [])];

        if (!wasPlaced) {
          // Placing tile - add points and track the row
          pointChange = calculateTilePlacementPoints(newWall, row, col);
          newTilesPlacedThisRound.push(row);
        } else {
          // Removing tile - recalculate (this is for corrections)
          // Only allow removal if it was placed this round
          if (tilePlacedThisRound) {
            const tempWall = p.wall.map(r => [...r]);
            pointChange = -calculateTilePlacementPoints(tempWall, row, col);
            newTilesPlacedThisRound = newTilesPlacedThisRound.filter(r => r !== row);
          } else {
            // Can't remove tiles from previous rounds
            return p;
          }
        }

        return {
          ...p,
          wall: newWall,
          roundScore: p.roundScore + pointChange,
          tilesPlacedThisRound: newTilesPlacedThisRound,
        };
      }
      return p;
    }));
  };

  // Adjust floor tiles
  const adjustFloorTiles = (playerId, amount) => {
    setPlayers(players.map(p => {
      if (p.id === playerId) {
        const newFloorTiles = Math.max(0, Math.min(7, p.floorTiles + amount));
        return { ...p, floorTiles: newFloorTiles };
      }
      return p;
    }));
  };

  // Calculate floor penalty
  const calculateFloorPenalty = (floorTiles) => {
    let penalty = 0;
    for (let i = 0; i < Math.min(floorTiles, 7); i++) {
      penalty += FLOOR_PENALTIES[i];
    }
    return penalty;
  };

  // Check if any player has completed a horizontal row (game end trigger)
  const checkGameEnd = (playersToCheck) => {
    for (const player of playersToCheck) {
      for (let row = 0; row < 5; row++) {
        if (player.wall[row].every(tile => tile)) {
          return true;
        }
      }
    }
    return false;
  };

  // End round - apply floor penalties and update scores
  const endRound = () => {
    // Check if game will end after this round
    const gameWillEnd = checkGameEnd(players);

    const message = gameWillEnd
      ? `End Round ${currentRound}? A complete row was detected - this will be the final round!`
      : `End Round ${currentRound}? Floor penalties will be applied.`;

    Alert.alert(
      gameWillEnd ? 'Final Round!' : 'End Round',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: gameWillEnd ? 'End Game' : 'End Round',
          onPress: () => {
            const updatedPlayers = players.map(p => {
              const floorPenalty = calculateFloorPenalty(p.floorTiles);
              const newScore = Math.max(0, p.score + p.roundScore + floorPenalty);
              return {
                ...p,
                score: newScore,
                roundScore: 0,
                floorTiles: 0,
                tilesPlacedThisRound: [], // Reset for next round
              };
            });

            setPlayers(updatedPlayers);

            if (gameWillEnd) {
              // Trigger game end with final scoring
              const finalScores = updatedPlayers.map(player => {
                const endGameBonus = calculateEndGameBonuses(player.wall);
                const completions = countCompletions(player.wall);

                return {
                  player: { ...player, score: player.score },
                  currentScore: player.score,
                  endGameBonus,
                  completions,
                  finalScore: player.score + endGameBonus,
                };
              });

              finalScores.sort((a, b) => b.finalScore - a.finalScore);
              setResults(finalScores);
            } else {
              setCurrentRound(currentRound + 1);
            }
          }
        }
      ]
    );
  };

  // Calculate end game bonuses
  const calculateEndGameBonuses = (wall) => {
    let bonus = 0;

    // Complete horizontal rows (2 points each)
    for (let row = 0; row < 5; row++) {
      if (wall[row].every(tile => tile)) {
        bonus += 2;
      }
    }

    // Complete vertical columns (7 points each)
    for (let col = 0; col < 5; col++) {
      let complete = true;
      for (let row = 0; row < 5; row++) {
        if (!wall[row][col]) {
          complete = false;
          break;
        }
      }
      if (complete) {
        bonus += 7;
      }
    }

    // Complete color sets (10 points each)
    for (const tileColor of TILE_COLORS) {
      let colorComplete = true;
      for (let row = 0; row < 5; row++) {
        const col = WALL_PATTERN[row].indexOf(tileColor.id);
        if (!wall[row][col]) {
          colorComplete = false;
          break;
        }
      }
      if (colorComplete) {
        bonus += 10;
      }
    }

    return bonus;
  };

  // Count completed rows, columns, and colors for display
  const countCompletions = (wall) => {
    let rows = 0;
    let cols = 0;
    let colors = 0;

    // Count complete rows
    for (let row = 0; row < 5; row++) {
      if (wall[row].every(tile => tile)) {
        rows++;
      }
    }

    // Count complete columns
    for (let col = 0; col < 5; col++) {
      let complete = true;
      for (let row = 0; row < 5; row++) {
        if (!wall[row][col]) {
          complete = false;
          break;
        }
      }
      if (complete) {
        cols++;
      }
    }

    // Count complete colors
    for (const tileColor of TILE_COLORS) {
      let colorComplete = true;
      for (let row = 0; row < 5; row++) {
        const col = WALL_PATTERN[row].indexOf(tileColor.id);
        if (!wall[row][col]) {
          colorComplete = false;
          break;
        }
      }
      if (colorComplete) {
        colors++;
      }
    }

    return { rows, cols, colors };
  };

  // Finish game and show results
  const finishGame = () => {
    const finalScores = players.map(player => {
      const floorPenalty = calculateFloorPenalty(player.floorTiles);
      const currentScore = Math.max(0, player.score + player.roundScore + floorPenalty);
      const endGameBonus = calculateEndGameBonuses(player.wall);
      const completions = countCompletions(player.wall);

      return {
        player,
        currentScore,
        endGameBonus,
        completions,
        finalScore: currentScore + endGameBonus,
      };
    });

    finalScores.sort((a, b) => b.finalScore - a.finalScore);
    setResults(finalScores);
  };

  const resetGame = () => {
    Alert.alert(
      'Reset Game',
      'Are you sure you want to reset the entire game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setPlayers(players.map(p => ({
              ...p,
              score: 0,
              wall: createEmptyWall(),
              floorTiles: 0,
              roundScore: 0,
              tilesPlacedThisRound: [],
            })));
            setCurrentRound(1);
            setResults(null);
          }
        }
      ]
    );
  };

  const getTileColorInfo = (row, col) => {
    const colorId = WALL_PATTERN[row][col];
    return TILE_COLORS.find(t => t.id === colorId);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>🎨 Azul Scorer</Text>
          <Text style={[styles.roundText, { color: theme.colors.textSecondary }]}>Round {currentRound}</Text>
          <TouchableOpacity style={[styles.resetButton, { backgroundColor: theme.colors.danger }]} onPress={resetGame}>
            <Text style={styles.resetButtonText}>Reset Game</Text>
          </TouchableOpacity>
        </View>

        {/* Players Section */}
        <View style={styles.playersSection}>
          {players.map((player) => (
            <View
              key={player.id}
              style={[
                styles.playerCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderLeftColor: player.color,
                  borderLeftWidth: 6,
                }
              ]}
            >
              <View style={styles.playerHeader}>
                <View style={styles.playerInfo}>
                  {editingId === player.id ? (
                    <TextInput
                      style={[styles.nameInput, { color: theme.colors.text, borderBottomColor: theme.colors.primary }]}
                      value={player.name}
                      onChangeText={(text) => updatePlayerName(player.id, text)}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity onPress={() => setEditingId(player.id)}>
                      <Text style={[styles.playerName, { color: theme.colors.text }]}>{player.name}</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.scoreRow}>
                    <Text style={[styles.totalScoreLabel, { color: theme.colors.textSecondary }]}>Total: </Text>
                    <Text style={[styles.totalScore, { color: theme.colors.primary }]}>{player.score}</Text>
                    {player.roundScore !== 0 && (
                      <Text style={[styles.roundScorePreview, { color: player.roundScore >= 0 ? theme.colors.success : theme.colors.danger }]}>
                        {player.roundScore >= 0 ? '+' : ''}{player.roundScore}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.colors.danger }]}
                  onPress={() => removePlayer(player.id)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>

              {/* Wall Grid */}
              <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Wall (tap to place tiles - 1 per row/round)</Text>
              <View style={[styles.wallContainer, { backgroundColor: theme.dark ? '#1a1a2e' : '#E8E4E1' }]}>
                {player.wall.map((row, rowIndex) => {
                  const rowPlacedThisRound = player.tilesPlacedThisRound?.includes(rowIndex);
                  return (
                    <View key={rowIndex} style={styles.wallRow}>
                      {row.map((placed, colIndex) => {
                        const tileInfo = getTileColorInfo(rowIndex, colIndex);
                        const isNewTile = placed && rowPlacedThisRound;
                        return (
                          <TouchableOpacity
                            key={colIndex}
                            style={[
                              styles.wallTile,
                              {
                                backgroundColor: placed ? tileInfo.color : (theme.dark ? '#2d2d44' : '#F5F5F5'),
                                borderColor: isNewTile ? '#FFD700' : (theme.dark ? '#444' : '#ccc'),
                                borderWidth: isNewTile ? 3 : 1,
                              }
                            ]}
                            onPress={() => toggleWallTile(player.id, rowIndex, colIndex)}
                          >
                            {placed ? (
                              <Text style={styles.wallTileEmoji}>{tileInfo.emoji}</Text>
                            ) : (
                              <Text style={[styles.wallTileEmpty, { color: theme.dark ? '#555' : '#bbb' }]}>
                                {tileInfo.emoji}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>

              {/* Floor Line */}
              <View style={styles.floorSection}>
                <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
                  Floor Line ({calculateFloorPenalty(player.floorTiles)} pts)
                </Text>
                <View style={styles.floorControls}>
                  <TouchableOpacity
                    style={[styles.floorButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => adjustFloorTiles(player.id, -1)}
                  >
                    <Text style={styles.floorButtonText}>−</Text>
                  </TouchableOpacity>

                  <View style={styles.floorTilesDisplay}>
                    {FLOOR_PENALTIES.map((penalty, index) => (
                      <View
                        key={index}
                        style={[
                          styles.floorTile,
                          {
                            backgroundColor: index < player.floorTiles
                              ? theme.colors.danger
                              : (theme.dark ? '#333' : '#e0e0e0'),
                            borderColor: theme.colors.border,
                          }
                        ]}
                      >
                        <Text style={[
                          styles.floorTilePenalty,
                          { color: index < player.floorTiles ? '#fff' : theme.colors.textTertiary }
                        ]}>
                          {penalty}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.floorButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => adjustFloorTiles(player.id, 1)}
                  >
                    <Text style={styles.floorButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Completion Preview */}
              {(() => {
                const completions = countCompletions(player.wall);
                const bonus = calculateEndGameBonuses(player.wall);
                if (bonus > 0) {
                  return (
                    <View style={[styles.completionPreview, { backgroundColor: theme.dark ? '#1a2f3d' : '#E8F4FF' }]}>
                      <Text style={[styles.completionText, { color: theme.dark ? '#5DADE2' : '#0066CC' }]}>
                        End game bonus: +{bonus} ({completions.rows} rows × 2, {completions.cols} cols × 7, {completions.colors} colors × 10)
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}
            </View>
          ))}

          <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.success }]} onPress={addPlayer}>
            <Text style={styles.addButtonText}>+ Add Player</Text>
          </TouchableOpacity>
        </View>

        {/* Round Controls */}
        <View style={styles.roundControls}>
          <TouchableOpacity
            style={[styles.endRoundButton, { backgroundColor: theme.colors.warning }]}
            onPress={endRound}
          >
            <Text style={styles.endRoundButtonText}>End Round {currentRound}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.finishGameButton, { backgroundColor: theme.colors.success }]}
            onPress={finishGame}
          >
            <Text style={styles.finishGameButtonText}>🏆 Finish Game</Text>
          </TouchableOpacity>
        </View>

        {/* Scoring Guide */}
        <View style={[styles.infoSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.infoTitle, { color: theme.colors.text }]}>📖 Scoring Guide</Text>
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold' }}>Tile Placement:</Text>{'\n'}
            • 1 point per tile (isolated){'\n'}
            • Connected tiles add to score{'\n\n'}
            <Text style={{ fontWeight: 'bold' }}>Floor Penalties:</Text>{'\n'}
            • -1, -1, -2, -2, -2, -3, -3{'\n\n'}
            <Text style={{ fontWeight: 'bold' }}>End Game Bonuses:</Text>{'\n'}
            • Complete row: +2 points{'\n'}
            • Complete column: +7 points{'\n'}
            • All 5 of one color: +10 points{'\n\n'}
            • Tap player names to edit
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
                    <Text style={styles.resultMedal}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </Text>
                    <Text style={[styles.resultName, { color: theme.colors.text }]}>{result.player.name}</Text>
                    <Text style={[styles.resultTotal, { color: theme.colors.success }]}>{result.finalScore}</Text>
                  </View>
                  <View style={styles.breakdown}>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>
                      Score: {result.currentScore}
                    </Text>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>
                      End Game Bonus: +{result.endGameBonus}
                    </Text>
                    <Text style={[styles.breakdownDetail, { color: theme.colors.textTertiary }]}>
                      ({result.completions.rows} rows, {result.completions.cols} cols, {result.completions.colors} colors)
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.newGameButton, { backgroundColor: theme.colors.success }]}
                onPress={() => {
                  setResults(null);
                  resetGame();
                }}
              >
                <Text style={styles.newGameButtonText}>New Game</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setResults(null)}
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
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roundText: {
    fontSize: 16,
    marginBottom: 12,
  },
  resetButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
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
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
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
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    borderBottomWidth: 2,
    minWidth: 150,
    padding: 0,
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalScoreLabel: {
    fontSize: 14,
  },
  totalScore: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  roundScorePreview: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  wallContainer: {
    padding: 8,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 15,
  },
  wallRow: {
    flexDirection: 'row',
  },
  wallTile: {
    width: 44,
    height: 44,
    margin: 2,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  wallTileEmoji: {
    fontSize: 24,
  },
  wallTileEmpty: {
    fontSize: 18,
    opacity: 0.3,
  },
  floorSection: {
    marginBottom: 10,
  },
  floorControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  floorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floorButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  floorTilesDisplay: {
    flexDirection: 'row',
    gap: 4,
  },
  floorTile: {
    width: 28,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  floorTilePenalty: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  completionPreview: {
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  completionText: {
    fontSize: 12,
    textAlign: 'center',
  },
  addButton: {
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
  roundControls: {
    gap: 12,
    marginBottom: 20,
  },
  endRoundButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  endRoundButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  finishGameButton: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  finishGameButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoSection: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  resultsScroll: {
    maxHeight: 350,
  },
  resultCard: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultMedal: {
    fontSize: 24,
    marginRight: 10,
  },
  resultName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  resultTotal: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  breakdown: {
    paddingLeft: 10,
  },
  breakdownText: {
    fontSize: 14,
    marginBottom: 2,
  },
  breakdownDetail: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 15,
  },
  newGameButton: {
    flex: 1,
    borderRadius: 10,
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
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
