import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, Animated, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';
import { TICKET_TO_RIDE_COLORS as PLAYER_COLORS } from '../constants/colors';
import { ROUTE_POINTS } from '../constants/gameConfig';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';

export default function TicketToRideScreen() {
  const { theme } = useTheme();
  const room = useRoom('TicketToRide');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  // ── Offline state ────────────────────────────────────────────────────────────
  const [localPlayers, setLocalPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], color: PLAYER_COLORS[0], score: 0 },
    { id: 2, name: DEFAULT_PLAYER_NAMES[1], color: PLAYER_COLORS[1], score: 0 },
    { id: 3, name: DEFAULT_PLAYER_NAMES[2], color: PLAYER_COLORS[2], score: 0 },
    { id: 4, name: DEFAULT_PLAYER_NAMES[3], color: PLAYER_COLORS[3], score: 0 },
    { id: 5, name: DEFAULT_PLAYER_NAMES[4], color: PLAYER_COLORS[4], score: 0 },
  ]);
  const [editingId, setEditingId] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [showUndo, setShowUndo] = useState(false);
  const [showFinishGame, setShowFinishGame] = useState(false);
  const [showWinners, setShowWinners] = useState(false);
  const [longestRouteBonus, setLongestRouteBonus] = useState(10);
  const [customInputs, setCustomInputs] = useState({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const undoTimerRef = useRef(null);

  // ── Online helpers ───────────────────────────────────────────────────────────

  const canEdit = (playerId) =>
    !room.isOnline || room.allCanEdit || playerId === room.userId;

  const isOwn = (playerId) => !room.isOnline || playerId === room.userId;

  const getPlayerData = (playerId) => {
    const p = room.players.find((r) => r.id === playerId);
    return { score: p?.playerData?.score ?? 0 };
  };

  // Derive display players
  const players = room.isOnline
    ? [...room.players]
        .sort((a, b) => (b.id === room.userId ? 1 : 0) - (a.id === room.userId ? 1 : 0))
        .map((p, i) => ({
          id: p.id,
          name: p.displayName,
          color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          score: p.playerData?.score ?? 0,
          longestRoute: room.sharedState?.longestRouteHolder === p.id,
        }))
    : localPlayers;

  const activeLongestRouteBonus = room.isOnline
    ? (room.sharedState?.longestRouteBonus ?? longestRouteBonus)
    : longestRouteBonus;

  // In online mode default-select yourself; allow selecting others only with allCanEdit
  const effectiveSelectedId = room.isOnline
    ? (room.allCanEdit ? selectedPlayerId : room.userId)
    : selectedPlayerId;

  // ── Load / save ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadGameData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('ticketToRideGameData');
        if (savedData) {
          const data = JSON.parse(savedData);
          setLocalPlayers(data.players || localPlayers);
          setLongestRouteBonus(data.longestRouteBonus || 10);
        }
      } catch (err) {
        console.error('Error loading game data:', err);
      }
    };
    loadGameData();
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      room.deleteRoom();
    };
  }, []);

  useEffect(() => {
    if (room.isOnline) return;
    AsyncStorage.setItem('ticketToRideGameData', JSON.stringify({ players: localPlayers, longestRouteBonus })).catch(console.error);
  }, [localPlayers, longestRouteBonus, room.isOnline]);

  // ── Undo (offline only) ──────────────────────────────────────────────────────

  const showUndoButton = () => {
    setShowUndo(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowUndo(false);
        setLastAction(null);
      });
    }, 5000);
  };

  const undoLastAction = () => {
    if (lastAction?.type === 'route') {
      setLocalPlayers(lastAction.previousState);
      setSelectedPlayerId(lastAction.previousSelectedId);
      setLastAction(null);
      setShowUndo(false);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      fadeAnim.setValue(0);
    }
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const addRoutePoints = (trainLength) => {
    const targetId = effectiveSelectedId;
    if (!targetId) {
      Alert.alert('No Player Selected', 'Please select a player first');
      return;
    }
    const points = ROUTE_POINTS[trainLength];

    if (room.isOnline) {
      const pd = getPlayerData(targetId);
      room.updatePlayerData(targetId, { score: pd.score + points });
      if (room.allCanEdit) setSelectedPlayerId(null);
      // No undo in online mode
    } else {
      const previousState = [...localPlayers];
      const previousSelectedId = selectedPlayerId;
      setLocalPlayers((prev) =>
        prev.map((p) => (p.id === targetId ? { ...p, score: p.score + points } : p))
      );
      setLastAction({ type: 'route', playerId: targetId, points, previousState, previousSelectedId });
      setSelectedPlayerId(null);
      showUndoButton();
    }
  };

  const adjustScore = (id, delta) => {
    if (room.isOnline) {
      if (!canEdit(id)) return;
      const pd = getPlayerData(id);
      room.updatePlayerData(id, { score: Math.max(0, pd.score + delta) });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, score: Math.max(0, p.score + delta) } : p))
      );
    }
  };

  const adjustDestinationTickets = (id, delta) => {
    if (room.isOnline) {
      if (!canEdit(id)) return;
      const pd = getPlayerData(id);
      room.updatePlayerData(id, { score: pd.score + delta });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, score: p.score + delta } : p))
      );
    }
  };

  const applyCustomPoints = (id) => {
    const points = parseInt(customInputs[id] || '0');
    if (!isNaN(points) && points !== 0) {
      adjustDestinationTickets(id, points);
      setCustomInputs((prev) => ({ ...prev, [id]: '' }));
    }
  };

  const toggleLongestRoute = (id) => {
    if (room.isOnline) {
      if (!isOwn(id)) return;
      const bonus = activeLongestRouteBonus;
      const currentHolder = room.sharedState?.longestRouteHolder ?? null;

      // Remove bonus from previous holder if different
      if (currentHolder && currentHolder !== id) {
        const holderPd = getPlayerData(currentHolder);
        room.updatePlayerData(currentHolder, { score: holderPd.score - bonus });
      }

      if (currentHolder === id) {
        // Unclaim
        const pd = getPlayerData(id);
        room.updatePlayerData(id, { score: pd.score - bonus });
        room.updateSharedState({ ...(room.sharedState || {}), longestRouteHolder: null });
      } else {
        // Claim
        const pd = getPlayerData(id);
        room.updatePlayerData(id, { score: pd.score + bonus });
        room.updateSharedState({ ...(room.sharedState || {}), longestRouteHolder: id });
      }
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            const has = p.longestRoute || false;
            return { ...p, longestRoute: !has, score: has ? p.score - longestRouteBonus : p.score + longestRouteBonus };
          } else if (p.longestRoute) {
            return { ...p, longestRoute: false, score: p.score - longestRouteBonus };
          }
          return p;
        })
      );
    }
  };

  const setOnlineLongestRouteBonus = (delta) => {
    if (!room.isHost && !room.allCanEdit) return;
    const current = activeLongestRouteBonus;
    const next = Math.max(1, current + delta);
    room.updateSharedState({ ...(room.sharedState || {}), longestRouteBonus: next });
  };

  const resetGame = () => {
    Alert.alert('Reset Game', 'Reset all scores and start over?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setSelectedPlayerId(null);
          setLastAction(null);
          setShowUndo(false);
          setShowFinishGame(false);
          setShowWinners(false);
          setCustomInputs({});
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
          fadeAnim.setValue(0);

          if (room.isOnline) {
            if (!room.isHost && !room.allCanEdit) return;
            room.players.forEach((p) => room.updatePlayerData(p.id, { score: 0 }));
            room.updateSharedState({ longestRouteHolder: null, longestRouteBonus: activeLongestRouteBonus });
          } else {
            setLocalPlayers((prev) =>
              prev.map((p) => ({ ...p, score: 0, longestRoute: false }))
            );
          }
        },
      },
    ]);
  };

  const addPlayer = () => {
    if (localPlayers.length >= 5) {
      Alert.alert('Maximum Players', 'Ticket to Ride supports up to 5 players');
      return;
    }
    const usedColors = localPlayers.map((p) => p.color.name);
    const color = PLAYER_COLORS.find((c) => !usedColors.includes(c.name)) || PLAYER_COLORS[0];
    const newId = Math.max(...localPlayers.map((p) => p.id), 0) + 1;
    setLocalPlayers((prev) => [...prev, { id: newId, name: `Player ${newId}`, color, score: 0 }]);
  };

  const removePlayer = (id) => {
    if (localPlayers.length <= 1) {
      Alert.alert('Cannot Remove', 'You need at least one player!');
      return;
    }
    setLocalPlayers((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlayerId === id) setSelectedPlayerId(localPlayers[0].id);
  };

  const updateName = (id, newName) => {
    setLocalPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)));
  };

  const getSortedPlayers = () => [...players].sort((a, b) => b.score - a.score);
  const getMedalEmoji = (i) => ['🥇', '🥈', '🥉'][i] || '';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Ticket to Ride Scorer</Text>
          <View style={styles.headerRow}>
            {!room.isOnline && (
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowRoomLobby(true)}
              >
                <Ionicons name="wifi" size={16} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.resetButton, { backgroundColor: theme.colors.danger }]}
              onPress={resetGame}
            >
              <Text style={styles.resetButtonText}>Reset Game</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Players */}
        <View style={styles.playersSection}>
          {players.map((player) => {
            const isMe = player.id === room.userId && room.isOnline;
            const editable = canEdit(player.id);
            const isSelected = effectiveSelectedId === player.id;

            return (
              <TouchableOpacity
                key={player.id}
                style={[
                  styles.playerCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  isSelected && [styles.playerCardSelected, { backgroundColor: theme.dark ? '#1a3a5c' : '#E8F4FF', borderColor: theme.colors.primary }],
                  { borderLeftColor: player.color.color, borderLeftWidth: 6 },
                ]}
                onPress={() => {
                  if (room.isOnline && !room.allCanEdit) return; // selection locked to self
                  setSelectedPlayerId(isSelected ? null : player.id);
                }}
                activeOpacity={room.isOnline && !room.allCanEdit ? 1 : 0.7}
              >
                <View style={styles.playerHeader}>
                  <View style={styles.playerInfo}>
                    {editingId === player.id && !room.isOnline ? (
                      <TextInput
                        style={[styles.nameInput, { color: theme.colors.text, borderBottomColor: theme.colors.primary }]}
                        value={player.name}
                        onChangeText={(text) => updateName(player.id, text)}
                        onBlur={() => setEditingId(null)}
                        autoFocus
                      />
                    ) : (
                      <TouchableOpacity onPress={() => !room.isOnline && setEditingId(player.id)}>
                        <Text style={[styles.playerName, { color: theme.colors.text }]}>
                          {player.name}{isMe ? ' (You)' : ''}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <View style={[styles.colorBadge, { backgroundColor: player.color.color }]}>
                      <Text style={styles.colorText}>{player.color.name}</Text>
                    </View>
                  </View>
                  {!room.isOnline && (
                    <TouchableOpacity
                      style={[styles.removeButton, { backgroundColor: theme.colors.danger }]}
                      onPress={() => removePlayer(player.id)}
                    >
                      <Text style={styles.removeButtonText}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.scoreContainer}>
                  <TouchableOpacity
                    style={[styles.scoreButton, { backgroundColor: editable ? theme.colors.primary : theme.colors.border }]}
                    onPress={() => adjustScore(player.id, -1)}
                    disabled={!editable}
                  >
                    <Text style={styles.scoreButtonText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.scoreDisplay}>
                    <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>Score</Text>
                    <Text style={[styles.scoreNumber, { color: theme.colors.primary }]}>{player.score}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.scoreButton, { backgroundColor: editable ? theme.colors.primary : theme.colors.border }]}
                    onPress={() => adjustScore(player.id, 1)}
                    disabled={!editable}
                  >
                    <Text style={styles.scoreButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {!room.isOnline && (
            <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.success }]} onPress={addPlayer}>
              <Text style={styles.addButtonText}>+ Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Route Scoring */}
        <View style={[styles.routeSection, { backgroundColor: theme.dark ? '#3d3a1f' : '#FFF9E6' }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Claim Route</Text>

          {room.isOnline && !room.allCanEdit ? (
            <View style={[styles.selectedPlayerIndicator, { backgroundColor: theme.colors.surface, borderColor: '#FFD700' }]}>
              <Text style={[styles.selectedPlayerLabel, { color: theme.colors.textSecondary }]}>Adding points to:</Text>
              <Text style={[styles.selectedPlayerName, { color: theme.colors.text }]}>
                {players.find((p) => p.id === room.userId)?.name} (You)
              </Text>
            </View>
          ) : effectiveSelectedId ? (
            <View style={[styles.selectedPlayerIndicator, { backgroundColor: theme.colors.surface, borderColor: '#FFD700' }]}>
              <Text style={[styles.selectedPlayerLabel, { color: theme.colors.textSecondary }]}>Selected Player:</Text>
              <View style={styles.selectedPlayerBadge}>
                <View style={[styles.selectedPlayerColorDot, { backgroundColor: players.find((p) => p.id === effectiveSelectedId)?.color.color, borderColor: theme.colors.border }]} />
                <Text style={[styles.selectedPlayerName, { color: theme.colors.text }]}>
                  {players.find((p) => p.id === effectiveSelectedId)?.name}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
              Select player above, then tap route length:
            </Text>
          )}

          <View style={styles.routeButtons}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((length) => (
              <TouchableOpacity
                key={length}
                style={[styles.routeButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => addRoutePoints(length)}
              >
                <Text style={styles.routeLength}>{length}</Text>
                <Text style={styles.routePoints}>+{ROUTE_POINTS[length]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Undo (offline only) */}
        {!room.isOnline && showUndo && (
          <Animated.View style={[styles.undoContainer, { opacity: fadeAnim }]}>
            <TouchableOpacity style={[styles.undoButton, { backgroundColor: theme.colors.warning }]} onPress={undoLastAction}>
              <Text style={styles.undoText}>↺ Undo Last Route</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Finish Game */}
        <TouchableOpacity
          style={[styles.finishGameButton, { backgroundColor: theme.colors.success }]}
          onPress={() => setShowFinishGame(!showFinishGame)}
        >
          <Text style={styles.finishGameText}>
            {showFinishGame ? '▼ Hide Final Scoring' : '▶ Finish Game & Final Scoring'}
          </Text>
        </TouchableOpacity>

        {showFinishGame && (
          <View style={[styles.finalScoringSection, { backgroundColor: theme.dark ? '#1a2f3d' : '#F0F9FF', borderColor: theme.colors.success }]}>
            <Text style={[styles.finalScoringTitle, { color: theme.colors.text }]}>Destination Tickets & Bonuses</Text>

            {/* Longest route bonus config */}
            <View style={[styles.longestRouteBonusConfig, { backgroundColor: theme.colors.surface, borderColor: '#FFD700' }]}>
              <Text style={[styles.bonusConfigLabel, { color: theme.colors.text }]}>Longest Route Bonus:</Text>
              <View style={styles.bonusConfigControls}>
                <TouchableOpacity
                  style={[styles.bonusBtn, (!room.isOnline || room.isHost || room.allCanEdit) ? {} : { opacity: 0.4 }]}
                  onPress={() => room.isOnline ? setOnlineLongestRouteBonus(-1) : setLongestRouteBonus((v) => Math.max(1, v - 1))}
                  disabled={room.isOnline && !room.isHost && !room.allCanEdit}
                >
                  <Text style={styles.bonusBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.bonusValue}>{activeLongestRouteBonus}</Text>
                <TouchableOpacity
                  style={[styles.bonusBtn, (!room.isOnline || room.isHost || room.allCanEdit) ? {} : { opacity: 0.4 }]}
                  onPress={() => room.isOnline ? setOnlineLongestRouteBonus(1) : setLongestRouteBonus((v) => v + 1)}
                  disabled={room.isOnline && !room.isHost && !room.allCanEdit}
                >
                  <Text style={styles.bonusBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {players.map((player) => {
              const editable = canEdit(player.id);
              const own = isOwn(player.id);
              return (
                <View key={`final-${player.id}`} style={[styles.finalPlayerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={[styles.playerColorBar, { backgroundColor: player.color.color }]} />
                  <View style={styles.finalPlayerContent}>
                    <Text style={[styles.finalPlayerName, { color: theme.colors.text }]}>
                      {player.name}{player.id === room.userId && room.isOnline ? ' (You)' : ''}
                    </Text>

                    <View style={styles.destinationTicketSection}>
                      <Text style={[styles.destinationLabel, { color: theme.colors.textSecondary }]}>Destination Tickets:</Text>
                      <View style={styles.destinationControls}>
                        {[1, 5, 10].map((v) => (
                          <TouchableOpacity
                            key={`+${v}`}
                            style={[styles.ticketButtonSmall, { backgroundColor: editable ? theme.colors.success : theme.colors.border }]}
                            onPress={() => adjustDestinationTickets(player.id, v)}
                            disabled={!editable}
                          >
                            <Text style={styles.ticketButtonText}>+{v}</Text>
                          </TouchableOpacity>
                        ))}
                        {[1, 5, 10].map((v) => (
                          <TouchableOpacity
                            key={`-${v}`}
                            style={[styles.ticketButtonSmall, { backgroundColor: editable ? theme.colors.danger : theme.colors.border }]}
                            onPress={() => adjustDestinationTickets(player.id, -v)}
                            disabled={!editable}
                          >
                            <Text style={styles.ticketButtonText}>-{v}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {editable && (
                        <View style={styles.customInputContainer}>
                          <TextInput
                            style={[styles.customInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                            placeholder="Custom"
                            placeholderTextColor={theme.colors.textTertiary}
                            keyboardType="numeric"
                            value={customInputs[player.id] || ''}
                            onChangeText={(text) => setCustomInputs((prev) => ({ ...prev, [player.id]: text }))}
                          />
                          <TouchableOpacity
                            style={[styles.applyButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => applyCustomPoints(player.id)}
                          >
                            <Text style={styles.applyButtonText}>Apply</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Longest Route — interactive only on own card */}
                    <TouchableOpacity
                      style={[
                        styles.longestRouteButton,
                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                        player.longestRoute && styles.longestRouteButtonActive,
                        !own && { opacity: 0.5 },
                      ]}
                      onPress={() => toggleLongestRoute(player.id)}
                      disabled={!own}
                    >
                      <Text style={[styles.longestRouteText, { color: theme.colors.textSecondary }, player.longestRoute && styles.longestRouteTextActive]}>
                        {player.longestRoute ? `✓ Longest Route (+${activeLongestRouteBonus})` : 'Longest Route'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            <View style={[styles.finalScoreInfo, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.finalScoreInfoText, { color: theme.colors.textSecondary }]}>
                {'• Use quick buttons or custom input for destination tickets\n• Only ONE player can have the Longest Route bonus\n'}
                {room.isOnline ? '• Tap the Longest Route button on your own card to claim it' : '• Adjust Longest Route bonus value if needed (default: 10)'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.showWinnersButton, { backgroundColor: theme.colors.warning }]}
              onPress={() => setShowWinners(true)}
            >
              <Text style={styles.showWinnersButtonText}>🎉 Finish the Game & Show Winners 🎉</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info */}
        <View style={[styles.infoSection, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Scoring Guide</Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
            {'Route Points:\n• 1 train = 1 point\n• 2 trains = 2 points\n• 3 trains = 4 points\n• 4 trains = 7 points\n• 5 trains = 10 points\n• 6 trains = 15 points\n• 7 trains = 18 points\n• 8 trains = 21 points'}
          </Text>
        </View>
      </ScrollView>

      {/* Winners modal */}
      <Modal visible={showWinners} transparent animationType="fade" onRequestClose={() => setShowWinners(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.winnersModal, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.winnersTitle, { color: theme.colors.text }]}>🎉 Game Finished! 🎉</Text>
            <Text style={[styles.winnersSubtitle, { color: theme.colors.textSecondary }]}>Final Rankings</Text>
            <View style={styles.podiumContainer}>
              {getSortedPlayers().slice(0, 3).map((player, index) => (
                <View key={player.id} style={[styles.podiumPlace, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={styles.medalEmoji}>{getMedalEmoji(index)}</Text>
                  <View style={styles.podiumPlayerInfo}>
                    <Text style={[styles.podiumRank, { color: theme.colors.text }]}>
                      {index + 1}{['st', 'nd', 'rd'][index] || 'th'} Place
                    </Text>
                    <View style={[styles.podiumColorBadge, { backgroundColor: player.color.color }]}>
                      <Text style={styles.podiumColorText}>{player.color.name}</Text>
                    </View>
                    <Text style={[styles.podiumPlayerName, { color: theme.colors.primary }]}>{player.name}</Text>
                    <Text style={[styles.podiumScore, { color: theme.colors.textSecondary }]}>{player.score} points</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.colors.primary }]} onPress={() => setShowWinners(false)}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <RoomLobby
        visible={showRoomLobby}
        onClose={() => setShowRoomLobby(false)}
        room={room}
        gameType="TicketToRide"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  headerContainer: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  resetButton: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  resetButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  playersSection: { marginBottom: 25 },
  playerCard: { borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1 },
  playerCardSelected: { borderWidth: 2 },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 20, fontWeight: '600', marginBottom: 6 },
  nameInput: { fontSize: 20, fontWeight: '600', borderBottomWidth: 2, marginBottom: 6, padding: 0 },
  colorBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  colorText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  removeButton: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 24 },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  scoreButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  scoreDisplay: { alignItems: 'center', flex: 1 },
  scoreLabel: { fontSize: 14, marginBottom: 5 },
  scoreNumber: { fontSize: 36, fontWeight: 'bold' },
  addButton: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  routeSection: { padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 2, borderColor: '#FFD700' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  sectionSubtitle: { fontSize: 14, marginBottom: 15 },
  selectedPlayerIndicator: { borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1 },
  selectedPlayerLabel: { fontSize: 12, marginBottom: 6, fontWeight: '600' },
  selectedPlayerBadge: { flexDirection: 'row', alignItems: 'center' },
  selectedPlayerColorDot: { width: 16, height: 16, borderRadius: 8, marginRight: 8, borderWidth: 1 },
  selectedPlayerName: { fontSize: 16, fontWeight: '600' },
  routeButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  routeButton: { width: '23%', aspectRatio: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  routeLength: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  routePoints: { color: '#fff', fontSize: 10, marginTop: 2 },

  undoContainer: { marginBottom: 20 },
  undoButton: { borderRadius: 12, padding: 15, alignItems: 'center' },
  undoText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  finishGameButton: { borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 20 },
  finishGameText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  finalScoringSection: { padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 2 },
  finalScoringTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  longestRouteBonusConfig: { padding: 12, borderRadius: 8, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1 },
  bonusConfigLabel: { fontSize: 14, fontWeight: '600' },
  bonusConfigControls: { flexDirection: 'row', alignItems: 'center' },
  bonusBtn: { backgroundColor: '#FFD700', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  bonusBtnText: { color: '#333', fontSize: 18, fontWeight: 'bold' },
  bonusValue: { fontSize: 20, fontWeight: 'bold', color: '#FFD700', marginHorizontal: 12, minWidth: 30, textAlign: 'center' },

  finalPlayerCard: { borderRadius: 10, marginBottom: 15, overflow: 'hidden', borderWidth: 1, flexDirection: 'row' },
  playerColorBar: { width: 6 },
  finalPlayerContent: { flex: 1, padding: 12 },
  finalPlayerName: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  destinationTicketSection: { marginBottom: 10 },
  destinationLabel: { fontSize: 14, marginBottom: 8 },
  destinationControls: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 4 },
  ticketButtonSmall: { flex: 1, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 6, alignItems: 'center' },
  ticketButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  customInputContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  customInput: { flex: 1, borderWidth: 1, borderRadius: 6, padding: 8, marginRight: 8, fontSize: 14 },
  applyButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  applyButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  longestRouteButton: { padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 2 },
  longestRouteButtonActive: { backgroundColor: '#FFD700', borderColor: '#FFA500' },
  longestRouteText: { fontSize: 14, fontWeight: '600' },
  longestRouteTextActive: { color: '#333' },
  finalScoreInfo: { padding: 12, borderRadius: 8, marginTop: 10 },
  finalScoreInfoText: { fontSize: 12, lineHeight: 18 },
  showWinnersButton: { borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 15 },
  showWinnersButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  infoSection: { padding: 15, borderRadius: 12, borderWidth: 1 },
  text: { fontSize: 14, lineHeight: 22 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  winnersModal: { borderRadius: 16, padding: 20, width: '100%', maxWidth: 380 },
  winnersTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  winnersSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 18, fontWeight: '600' },
  podiumContainer: { marginBottom: 18 },
  podiumPlace: { borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 2, alignItems: 'center' },
  medalEmoji: { fontSize: 36, marginBottom: 6 },
  podiumPlayerInfo: { alignItems: 'center', width: '100%' },
  podiumRank: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  podiumColorBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 6 },
  podiumColorText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  podiumPlayerName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  podiumScore: { fontSize: 16, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', justifyContent: 'center' },
  closeButton: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32, minWidth: 120, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
