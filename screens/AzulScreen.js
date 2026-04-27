import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';

const STORAGE_KEY = 'azulGameData';
const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12'];

const TILE_COLORS = [
  { id: 'blue', emoji: '🔵', color: '#3498DB', name: 'Blue' },
  { id: 'yellow', emoji: '🟡', color: '#F1C40F', name: 'Yellow' },
  { id: 'red', emoji: '🔴', color: '#E74C3C', name: 'Red' },
  { id: 'black', emoji: '⚫', color: '#2C3E50', name: 'Black' },
  { id: 'cyan', emoji: '🩵', color: '#1ABC9C', name: 'Cyan' },
];

const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3];

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

// Firestore doesn't support nested arrays — serialize/deserialize as flat
const wallToFlat = (wall) => wall.flat();
const flatToWall = (flat) => {
  if (!flat || flat.length !== 25) return createEmptyWall();
  return [flat.slice(0,5), flat.slice(5,10), flat.slice(10,15), flat.slice(15,20), flat.slice(20,25)];
};

export default function AzulScreen() {
  const { theme } = useTheme();
  const room = useRoom('Azul');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  // ── Offline state ────────────────────────────────────────────────────────────
  const [localPlayers, setLocalPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], color: PLAYER_COLORS[0], score: 0, wall: createEmptyWall(), floorTiles: 0, roundScore: 0, tilesPlacedThisRound: [] },
  ]);
  const [currentRound, setCurrentRound] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [results, setResults] = useState(null);

  // ── Online helpers ───────────────────────────────────────────────────────────

  const canEdit = (playerId) =>
    !room.isOnline || room.allCanEdit || playerId === room.userId;

  const getPlayerData = (playerId) => {
    const p = room.players.find((r) => r.id === playerId);
    const pd = p?.playerData ?? {};
    return {
      score: pd.score ?? 0,
      wall: flatToWall(pd.wall),
      floorTiles: pd.floorTiles ?? 0,
      roundScore: pd.roundScore ?? 0,
      tilesPlacedThisRound: pd.tilesPlacedThisRound ?? [],
    };
  };

  const effectiveCurrentRound = room.isOnline
    ? (room.sharedState?.currentRound ?? 1)
    : currentRound;

  // Derive display players
  const players = room.isOnline
    ? [...room.players]
        .sort((a, b) => (b.id === room.userId ? 1 : 0) - (a.id === room.userId ? 1 : 0))
        .map((p, i) => ({
          id: p.id,
          name: p.displayName,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          score: p.playerData?.score ?? 0,
          wall: flatToWall(p.playerData?.wall),
          floorTiles: p.playerData?.floorTiles ?? 0,
          roundScore: p.playerData?.roundScore ?? 0,
          tilesPlacedThisRound: p.playerData?.tilesPlacedThisRound ?? [],
        }))
    : localPlayers;

  // ── Persistence ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedData) {
          const { players: savedPlayers, currentRound: savedRound } = JSON.parse(savedData);
          setLocalPlayers(savedPlayers);
          setCurrentRound(savedRound || 1);
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ players: localPlayers, currentRound })).catch(console.error);
  }, [localPlayers, currentRound, room.isOnline]);

  // ── Score helpers ────────────────────────────────────────────────────────────

  const calculateTilePlacementPoints = (wall, row, col) => {
    let horizontalCount = 1;
    for (let c = col - 1; c >= 0 && wall[row][c]; c--) horizontalCount++;
    for (let c = col + 1; c < 5 && wall[row][c]; c++) horizontalCount++;
    let verticalCount = 1;
    for (let r = row - 1; r >= 0 && wall[r][col]; r--) verticalCount++;
    for (let r = row + 1; r < 5 && wall[r][col]; r++) verticalCount++;
    if (horizontalCount > 1 && verticalCount > 1) return horizontalCount + verticalCount;
    if (horizontalCount > 1) return horizontalCount;
    if (verticalCount > 1) return verticalCount;
    return 1;
  };

  const calculateFloorPenalty = (floorTiles) => {
    let penalty = 0;
    for (let i = 0; i < Math.min(floorTiles, 7); i++) penalty += FLOOR_PENALTIES[i];
    return penalty;
  };

  const calculateEndGameBonuses = (wall) => {
    let bonus = 0;
    for (let row = 0; row < 5; row++) { if (wall[row].every((t) => t)) bonus += 2; }
    for (let col = 0; col < 5; col++) {
      if ([0,1,2,3,4].every((row) => wall[row][col])) bonus += 7;
    }
    for (const tileColor of TILE_COLORS) {
      if ([0,1,2,3,4].every((row) => wall[row][WALL_PATTERN[row].indexOf(tileColor.id)])) bonus += 10;
    }
    return bonus;
  };

  const countCompletions = (wall) => {
    let rows = 0, cols = 0, colors = 0;
    for (let row = 0; row < 5; row++) { if (wall[row].every((t) => t)) rows++; }
    for (let col = 0; col < 5; col++) { if ([0,1,2,3,4].every((row) => wall[row][col])) cols++; }
    for (const tileColor of TILE_COLORS) {
      if ([0,1,2,3,4].every((row) => wall[row][WALL_PATTERN[row].indexOf(tileColor.id)])) colors++;
    }
    return { rows, cols, colors };
  };

  const checkGameEnd = (playersToCheck) => {
    for (const player of playersToCheck) {
      for (let row = 0; row < 5; row++) {
        if (player.wall[row].every((t) => t)) return true;
      }
    }
    return false;
  };

  const getTileColorInfo = (row, col) => TILE_COLORS.find((t) => t.id === WALL_PATTERN[row][col]);

  // ── Player management (offline only) ────────────────────────────────────────

  const addPlayer = () => {
    if (localPlayers.length >= 4) { Alert.alert('Max Players', 'Azul supports 2-4 players.'); return; }
    const newId = Math.max(...localPlayers.map((p) => p.id)) + 1;
    setLocalPlayers([...localPlayers, {
      id: newId, name: DEFAULT_PLAYER_NAMES[localPlayers.length] || `Player ${newId}`,
      color: PLAYER_COLORS[localPlayers.length % PLAYER_COLORS.length],
      score: 0, wall: createEmptyWall(), floorTiles: 0, roundScore: 0, tilesPlacedThisRound: [],
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

  const toggleWallTile = (playerId, row, col) => {
    if (!canEdit(playerId)) return;

    if (room.isOnline) {
      const pd = getPlayerData(playerId);
      const wasPlaced = pd.wall[row][col];
      const tilePlacedThisRound = pd.tilesPlacedThisRound.includes(row);

      if (!wasPlaced && tilePlacedThisRound) {
        Alert.alert('One Tile Per Row', 'You can only place one tile per row each round. Remove the existing tile first.');
        return;
      }

      const newWall = pd.wall.map((r) => [...r]);
      newWall[row][col] = !wasPlaced;
      let pointChange = 0;
      let newTiles = [...pd.tilesPlacedThisRound];

      if (!wasPlaced) {
        pointChange = calculateTilePlacementPoints(newWall, row, col);
        newTiles.push(row);
      } else {
        if (!tilePlacedThisRound) return;
        pointChange = -calculateTilePlacementPoints(pd.wall, row, col);
        newTiles = newTiles.filter((r) => r !== row);
      }

      room.updatePlayerData(playerId, {
        score: pd.score,
        wall: wallToFlat(newWall),
        floorTiles: pd.floorTiles,
        roundScore: pd.roundScore + pointChange,
        tilesPlacedThisRound: newTiles,
      });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== playerId) return p;
          const wasPlaced = p.wall[row][col];
          const tilePlacedThisRound = (p.tilesPlacedThisRound || []).includes(row);
          if (!wasPlaced && tilePlacedThisRound) {
            Alert.alert('One Tile Per Row', 'You can only place one tile per row each round. Remove the existing tile first.');
            return p;
          }
          const newWall = p.wall.map((r) => [...r]);
          newWall[row][col] = !wasPlaced;
          let pointChange = 0;
          let newTiles = [...(p.tilesPlacedThisRound || [])];
          if (!wasPlaced) {
            pointChange = calculateTilePlacementPoints(newWall, row, col);
            newTiles.push(row);
          } else {
            if (!tilePlacedThisRound) return p;
            pointChange = -calculateTilePlacementPoints(p.wall, row, col);
            newTiles = newTiles.filter((r) => r !== row);
          }
          return { ...p, wall: newWall, roundScore: p.roundScore + pointChange, tilesPlacedThisRound: newTiles };
        })
      );
    }
  };

  const adjustFloorTiles = (playerId, amount) => {
    if (!canEdit(playerId)) return;
    if (room.isOnline) {
      const pd = getPlayerData(playerId);
      room.updatePlayerData(playerId, { ...pd, wall: wallToFlat(pd.wall), floorTiles: Math.max(0, Math.min(7, pd.floorTiles + amount)) });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, floorTiles: Math.max(0, Math.min(7, p.floorTiles + amount)) } : p))
      );
    }
  };

  const endRound = () => {
    if (room.isOnline && !room.isHost && !room.allCanEdit) return;
    const gameWillEnd = checkGameEnd(players);
    const message = gameWillEnd
      ? `End Round ${effectiveCurrentRound}? A complete row was detected — this will be the final round!`
      : `End Round ${effectiveCurrentRound}? Floor penalties will be applied.`;

    Alert.alert(gameWillEnd ? 'Final Round!' : 'End Round', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: gameWillEnd ? 'End Game' : 'End Round',
        onPress: () => {
          if (room.isOnline) {
            // Compute updated data locally for immediate results display
            const updatedDataList = room.players.map((rp) => {
              const pd = getPlayerData(rp.id);
              const floorPenalty = calculateFloorPenalty(pd.floorTiles);
              const newScore = Math.max(0, pd.score + pd.roundScore + floorPenalty);
              return { id: rp.id, displayName: rp.displayName, data: { score: newScore, wall: wallToFlat(pd.wall), floorTiles: 0, roundScore: 0, tilesPlacedThisRound: [] }, wall: pd.wall };
            });
            Promise.all(updatedDataList.map((u) => room.updatePlayerData(u.id, u.data)));
            if (gameWillEnd) {
              const finalScores = updatedDataList.map((u) => {
                const endGameBonus = calculateEndGameBonuses(u.wall);
                const completions = countCompletions(u.wall);
                return { player: { id: u.id, name: u.displayName }, currentScore: u.data.score, endGameBonus, completions, finalScore: u.data.score + endGameBonus };
              }).sort((a, b) => b.finalScore - a.finalScore);
              setResults(finalScores);
            } else {
              room.updateSharedState({ currentRound: effectiveCurrentRound + 1 });
            }
          } else {
            const updatedPlayers = localPlayers.map((p) => {
              const floorPenalty = calculateFloorPenalty(p.floorTiles);
              const newScore = Math.max(0, p.score + p.roundScore + floorPenalty);
              return { ...p, score: newScore, roundScore: 0, floorTiles: 0, tilesPlacedThisRound: [] };
            });
            setLocalPlayers(updatedPlayers);
            if (gameWillEnd) {
              const finalScores = updatedPlayers.map((player) => {
                const endGameBonus = calculateEndGameBonuses(player.wall);
                const completions = countCompletions(player.wall);
                return { player, currentScore: player.score, endGameBonus, completions, finalScore: player.score + endGameBonus };
              }).sort((a, b) => b.finalScore - a.finalScore);
              setResults(finalScores);
            } else {
              setCurrentRound(currentRound + 1);
            }
          }
        },
      },
    ]);
  };

  const finishGame = () => {
    const finalScores = players.map((player) => {
      const floorPenalty = calculateFloorPenalty(player.floorTiles);
      const currentScore = Math.max(0, player.score + player.roundScore + floorPenalty);
      const endGameBonus = calculateEndGameBonuses(player.wall);
      const completions = countCompletions(player.wall);
      return { player, currentScore, endGameBonus, completions, finalScore: currentScore + endGameBonus };
    }).sort((a, b) => b.finalScore - a.finalScore);
    setResults(finalScores);
  };

  const resetGame = () => {
    if (room.isOnline && !room.isHost && !room.allCanEdit) return;
    Alert.alert('Reset Game', 'Are you sure you want to reset the entire game?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive',
        onPress: () => {
          const blank = { score: 0, wall: wallToFlat(createEmptyWall()), floorTiles: 0, roundScore: 0, tilesPlacedThisRound: [] };
          if (room.isOnline) {
            room.players.forEach((p) => room.updatePlayerData(p.id, blank));
            room.updateSharedState({ currentRound: 1 });
          } else {
            setLocalPlayers((prev) => prev.map((p) => ({ ...p, score: 0, wall: createEmptyWall(), floorTiles: 0, roundScore: 0, tilesPlacedThisRound: [] })));
            setCurrentRound(1);
          }
          setResults(null);
        },
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const canAdvanceRound = !room.isOnline || room.isHost || room.allCanEdit;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>🎨 Azul Scorer</Text>
          <Text style={[styles.roundText, { color: theme.colors.textSecondary }]}>Round {effectiveCurrentRound}</Text>
          <View style={styles.headerButtons}>
            {!room.isOnline && (
              <TouchableOpacity style={[styles.onlineBtn, { backgroundColor: theme.colors.primary }]} onPress={() => setShowRoomLobby(true)}>
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
                <View style={styles.playerInfo}>
                  {editingId === player.id && !room.isOnline ? (
                    <TextInput
                      style={[styles.nameInput, { color: theme.colors.text, borderBottomColor: theme.colors.primary }]}
                      value={player.name}
                      onChangeText={(text) => updatePlayerName(player.id, text)}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity onPress={() => !room.isOnline && setEditingId(player.id)}>
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
                {!room.isOnline && (
                  <TouchableOpacity style={[styles.removeButton, { backgroundColor: theme.colors.danger }]} onPress={() => removePlayer(player.id)}>
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Wall Grid */}
              <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>
                Wall (tap to place tiles - 1 per row/round)
                {room.isOnline && !canEdit(player.id) && ' • Read-only'}
              </Text>
              <View style={[styles.wallContainer, { backgroundColor: theme.dark ? '#1a1a2e' : '#E8E4E1' }]}>
                {player.wall.map((wallRow, rowIndex) => {
                  const rowPlacedThisRound = player.tilesPlacedThisRound?.includes(rowIndex);
                  return (
                    <View key={rowIndex} style={styles.wallRow}>
                      {wallRow.map((placed, colIndex) => {
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
                              },
                              !canEdit(player.id) && { opacity: 0.6 },
                            ]}
                            onPress={() => toggleWallTile(player.id, rowIndex, colIndex)}
                            disabled={!canEdit(player.id)}
                          >
                            {placed ? (
                              <Text style={styles.wallTileEmoji}>{tileInfo.emoji}</Text>
                            ) : (
                              <Text style={[styles.wallTileEmpty, { color: theme.dark ? '#555' : '#bbb' }]}>{tileInfo.emoji}</Text>
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
                    style={[styles.floorButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]}
                    onPress={() => adjustFloorTiles(player.id, -1)}
                    disabled={!canEdit(player.id)}
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
                            backgroundColor: index < player.floorTiles ? theme.colors.danger : (theme.dark ? '#333' : '#e0e0e0'),
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.floorTilePenalty, { color: index < player.floorTiles ? '#fff' : theme.colors.textTertiary }]}>
                          {penalty}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.floorButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]}
                    onPress={() => adjustFloorTiles(player.id, 1)}
                    disabled={!canEdit(player.id)}
                  >
                    <Text style={styles.floorButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* End game bonus preview */}
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

          {!room.isOnline && (
            <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.success }]} onPress={addPlayer}>
              <Text style={styles.addButtonText}>+ Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Round Controls */}
        <View style={styles.roundControls}>
          {canAdvanceRound ? (
            <TouchableOpacity style={[styles.endRoundButton, { backgroundColor: theme.colors.warning }]} onPress={endRound}>
              <Text style={styles.endRoundButtonText}>End Round {effectiveCurrentRound}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.endRoundButton, { backgroundColor: theme.colors.warning, opacity: 0.4 }]}>
              <Text style={styles.endRoundButtonText}>Waiting for host to end round…</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.finishGameButton, { backgroundColor: theme.colors.success }]} onPress={finishGame}>
            <Text style={styles.finishGameButtonText}>🏆 Finish Game</Text>
          </TouchableOpacity>
        </View>

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
            • All 5 of one color: +10 points
            {!room.isOnline ? '\n\n• Tap player names to edit' : ''}
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
                    <Text style={styles.resultMedal}>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}</Text>
                    <Text style={[styles.resultName, { color: theme.colors.text }]}>{result.player.name}</Text>
                    <Text style={[styles.resultTotal, { color: theme.colors.success }]}>{result.finalScore}</Text>
                  </View>
                  <View style={styles.breakdown}>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>Score: {result.currentScore}</Text>
                    <Text style={[styles.breakdownText, { color: theme.colors.textSecondary }]}>End Game Bonus: +{result.endGameBonus}</Text>
                    <Text style={[styles.breakdownDetail, { color: theme.colors.textTertiary }]}>({result.completions.rows} rows, {result.completions.cols} cols, {result.completions.colors} colors)</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.newGameButton, { backgroundColor: theme.colors.success }]} onPress={() => { setResults(null); resetGame(); }}>
                <Text style={styles.newGameButtonText}>New Game</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.colors.primary }]} onPress={() => setResults(null)}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <RoomLobby visible={showRoomLobby} onClose={() => setShowRoomLobby(false)} room={room} gameType="Azul" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  roundText: { fontSize: 16, marginBottom: 12 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  onlineBtn: { borderRadius: 8, padding: 8, justifyContent: 'center', alignItems: 'center' },
  resetButton: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  resetButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  playersSection: { marginBottom: 20 },
  playerCard: { borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1 },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  nameInput: { fontSize: 20, fontWeight: '600', borderBottomWidth: 2, minWidth: 150, padding: 0, marginBottom: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  totalScoreLabel: { fontSize: 14 },
  totalScore: { fontSize: 24, fontWeight: 'bold' },
  roundScorePreview: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  removeButton: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 24 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  wallContainer: { padding: 8, borderRadius: 8, alignSelf: 'center', marginBottom: 15 },
  wallRow: { flexDirection: 'row' },
  wallTile: { width: 44, height: 44, margin: 2, borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  wallTileEmoji: { fontSize: 24 },
  wallTileEmpty: { fontSize: 18, opacity: 0.3 },
  floorSection: { marginBottom: 10 },
  floorControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  floorButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  floorButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  floorTilesDisplay: { flexDirection: 'row', gap: 4 },
  floorTile: { width: 28, height: 28, borderRadius: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  floorTilePenalty: { fontSize: 12, fontWeight: 'bold' },
  completionPreview: { padding: 10, borderRadius: 8, marginTop: 10 },
  completionText: { fontSize: 12, textAlign: 'center' },
  addButton: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  roundControls: { gap: 12, marginBottom: 20 },
  endRoundButton: { borderRadius: 12, padding: 16, alignItems: 'center' },
  endRoundButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  finishGameButton: { borderRadius: 12, padding: 18, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  finishGameButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  infoSection: { padding: 15, borderRadius: 12, borderWidth: 1 },
  infoTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  infoText: { fontSize: 14, lineHeight: 22 },
  disabledBtn: { opacity: 0.4 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 20, padding: 20, maxHeight: '80%' },
  resultsTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 15 },
  resultsScroll: { maxHeight: 350 },
  resultCard: { padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  resultMedal: { fontSize: 24, marginRight: 10 },
  resultName: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  resultTotal: { fontSize: 28, fontWeight: 'bold' },
  breakdown: { paddingLeft: 10 },
  breakdownText: { fontSize: 14, marginBottom: 2 },
  breakdownDetail: { fontSize: 12, fontStyle: 'italic' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 15 },
  newGameButton: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  newGameButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeButton: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
