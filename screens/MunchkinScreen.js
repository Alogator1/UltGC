import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';

export default function MunchkinScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { isPremium } = useSubscription();
  const room = useRoom('Munchkin');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  // ── Offline state ─────────────────────────────────────────────────────────────
  const [localPlayers, setLocalPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], level: 1, gear: 0 },
    { id: 2, name: DEFAULT_PLAYER_NAMES[1], level: 1, gear: 0 },
    { id: 3, name: DEFAULT_PLAYER_NAMES[2], level: 1, gear: 0 },
    { id: 4, name: DEFAULT_PLAYER_NAMES[3], level: 1, gear: 0 },
  ]);
  const [editingId, setEditingId] = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const [winner, setWinner] = useState(null);
  const winnerAlertedRef = useRef(null);

  // ── Battle modal state ────────────────────────────────────────────────────────
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [battleStep, setBattleStep] = useState('selectPlayer');
  const [localBattle, setLocalBattle] = useState({ players: [], monsters: [] });
  const [monsterStrengthInput, setMonsterStrengthInput] = useState('');
  const monsterInputRef = useRef(null);

  // ── Online helpers ────────────────────────────────────────────────────────────

  const canEdit = (playerId) =>
    !room.isOnline || room.allCanEdit || playerId === room.userId;

  const getPlayerData = (playerId) => {
    const p = room.players.find((r) => r.id === playerId);
    return { level: p?.playerData?.level ?? 1, gear: p?.playerData?.gear ?? 0 };
  };

  // Derive display players
  const players = room.isOnline
    ? [...room.players]
        .sort((a, b) => (b.id === room.userId ? 1 : 0) - (a.id === room.userId ? 1 : 0))
        .map((p) => ({
          id: p.id,
          name: p.displayName,
          level: p.playerData?.level ?? 1,
          gear: p.playerData?.gear ?? 0,
        }))
    : localPlayers;

  // ── Online battle derived state ────────────────────────────────────────────────
  const activeBattle = room.isOnline ? (room.sharedState?.activeBattle ?? null) : null;
  const iAmAttacker = activeBattle?.attackerId === room.userId;
  const iAmParticipant = activeBattle?.participants?.some((p) => p.playerId === room.userId);
  const myHelpRequest = activeBattle?.helpRequests?.[room.userId]; // 'pending' | 'accepted' | 'declined' | undefined
  const prevHelpRequestRef = useRef(undefined);

  // Unified battle state: normalize online 'participants' → 'players' for all rendering/calc code
  const battle = room.isOnline
    ? { players: activeBattle?.participants ?? [], monsters: activeBattle?.monsters ?? [] }
    : localBattle;

  const setBattle = (newBattle) => {
    if (room.isOnline) {
      room.updateSharedState({
        ...room.sharedState,
        activeBattle: { ...activeBattle, participants: newBattle.players, monsters: newBattle.monsters },
      });
    } else {
      setLocalBattle(newBattle);
    }
  };

  // ── Persistence ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadGameData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('munchkinGameData');
        if (savedData) {
          const data = JSON.parse(savedData);
          setLocalPlayers((data.players || []).map((p) => ({ ...p, gear: p.gear ?? 0 })));
        }
      } catch (err) {
        console.error('Error loading game data:', err);
      }
    };
    loadGameData();
    if (route.params?.joinRoomOnly && !isPremium) setShowRoomLobby(true);
    return () => { room.deleteRoom(); };
  }, []);

  const handleCloseLobby = () => {
    setShowRoomLobby(false);
    if (route.params?.joinRoomOnly && !room.isOnline) navigation.goBack();
  };

  useEffect(() => {
    if (room.isOnline) return;
    AsyncStorage.setItem('munchkinGameData', JSON.stringify({ players: localPlayers })).catch(console.error);
  }, [localPlayers, room.isOnline]);

  // ── Online: winner detection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!room.isOnline) return;
    for (const p of room.players) {
      const level = p.playerData?.level ?? 1;
      if (level >= 10 && winnerAlertedRef.current !== p.id) {
        winnerAlertedRef.current = p.id;
        setWinner({ id: p.id, name: p.displayName });
        setShowWinner(true);
      }
    }
  }, [room.players, room.isOnline]);

  // ── Online: help request notification ─────────────────────────────────────────
  useEffect(() => {
    if (!room.isOnline) return;
    if (myHelpRequest !== 'pending') { prevHelpRequestRef.current = myHelpRequest; return; }
    if (prevHelpRequestRef.current === 'pending') return; // already showed alert
    prevHelpRequestRef.current = 'pending';

    const attacker = room.players.find((p) => p.id === activeBattle?.attackerId);
    const monsterTotal = (activeBattle?.monsters ?? []).reduce(
      (s, m) => s + calcEntityStrength(m), 0
    );
    const playerTotal = (activeBattle?.participants ?? []).reduce(
      (s, p) => s + calcEntityStrength(p), 0
    );

    Alert.alert(
      '⚔️ Help Request!',
      `${attacker?.displayName ?? 'Someone'} needs help!\n\nMonster strength: ${monsterTotal}\nCurrent player strength: ${playerTotal}\n\nWill you join the battle?`,
      [
        {
          text: 'Decline',
          style: 'cancel',
          onPress: () => respondToHelp(false),
        },
        {
          text: 'Accept! ⚔️',
          onPress: () => respondToHelp(true),
        },
      ]
    );
  }, [myHelpRequest]);

  // ── Player management (offline only) ──────────────────────────────────────────

  const addPlayer = () => {
    const newId = Math.max(...localPlayers.map((p) => p.id), 0) + 1;
    setLocalPlayers([...localPlayers, { id: newId, name: `Player ${newId}`, level: 1, gear: 0 }]);
  };

  const removePlayer = (id) => {
    if (localPlayers.length <= 1) { Alert.alert('Cannot Remove', 'You need at least one player!'); return; }
    setLocalPlayers(localPlayers.filter((p) => p.id !== id));
  };

  const updateName = (id, newName) => {
    setLocalPlayers(localPlayers.map((p) => (p.id === id ? { ...p, name: newName } : p)));
  };

  // ── Level / gear mutations ─────────────────────────────────────────────────────

  const updateLevel = (id, delta) => {
    if (room.isOnline) {
      if (!canEdit(id)) return;
      const pd = getPlayerData(id);
      const newLevel = Math.max(1, Math.min(10, pd.level + delta));
      room.updatePlayerData(id, { ...pd, level: newLevel });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const newLevel = Math.max(1, Math.min(10, p.level + delta));
          if (newLevel === 10 && p.level !== 10) {
            winnerAlertedRef.current = p.id;
            setWinner(p);
            setShowWinner(true);
          }
          return { ...p, level: newLevel };
        })
      );
    }
  };

  const updateGear = (id, delta) => {
    if (room.isOnline) {
      if (!canEdit(id)) return;
      const pd = getPlayerData(id);
      room.updatePlayerData(id, { ...pd, gear: pd.gear + delta });
    } else {
      setLocalPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, gear: p.gear + delta } : p))
      );
    }
  };

  const resetGame = () => {
    if (room.isOnline && !room.isHost && !room.allCanEdit) return;
    Alert.alert('Reset Game', 'Reset all players to Level 1?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          if (room.isOnline) {
            room.players.forEach((p) => room.updatePlayerData(p.id, { level: 1, gear: 0 }));
            room.updateSharedState({ activeBattle: null });
          } else {
            setLocalPlayers((prev) => prev.map((p) => ({ ...p, level: 1, gear: 0 })));
          }
          winnerAlertedRef.current = null;
          setShowWinner(false);
          setWinner(null);
        },
      },
    ]);
  };

  // ── Battle helpers ─────────────────────────────────────────────────────────────

  const calcEntityStrength = (entity) => {
    const bonusTotal = (entity.bonuses ?? []).reduce(
      (s, b) => s + (b.isNegative ? -(b.value || 0) : (b.value || 0)), 0
    );
    return (entity.baseStrength ?? entity.strength ?? 0) + bonusTotal;
  };

  const getPlayersTotalStrength = () =>
    (battle.players ?? []).reduce((s, p) => s + calcEntityStrength(p), 0);
  const getMonstersTotalStrength = () =>
    (battle.monsters ?? []).reduce((s, m) => s + calcEntityStrength(m), 0);

  // ── Offline battle functions ───────────────────────────────────────────────────

  const startBattle = () => {
    if (room.isOnline && activeBattle) {
      // Battle already active — open the viewer
      setShowBattleModal(true);
      setBattleStep('battleCalculation');
      return;
    }
    setLocalBattle({ players: [], monsters: [] });
    setMonsterStrengthInput('');
    setBattleStep('selectPlayer');
    setShowBattleModal(true);
  };

  const selectPlayerForBattle = (player) => {
    const entry = {
      playerId: player.id,
      name: player.name,
      baseStrength: player.level + player.gear,
      bonuses: [],
    };
    if (room.isOnline) {
      // Create the activeBattle in sharedState
      const newBattle = {
        id: Date.now(),
        attackerId: room.userId,
        participants: [entry],
        monsters: [],
        helpRequests: {},
        status: 'active',
      };
      room.updateSharedState({ ...room.sharedState, activeBattle: newBattle });
    } else {
      setLocalBattle({ players: [entry], monsters: [] });
    }
    setMonsterStrengthInput('');
    setBattleStep('enterMonster');
  };

  const addMonsterToBattle = () => {
    const strength = parseInt(monsterStrengthInput) || 0;
    if (strength === 0) { Alert.alert('Invalid Input', 'Please enter a valid monster strength'); return; }
    const newMonster = { id: Date.now(), strength, bonuses: [] };
    setBattle({ ...battle, monsters: [...(battle.monsters ?? []), newMonster] });
    setMonsterStrengthInput('');
    setBattleStep('battleCalculation');
  };

  const addPlayerToBattle = (player) => {
    if ((battle.players ?? []).find((p) => p.playerId === player.id)) {
      Alert.alert('Already in Battle', `${player.name} is already in this battle`);
      return;
    }
    const entry = { playerId: player.id, name: player.name, baseStrength: player.level + player.gear, bonuses: [] };
    setBattle({ ...battle, players: [...(battle.players ?? []), entry] });
  };

  const addBonusToPlayer = (playerId, value) => {
    const isNegative = value < 0;
    setBattle({
      ...battle,
      players: (battle.players ?? []).map((p) =>
        p.playerId === playerId ? { ...p, bonuses: [...p.bonuses, { value: Math.abs(value), isNegative }] } : p
      ),
    });
  };

  const updatePlayerBonus = (playerId, bonusIndex, value) => {
    const numValue = parseInt(value.replace(/[^0-9]/g, '')) || 0;
    setBattle({
      ...battle,
      players: (battle.players ?? []).map((p) =>
        p.playerId === playerId
          ? { ...p, bonuses: p.bonuses.map((b, i) => (i === bonusIndex ? { ...b, value: numValue } : b)) }
          : p
      ),
    });
  };

  const removePlayerBonus = (playerId, bonusIndex) => {
    setBattle({
      ...battle,
      players: (battle.players ?? []).map((p) =>
        p.playerId === playerId ? { ...p, bonuses: p.bonuses.filter((_, i) => i !== bonusIndex) } : p
      ),
    });
  };

  const addBonusToMonster = (monsterId, value) => {
    const isNegative = value < 0;
    setBattle({
      ...battle,
      monsters: (battle.monsters ?? []).map((m) =>
        m.id === monsterId ? { ...m, bonuses: [...m.bonuses, { value: Math.abs(value), isNegative }] } : m
      ),
    });
  };

  const updateMonsterBonus = (monsterId, bonusIndex, value) => {
    const numValue = parseInt(value.replace(/[^0-9]/g, '')) || 0;
    setBattle({
      ...battle,
      monsters: (battle.monsters ?? []).map((m) =>
        m.id === monsterId
          ? { ...m, bonuses: m.bonuses.map((b, i) => (i === bonusIndex ? { ...b, value: numValue } : b)) }
          : m
      ),
    });
  };

  const removeMonsterBonus = (monsterId, bonusIndex) => {
    setBattle({
      ...battle,
      monsters: (battle.monsters ?? []).map((m) =>
        m.id === monsterId ? { ...m, bonuses: m.bonuses.filter((_, i) => i !== bonusIndex) } : m
      ),
    });
  };

  const removePlayerFromBattle = (playerId) => {
    if ((battle.players ?? []).length <= 1) { Alert.alert('Cannot Remove', 'At least one player must be in the battle'); return; }
    setBattle({ ...battle, players: (battle.players ?? []).filter((p) => p.playerId !== playerId) });
  };

  const removeMonsterFromBattle = (monsterId) => {
    if ((battle.monsters ?? []).length <= 1) { Alert.alert('Cannot Remove', 'At least one monster must be in the battle'); return; }
    setBattle({ ...battle, monsters: (battle.monsters ?? []).filter((m) => m.id !== monsterId) });
  };

  const closeBattle = () => {
    setShowBattleModal(false);
    setBattleStep('selectPlayer');
    if (!room.isOnline) {
      setLocalBattle({ players: [], monsters: [] });
      setMonsterStrengthInput('');
    }
    // Online: don't clear activeBattle — battle stays alive for others to see
  };

  // ── Online-only battle functions ──────────────────────────────────────────────

  const requestHelp = (targetPlayer) => {
    if (!activeBattle || !iAmAttacker) return;
    const updated = {
      ...activeBattle,
      helpRequests: { ...activeBattle.helpRequests, [targetPlayer.id]: 'pending' },
    };
    room.updateSharedState({ ...room.sharedState, activeBattle: updated });
    Alert.alert('Help Requested', `Asked ${targetPlayer.name} to join the battle.`);
  };

  const respondToHelp = (accept) => {
    if (!activeBattle) return;
    const myPlayer = players.find((p) => p.id === room.userId);
    const updatedRequests = { ...activeBattle.helpRequests, [room.userId]: accept ? 'accepted' : 'declined' };

    let updatedParticipants = activeBattle.participants ?? [];
    if (accept && myPlayer && !updatedParticipants.find((p) => p.playerId === room.userId)) {
      updatedParticipants = [
        ...updatedParticipants,
        { playerId: room.userId, name: myPlayer.name, baseStrength: myPlayer.level + myPlayer.gear, bonuses: [] },
      ];
    }

    room.updateSharedState({
      ...room.sharedState,
      activeBattle: { ...activeBattle, helpRequests: updatedRequests, participants: updatedParticipants },
    });

    if (accept) {
      setShowBattleModal(true);
      setBattleStep('battleCalculation');
    }
  };

  const resolveBattle = () => {
    if (!activeBattle) return;
    const pTotal = getPlayersTotalStrength();
    const mTotal = getMonstersTotalStrength();
    const playersWin = pTotal > mTotal;

    if (playersWin) {
      Alert.alert(
        '🎉 Players Win!',
        `Players (${pTotal}) defeated the monster (${mTotal})!\n\nThe attacker gains 1 level. Helpers may negotiate their rewards.`,
        [
          {
            text: 'Apply & Close',
            onPress: () => {
              // Auto +1 level to attacker
              const pd = getPlayerData(activeBattle.attackerId);
              room.updatePlayerData(activeBattle.attackerId, { ...pd, level: Math.min(10, pd.level + 1) });
              // Clear battle
              room.updateSharedState({ ...room.sharedState, activeBattle: null });
              setShowBattleModal(false);
              setBattleStep('selectPlayer');
            },
          },
        ]
      );
    } else if (pTotal === mTotal) {
      Alert.alert('⚖️ Tie!', 'Players and monster are tied. No effect — adjust bonuses and try again.');
    } else {
      Alert.alert(
        '👹 Monster Wins!',
        `Monster (${mTotal}) defeated the players (${pTotal})!\n\nPlayers must run away. Host can apply bad stuff manually.`,
        [
          { text: 'Keep Battle Open', style: 'cancel' },
          {
            text: 'Close Battle',
            style: 'destructive',
            onPress: () => {
              room.updateSharedState({ ...room.sharedState, activeBattle: null });
              setShowBattleModal(false);
              setBattleStep('selectPlayer');
            },
          },
        ]
      );
    }
  };

  const cancelOnlineBattle = () => {
    Alert.alert('Cancel Battle', 'End this battle without result?', [
      { text: 'Keep Fighting', style: 'cancel' },
      {
        text: 'Cancel Battle',
        style: 'destructive',
        onPress: () => {
          room.updateSharedState({ ...room.sharedState, activeBattle: null });
          setShowBattleModal(false);
          setBattleStep('selectPlayer');
        },
      },
    ]);
  };

  // Can the current user edit player bonuses in battle?
  const canEditPlayerBonus = (playerId) =>
    !room.isOnline || room.allCanEdit || playerId === room.userId;

  // Can the current user edit monster bonuses? (attacker or allCanEdit for backstabbing)
  const canEditMonsterBonus = () => !room.isOnline || room.allCanEdit || iAmAttacker;

  // Can current user add monsters?
  const canAddMonster = () => !room.isOnline || iAmAttacker;

  // ── Render ────────────────────────────────────────────────────────────────────

  const renderPlayerCard = (player) => (
    <View
      key={player.id}
      style={[
        styles.playerCard,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        player.id === room.userId && room.isOnline && { borderColor: theme.colors.primary, borderWidth: 2 },
      ]}
    >
      <View style={styles.playerHeader}>
        {editingId === player.id && !room.isOnline ? (
          <TextInput
            style={[styles.nameInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
            value={player.name}
            onChangeText={(text) => updateName(player.id, text)}
            onBlur={() => setEditingId(null)}
            autoFocus
            placeholderTextColor={theme.colors.textTertiary}
          />
        ) : (
          <TouchableOpacity onPress={() => !room.isOnline && setEditingId(player.id)}>
            <Text style={[styles.playerName, { color: theme.colors.text }]}>{player.name}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.playerHeaderRight}>
          {!room.isOnline && (
            <TouchableOpacity
              style={[styles.removeButton, { backgroundColor: theme.colors.danger }]}
              onPress={() => removePlayer(player.id)}
            >
              <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.levelContainer}>
        <TouchableOpacity
          style={[styles.levelButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]}
          onPress={() => updateLevel(player.id, -1)}
          disabled={!canEdit(player.id)}
        >
          <Text style={styles.levelButtonText}>−</Text>
        </TouchableOpacity>
        <View style={styles.levelDisplay}>
          <Text style={[styles.levelLabel, { color: theme.colors.textSecondary }]}>Level</Text>
          <Text style={[styles.levelNumber, { color: theme.colors.primary }]}>{player.level}</Text>
        </View>
        <TouchableOpacity
          style={[styles.levelButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]}
          onPress={() => updateLevel(player.id, 1)}
          disabled={!canEdit(player.id)}
        >
          <Text style={styles.levelButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.statsRow, { borderTopColor: theme.colors.border }]}>
        <View style={styles.statContainer}>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Gear</Text>
          <View style={styles.statControls}>
            <TouchableOpacity
              style={[styles.smallButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]}
              onPress={() => updateGear(player.id, -1)}
              disabled={!canEdit(player.id)}
            >
              <Text style={styles.smallButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{player.gear}</Text>
            <TouchableOpacity
              style={[styles.smallButton, { backgroundColor: theme.colors.primary }, !canEdit(player.id) && styles.disabledBtn]}
              onPress={() => updateGear(player.id, 1)}
              disabled={!canEdit(player.id)}
            >
              <Text style={styles.smallButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={[styles.combatStrength, { borderTopColor: theme.colors.border }]}>
        <Text style={[styles.combatLabel, { color: theme.colors.textSecondary }]}>Combat Strength:</Text>
        <Text style={[styles.combatValue, { color: theme.colors.warning }]}>{player.level + player.gear}</Text>
      </View>
    </View>
  );

  const renderBattleEntity = (entity, isPlayer) => {
    const id = isPlayer ? entity.playerId : entity.id;
    const canEditBonus = isPlayer ? canEditPlayerBonus(entity.playerId) : canEditMonsterBonus();
    const total = calcEntityStrength(entity);

    return (
      <View
        key={id}
        style={[styles.battleEntity, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      >
        <View style={styles.entityHeader}>
          <Text style={[styles.entityName, { color: theme.colors.text }]}>{entity.name ?? `Monster`}</Text>
          {isPlayer
            ? (battle.players ?? []).length > 1 && canEditBonus && (
                <TouchableOpacity style={[styles.removeEntityButton, { backgroundColor: theme.colors.danger }]} onPress={() => removePlayerFromBattle(entity.playerId)}>
                  <Text style={styles.removeEntityText}>×</Text>
                </TouchableOpacity>
              )
            : (battle.monsters ?? []).length > 1 && canEditMonsterBonus() && (
                <TouchableOpacity style={[styles.removeEntityButton, { backgroundColor: theme.colors.danger }]} onPress={() => removeMonsterFromBattle(entity.id)}>
                  <Text style={styles.removeEntityText}>×</Text>
                </TouchableOpacity>
              )}
        </View>

        <Text style={[styles.baseStrength, { color: theme.colors.textSecondary }]}>
          Base: {entity.baseStrength ?? entity.strength}
        </Text>

        {(entity.bonuses ?? []).map((bonus, index) => (
          <View key={index} style={styles.bonusRow}>
            <Text style={[styles.bonusSign, { color: bonus.isNegative ? theme.colors.danger : theme.colors.success }]}>
              {bonus.isNegative ? '−' : '+'}
            </Text>
            <TextInput
              style={[styles.bonusInput, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={bonus.value.toString()}
              onChangeText={(text) =>
                isPlayer
                  ? updatePlayerBonus(entity.playerId, index, text)
                  : updateMonsterBonus(entity.id, index, text)
              }
              keyboardType="numeric"
              editable={canEditBonus}
              placeholder="0"
              placeholderTextColor={theme.colors.textTertiary}
            />
            {canEditBonus && (
              <TouchableOpacity
                style={[styles.removeBonusButton, { backgroundColor: theme.colors.danger }]}
                onPress={() =>
                  isPlayer ? removePlayerBonus(entity.playerId, index) : removeMonsterBonus(entity.id, index)
                }
              >
                <Text style={styles.removeBonusText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {canEditBonus && (
          <View style={styles.bonusButtons}>
            <TouchableOpacity
              style={[styles.addBonusButton, { backgroundColor: theme.colors.success }]}
              onPress={() => isPlayer ? addBonusToPlayer(entity.playerId, 5) : addBonusToMonster(entity.id, 5)}
            >
              <Text style={styles.addBonusText}>+ Bonus</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBonusButton, { backgroundColor: theme.colors.warning }]}
              onPress={() => isPlayer ? addBonusToPlayer(entity.playerId, -5) : addBonusToMonster(entity.id, -5)}
            >
              <Text style={styles.addBonusText}>− Penalty</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.totalStrength, { color: theme.colors.primary }]}>Total: {total}</Text>
      </View>
    );
  };

  const pTotal = getPlayersTotalStrength();
  const mTotal = getMonstersTotalStrength();
  const battleResultText = pTotal > mTotal ? '👥 Players Win!' : pTotal < mTotal ? '👹 Monster Wins!' : '⚖️ Tie!';
  const battleResultColor = pTotal > mTotal ? theme.colors.success : pTotal < mTotal ? theme.colors.danger : theme.colors.warning;

  // Available players to request help from (not already in battle)
  const availableForHelp = room.isOnline
    ? room.players.filter(
        (p) =>
          p.id !== room.userId &&
          !(activeBattle?.participants ?? []).find((bp) => bp.playerId === p.id) &&
          activeBattle?.helpRequests?.[p.id] !== 'pending' &&
          activeBattle?.helpRequests?.[p.id] !== 'accepted'
      )
    : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Munchkin Level Tracker</Text>
          <View style={styles.headerButtons}>
            {!room.isOnline && (
              <TouchableOpacity
                style={[styles.onlineBtn, { backgroundColor: theme.colors.primary }]}
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

        {/* Battle button */}
        <TouchableOpacity
          style={[styles.battleButton, { backgroundColor: theme.colors.warning }]}
          onPress={startBattle}
        >
          <Text style={styles.battleButtonText}>
            {room.isOnline && activeBattle ? '⚔️ View Active Battle' : '⚔️ Battle Mode'}
          </Text>
        </TouchableOpacity>

        {/* Online: Live Battle Card (for non-attackers) */}
        {room.isOnline && activeBattle && !iAmAttacker && (
          <View style={[styles.liveBattleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.warning }]}>
            <View style={styles.liveBattleHeader}>
              <Text style={[styles.liveBattleTitle, { color: theme.colors.warning }]}>⚔️ Battle in Progress!</Text>
              <TouchableOpacity
                style={[styles.viewBattleBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => { setShowBattleModal(true); setBattleStep('battleCalculation'); }}
              >
                <Text style={styles.viewBattleBtnText}>View</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.liveBattleAttacker, { color: theme.colors.text }]}>
              {room.players.find((p) => p.id === activeBattle.attackerId)?.displayName ?? 'Someone'} is fighting
            </Text>

            <View style={styles.liveBattleStrengths}>
              <View style={styles.liveBattleSide}>
                <Text style={[styles.liveBattleSideLabel, { color: theme.colors.primary }]}>👥 Players</Text>
                <Text style={[styles.liveBattleSideValue, { color: theme.colors.primary }]}>
                  {(activeBattle.participants ?? []).reduce((s, p) => s + calcEntityStrength(p), 0)}
                </Text>
              </View>
              <Text style={[styles.liveBattleVs, { color: theme.colors.textSecondary }]}>vs</Text>
              <View style={styles.liveBattleSide}>
                <Text style={[styles.liveBattleSideLabel, { color: theme.colors.danger }]}>👹 Monster</Text>
                <Text style={[styles.liveBattleSideValue, { color: theme.colors.danger }]}>
                  {(activeBattle.monsters ?? []).reduce((s, m) => s + calcEntityStrength(m), 0)}
                </Text>
              </View>
            </View>

            {/* Help request response */}
            {myHelpRequest === 'pending' && (
              <View style={styles.helpRequestRow}>
                <Text style={[styles.helpRequestText, { color: theme.colors.text }]}>You've been asked to help!</Text>
                <View style={styles.helpRequestButtons}>
                  <TouchableOpacity
                    style={[styles.helpBtn, { backgroundColor: theme.colors.success }]}
                    onPress={() => respondToHelp(true)}
                  >
                    <Text style={styles.helpBtnText}>Accept ⚔️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.helpBtn, { backgroundColor: theme.colors.danger }]}
                    onPress={() => respondToHelp(false)}
                  >
                    <Text style={styles.helpBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {myHelpRequest === 'accepted' && (
              <Text style={[styles.helpStatusText, { color: theme.colors.success }]}>✓ You're in the battle</Text>
            )}
            {myHelpRequest === 'declined' && (
              <Text style={[styles.helpStatusText, { color: theme.colors.textSecondary }]}>You declined to help</Text>
            )}

            {/* Backstab — add monster bonus if allCanEdit and not in battle */}
            {room.allCanEdit && !iAmParticipant && (activeBattle.monsters ?? []).length > 0 && (
              <TouchableOpacity
                style={[styles.backstabBtn, { borderColor: theme.colors.danger }]}
                onPress={() => {
                  setShowBattleModal(true);
                  setBattleStep('battleCalculation');
                }}
              >
                <Text style={[styles.backstabBtnText, { color: theme.colors.danger }]}>🗡️ Interfere / Backstab</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Player cards */}
        <View style={styles.playersSection}>
          {players.map(renderPlayerCard)}
          {!room.isOnline && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.colors.success }]}
              onPress={addPlayer}
            >
              <Text style={styles.addButtonText}>+ Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.infoSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Game Info</Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
            {'• First to Level 10 wins!\n'}
            {'• Combat Strength = Level + Gear\n'}
            {'• Use Battle Mode to calculate fights\n'}
            {room.isOnline
              ? '• Attacker wins battle → gains +1 level automatically\n• Request help from other players during battle\n• Other players can backstab with allCanEdit on'
              : '• Tap player names to edit'}
          </Text>
        </View>
      </ScrollView>

      {/* ── Battle Modal ──────────────────────────────────────────────────────── */}
      <Modal
        visible={showBattleModal}
        transparent
        animationType="slide"
        onRequestClose={closeBattle}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
            <View style={[styles.battleModal, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.battleTitle, { color: theme.colors.warning }]}>⚔️ Battle Mode</Text>

              {/* Step: Select Player */}
              {battleStep === 'selectPlayer' && (
                <ScrollView style={styles.battleScrollView}>
                  <Text style={[styles.battleSectionTitle, { color: theme.colors.text }]}>
                    {room.isOnline ? 'Start a battle as yourself:' : 'Select Player for Battle:'}
                  </Text>
                  {players
                    .filter((p) => !room.isOnline || p.id === room.userId)
                    .map((player) => (
                      <TouchableOpacity
                        key={player.id}
                        style={[styles.playerSelectButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }]}
                        onPress={() => selectPlayerForBattle(player)}
                      >
                        <Text style={[styles.playerSelectName, { color: theme.colors.text }]}>{player.name}</Text>
                        <Text style={[styles.playerSelectStrength, { color: theme.colors.primary }]}>
                          Strength: {player.level + player.gear}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              )}

              {/* Step: Enter Monster */}
              {battleStep === 'enterMonster' && (
                <View style={styles.monsterInputContainer}>
                  <Text style={[styles.battleSectionTitle, { color: theme.colors.text }]}>Enter Monster Strength:</Text>
                  <TextInput
                    ref={monsterInputRef}
                    style={[styles.monsterInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.warning }]}
                    placeholder="Enter monster strength"
                    placeholderTextColor={theme.colors.textTertiary}
                    keyboardType="numeric"
                    value={monsterStrengthInput}
                    onChangeText={setMonsterStrengthInput}
                    onSubmitEditing={addMonsterToBattle}
                    returnKeyType="done"
                    autoFocus
                  />
                  <View style={styles.monsterButtonsRow}>
                    <TouchableOpacity
                      style={[styles.backButton, { backgroundColor: theme.colors.textSecondary }]}
                      onPress={() => {
                        if (room.isOnline && activeBattle) {
                          // clear the partial battle
                          room.updateSharedState({ ...room.sharedState, activeBattle: null });
                        }
                        setBattleStep('selectPlayer');
                      }}
                    >
                      <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.continueButton, { backgroundColor: theme.colors.success }]}
                      onPress={addMonsterToBattle}
                    >
                      <Text style={styles.continueButtonText}>Continue →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Step: Battle Calculation */}
              {battleStep === 'battleCalculation' && (
                <ScrollView style={styles.battleScrollView}>
                  {/* Players side */}
                  <View style={styles.battleSide}>
                    <Text style={[styles.sideTitle, { color: theme.colors.text }]}>👥 Players</Text>
                    {(battle.players ?? []).map((p) => renderBattleEntity(p, true))}

                    {/* Add players from list (offline) or request help (online) */}
                    {!room.isOnline && players.filter((p) => !(battle.players ?? []).find((bp) => bp.playerId === p.id)).length > 0 && (
                      <View>
                        <Text style={[styles.availablePlayersLabel, { color: theme.colors.text }]}>Available Players:</Text>
                        {players.filter((p) => !(battle.players ?? []).find((bp) => bp.playerId === p.id)).map((player) => (
                          <TouchableOpacity
                            key={player.id}
                            style={[styles.availablePlayerButton, { backgroundColor: theme.colors.card, borderLeftColor: theme.colors.primary }]}
                            onPress={() => addPlayerToBattle(player)}
                          >
                            <Text style={[styles.availablePlayerText, { color: theme.colors.primary }]}>
                              {player.name} (Strength: {player.level + player.gear})
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Online: Request Help from other players */}
                    {room.isOnline && iAmAttacker && availableForHelp.length > 0 && (
                      <View style={styles.requestHelpSection}>
                        <Text style={[styles.availablePlayersLabel, { color: theme.colors.text }]}>Request Help:</Text>
                        {availableForHelp.map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.requestHelpButton, { backgroundColor: theme.colors.card, borderLeftColor: theme.colors.primary }]}
                            onPress={() => requestHelp({ id: p.id, name: p.displayName })}
                          >
                            <Text style={[styles.availablePlayerText, { color: theme.colors.primary }]}>
                              📣 Ask {p.displayName} for help
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Show pending/declined help request statuses */}
                    {room.isOnline && Object.entries(activeBattle?.helpRequests ?? {}).filter(([, v]) => v === 'pending').length > 0 && (
                      <Text style={[styles.helpPendingText, { color: theme.colors.textSecondary }]}>
                        ⏳ Waiting for response…
                      </Text>
                    )}

                    <View style={[styles.sideTotalContainer, { backgroundColor: theme.colors.card }]}>
                      <Text style={[styles.sideTotalLabel, { color: theme.colors.text }]}>Players Total:</Text>
                      <Text style={[styles.sideTotalValue, { color: theme.colors.primary }]}>{pTotal}</Text>
                    </View>
                  </View>

                  <View style={styles.vsDivider}>
                    <Text style={[styles.vsText, { color: theme.colors.danger }]}>VS</Text>
                  </View>

                  {/* Monsters side */}
                  <View style={styles.battleSide}>
                    <Text style={[styles.sideTitle, { color: theme.colors.text }]}>👹 Monsters</Text>
                    {(battle.monsters ?? []).map((m, i) => (
                      <View key={m.id}>
                        <Text style={[styles.monsterIndexLabel, { color: theme.colors.textSecondary }]}>
                          Monster {i + 1}
                        </Text>
                        {renderBattleEntity(m, false)}
                      </View>
                    ))}

                    {canAddMonster() && (
                      <TouchableOpacity
                        style={[styles.addEntityButton, { backgroundColor: theme.colors.primary }]}
                        onPress={() => { setMonsterStrengthInput(''); setBattleStep('enterMonster'); }}
                      >
                        <Text style={styles.addEntityText}>+ Add Monster</Text>
                      </TouchableOpacity>
                    )}

                    <View style={[styles.sideTotalContainer, { backgroundColor: theme.colors.card }]}>
                      <Text style={[styles.sideTotalLabel, { color: theme.colors.text }]}>Monsters Total:</Text>
                      <Text style={[styles.sideTotalValue, { color: theme.colors.primary }]}>{mTotal}</Text>
                    </View>
                  </View>

                  {/* Result */}
                  <View style={[styles.battleResult, { backgroundColor: theme.colors.card, borderColor: battleResultColor }]}>
                    <Text style={[styles.resultText, { color: battleResultColor }]}>{battleResultText}</Text>
                    <Text style={[styles.resultDetails, { color: theme.colors.textSecondary }]}>
                      {pTotal} vs {mTotal}
                    </Text>
                  </View>

                  {/* Online: Resolve button (attacker only) */}
                  {room.isOnline && iAmAttacker && (battle.monsters ?? []).length > 0 && (
                    <TouchableOpacity
                      style={[styles.resolveButton, { backgroundColor: theme.colors.success }]}
                      onPress={resolveBattle}
                    >
                      <Text style={styles.resolveButtonText}>⚔️ Resolve Battle</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}

              {/* Footer buttons */}
              <View style={styles.battleFooter}>
                {room.isOnline && activeBattle && iAmAttacker ? (
                  <TouchableOpacity
                    style={[styles.closeBattleButton, { backgroundColor: theme.colors.danger }]}
                    onPress={cancelOnlineBattle}
                  >
                    <Text style={styles.closeBattleButtonText}>Cancel Battle</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.closeBattleButton, { backgroundColor: theme.colors.primary }]}
                    onPress={closeBattle}
                  >
                    <Text style={styles.closeBattleButtonText}>
                      {room.isOnline ? 'Close (Battle Continues)' : 'Close Battle'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Winner Modal ──────────────────────────────────────────────────────── */}
      <Modal visible={showWinner} transparent animationType="fade" onRequestClose={() => setShowWinner(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.winnerModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.winnerEmoji}>🎉</Text>
            <Text style={[styles.winnerTitle, { color: theme.colors.text }]}>We Have a Winner!</Text>
            <Text style={[styles.winnerName, { color: theme.colors.primary }]}>{winner?.name}</Text>
            <Text style={[styles.winnerMessage, { color: theme.colors.textSecondary }]}>has reached Level 10!</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.newGameButton, { backgroundColor: theme.colors.success }]}
                onPress={() => { setShowWinner(false); resetGame(); }}
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

      <RoomLobby visible={showRoomLobby} onClose={handleCloseLobby} room={room} gameType="Munchkin" />
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  headerButtons: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  onlineBtn: { borderRadius: 8, padding: 8, justifyContent: 'center', alignItems: 'center' },
  resetButton: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  resetButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  battleButton: {
    borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  battleButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Live battle card
  liveBattleCard: {
    borderRadius: 12, borderWidth: 2, padding: 14, marginBottom: 16,
  },
  liveBattleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  liveBattleTitle: { fontSize: 16, fontWeight: 'bold' },
  viewBattleBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  viewBattleBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  liveBattleAttacker: { fontSize: 14, marginBottom: 10 },
  liveBattleStrengths: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 10 },
  liveBattleSide: { alignItems: 'center' },
  liveBattleSideLabel: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  liveBattleSideValue: { fontSize: 26, fontWeight: 'bold' },
  liveBattleVs: { fontSize: 14, fontWeight: 'bold' },
  helpRequestRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  helpRequestText: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  helpRequestButtons: { flexDirection: 'row', gap: 8 },
  helpBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  helpBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  helpStatusText: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  backstabBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  backstabBtnText: { fontSize: 14, fontWeight: '600' },

  playersSection: { marginBottom: 30 },
  playerCard: { borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1 },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  playerHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerName: { fontSize: 20, fontWeight: '600' },
  nameInput: { fontSize: 20, fontWeight: '600', borderBottomWidth: 2, minWidth: 150, padding: 0 },
  removeButton: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 24 },

  levelContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelButton: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  levelButtonText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  levelDisplay: { alignItems: 'center', flex: 1 },
  levelLabel: { fontSize: 14, marginBottom: 5 },
  levelNumber: { fontSize: 48, fontWeight: 'bold' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 15, paddingTop: 15, borderTopWidth: 1 },
  statContainer: { alignItems: 'center' },
  statLabel: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  statControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallButton: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  smallButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statValue: { fontSize: 20, fontWeight: 'bold', minWidth: 30, textAlign: 'center' },

  combatStrength: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  combatLabel: { fontSize: 16, fontWeight: '600' },
  combatValue: { fontSize: 24, fontWeight: 'bold' },

  addButton: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  infoSection: { padding: 15, borderRadius: 12, borderWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  text: { fontSize: 14, lineHeight: 22 },
  disabledBtn: { opacity: 0.4 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  battleModal: {
    borderRadius: 20, padding: 24, width: '90%', maxWidth: 400, maxHeight: '85%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 10,
  },
  battleTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  battleSectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  battleScrollView: { maxHeight: 520, width: '100%' },
  battleFooter: { marginTop: 12 },
  closeBattleButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  closeBattleButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  playerSelectButton: { borderRadius: 10, padding: 16, marginBottom: 10, borderWidth: 2 },
  playerSelectName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  playerSelectStrength: { fontSize: 14 },

  monsterInputContainer: { width: '100%', paddingVertical: 20 },
  monsterInput: { borderRadius: 8, padding: 16, fontSize: 18, borderWidth: 2, marginBottom: 16, textAlign: 'center' },
  monsterButtonsRow: { flexDirection: 'row', gap: 10 },
  backButton: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  continueButton: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  battleSide: { marginBottom: 20 },
  sideTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  monsterIndexLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  battleEntity: { borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1 },
  entityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  entityName: { fontSize: 16, fontWeight: 'bold' },
  removeEntityButton: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  removeEntityText: { color: '#fff', fontSize: 16, fontWeight: 'bold', lineHeight: 18 },
  baseStrength: { fontSize: 14, marginBottom: 8 },

  bonusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  bonusSign: { fontSize: 20, fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
  bonusInput: { flex: 1, borderRadius: 6, padding: 8, fontSize: 16, borderWidth: 1, textAlign: 'center' },
  removeBonusButton: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  removeBonusText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  bonusButtons: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  addBonusButton: { flex: 1, padding: 8, borderRadius: 6, alignItems: 'center' },
  addBonusText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  totalStrength: { fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginTop: 4 },

  availablePlayersLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginTop: 4 },
  availablePlayerButton: { borderRadius: 8, padding: 10, marginBottom: 6, borderLeftWidth: 4 },
  availablePlayerText: { fontSize: 14, fontWeight: '500' },

  requestHelpSection: { marginTop: 8 },
  requestHelpButton: { borderRadius: 8, padding: 10, marginBottom: 6, borderLeftWidth: 4 },
  helpPendingText: { fontSize: 13, fontStyle: 'italic', marginVertical: 4 },

  addEntityButton: { borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 12 },
  addEntityText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  sideTotalContainer: { borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sideTotalLabel: { fontSize: 16, fontWeight: 'bold' },
  sideTotalValue: { fontSize: 24, fontWeight: 'bold' },

  vsDivider: { alignItems: 'center', marginVertical: 10 },
  vsText: { fontSize: 24, fontWeight: 'bold' },

  battleResult: { borderRadius: 12, padding: 16, marginTop: 10, marginBottom: 10, alignItems: 'center', borderWidth: 2 },
  resultText: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  resultDetails: { fontSize: 18 },

  resolveButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  resolveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Winner modal
  winnerModal: {
    borderRadius: 20, padding: 30, width: '100%', maxWidth: 350, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 10,
  },
  winnerEmoji: { fontSize: 72, marginBottom: 16 },
  winnerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  winnerName: { fontSize: 32, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  winnerMessage: { fontSize: 20, marginBottom: 30, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  newGameButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  newGameButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
