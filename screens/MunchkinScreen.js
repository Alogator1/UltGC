import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_PLAYER_NAMES } from '../constants/playerNames';

export default function MunchkinScreen() {
  const { theme } = useTheme();
  const [players, setPlayers] = useState([
    { id: 1, name: DEFAULT_PLAYER_NAMES[0], level: 1, gear: 0, curses: 0 },
    { id: 2, name: DEFAULT_PLAYER_NAMES[1], level: 1, gear: 0, curses: 0 },
    { id: 3, name: DEFAULT_PLAYER_NAMES[2], level: 1, gear: 0, curses: 0 },
    { id: 4, name: DEFAULT_PLAYER_NAMES[3], level: 1, gear: 0, curses: 0 },
  ]);
  const [editingId, setEditingId] = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [battleStep, setBattleStep] = useState('selectPlayer'); // 'selectPlayer', 'enterMonster', 'battleCalculation'
  const [battle, setBattle] = useState({
    players: [], // {playerId, name, baseStrength, bonuses: [{value, isNegative}]}
    monsters: [], // {id, strength, bonuses: [{value, isNegative}]}
  });
  const [monsterStrengthInput, setMonsterStrengthInput] = useState('');
  const monsterInputRef = useRef(null);

  const addPlayer = () => {
    const newId = Math.max(...players.map(p => p.id), 0) + 1;
    setPlayers([...players, { id: newId, name: `Player ${newId}`, level: 1, gear: 0, curses: 0 }]);
  };

  const removePlayer = (id) => {
    if (players.length <= 1) {
      Alert.alert('Cannot Remove', 'You need at least one player!');
      return;
    }
    setPlayers(players.filter(p => p.id !== id));
  };

  const updateLevel = (id, delta) => {
    setPlayers(players.map(p => {
      if (p.id === id) {
        const newLevel = Math.max(1, Math.min(10, p.level + delta));
        // Check if player reached level 10
        if (newLevel === 10 && p.level !== 10) {
          setWinner(p);
          setShowWinner(true);
        }
        return { ...p, level: newLevel };
      }
      return p;
    }));
  };

  const updateName = (id, newName) => {
    setPlayers(players.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const updateGear = (id, delta) => {
    setPlayers(players.map(p => {
      if (p.id === id) {
        const newGear = p.gear + delta;
        return { ...p, gear: newGear };
      }
      return p;
    }));
  };

  const startBattle = () => {
    setBattle({ players: [], monsters: [] });
    setMonsterStrengthInput('');
    setBattleStep('selectPlayer');
    setShowBattleModal(true);
  };

  const selectPlayerForBattle = (player) => {
    setBattle({
      ...battle,
      players: [{
        playerId: player.id,
        name: player.name,
        baseStrength: player.level + player.gear,
        bonuses: []
      }]
    });
    setMonsterStrengthInput('');
    setBattleStep('enterMonster');
  };

  const addMonsterToBattle = () => {
    const strength = parseInt(monsterStrengthInput) || 0;
    if (strength === 0) {
      Alert.alert('Invalid Input', 'Please enter a valid monster strength');
      return;
    }
    const newMonster = {
      id: Date.now(),
      strength: strength,
      bonuses: []
    };
    setBattle({
      ...battle,
      monsters: [...battle.monsters, newMonster]
    });
    setMonsterStrengthInput('');
    setBattleStep('battleCalculation');
  };

  const addPlayerToBattle = (player) => {
    const existingPlayer = battle.players.find(p => p.playerId === player.id);
    if (existingPlayer) {
      Alert.alert('Already in Battle', `${player.name} is already in this battle`);
      return;
    }
    setBattle({
      ...battle,
      players: [...battle.players, {
        playerId: player.id,
        name: player.name,
        baseStrength: player.level + player.gear,
        bonuses: []
      }]
    });
  };

  const addBonusToPlayer = (playerId, value) => {
    const isNegative = value < 0;
    setBattle({
      ...battle,
      players: battle.players.map(p =>
        p.playerId === playerId
          ? { ...p, bonuses: [...p.bonuses, { value: Math.abs(value), isNegative }] }
          : p
      )
    });
  };

  const updatePlayerBonus = (playerId, bonusIndex, value) => {
    // Only allow numbers (no minus sign needed)
    const cleanValue = value.replace(/[^0-9]/g, '');
    const numValue = parseInt(cleanValue) || 0;

    setBattle({
      ...battle,
      players: battle.players.map(p =>
        p.playerId === playerId
          ? {
              ...p,
              bonuses: p.bonuses.map((b, i) => i === bonusIndex ? { ...b, value: numValue } : b)
            }
          : p
      )
    });
  };

  const removePlayerBonus = (playerId, bonusIndex) => {
    setBattle({
      ...battle,
      players: battle.players.map(p =>
        p.playerId === playerId
          ? { ...p, bonuses: p.bonuses.filter((_, i) => i !== bonusIndex) }
          : p
      )
    });
  };

  const addBonusToMonster = (monsterId, value) => {
    const isNegative = value < 0;
    setBattle({
      ...battle,
      monsters: battle.monsters.map(m =>
        m.id === monsterId
          ? { ...m, bonuses: [...m.bonuses, { value: Math.abs(value), isNegative }] }
          : m
      )
    });
  };

  const updateMonsterBonus = (monsterId, bonusIndex, value) => {
    // Only allow numbers (no minus sign needed)
    const cleanValue = value.replace(/[^0-9]/g, '');
    const numValue = parseInt(cleanValue) || 0;

    setBattle({
      ...battle,
      monsters: battle.monsters.map(m =>
        m.id === monsterId
          ? {
              ...m,
              bonuses: m.bonuses.map((b, i) => i === bonusIndex ? { ...b, value: numValue } : b)
            }
          : m
      )
    });
  };

  const removeMonsterBonus = (monsterId, bonusIndex) => {
    setBattle({
      ...battle,
      monsters: battle.monsters.map(m =>
        m.id === monsterId
          ? { ...m, bonuses: m.bonuses.filter((_, i) => i !== bonusIndex) }
          : m
      )
    });
  };

  const addAnotherMonster = () => {
    setMonsterStrengthInput('');
    setBattleStep('enterMonster');
  };

  const removePlayerFromBattle = (playerId) => {
    if (battle.players.length === 1) {
      Alert.alert('Cannot Remove', 'At least one player must be in the battle');
      return;
    }
    setBattle({
      ...battle,
      players: battle.players.filter(p => p.playerId !== playerId)
    });
  };

  const removeMonsterFromBattle = (monsterId) => {
    if (battle.monsters.length === 1) {
      Alert.alert('Cannot Remove', 'At least one monster must be in the battle');
      return;
    }
    setBattle({
      ...battle,
      monsters: battle.monsters.filter(m => m.id !== monsterId)
    });
  };

  const closeBattle = () => {
    setShowBattleModal(false);
    setBattleStep('selectPlayer');
    setBattle({ players: [], monsters: [] });
    setMonsterStrengthInput('');
  };

  const calculateTotalStrength = (entity) => {
    const bonusTotal = entity.bonuses.reduce((sum, b) => {
      const bonusValue = b.value || 0;
      return sum + (b.isNegative ? -bonusValue : bonusValue);
    }, 0);
    return (entity.baseStrength || entity.strength) + bonusTotal;
  };

  const getPlayersTotalStrength = () => {
    return battle.players.reduce((sum, p) => sum + calculateTotalStrength(p), 0);
  };

  const getMonstersTotalStrength = () => {
    return battle.monsters.reduce((sum, m) => sum + calculateTotalStrength(m), 0);
  };

  const resetGame = () => {
    Alert.alert(
      'Reset Game',
      'Are you sure you want to reset all players to Level 1?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setPlayers(players.map(p => ({ ...p, level: 1, gear: 0 })));
            setShowWinner(false);
            setWinner(null);
          }
        },
      ]
    );
  };

  // Load saved data on mount
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('munchkinGameData');
        if (savedData) {
          const data = JSON.parse(savedData);
          // Ensure all players have gear and curses properties
          const playersWithDefaults = (data.players || players).map(p => ({
            ...p,
            gear: p.gear ?? 0,
            curses: p.curses ?? 0
          }));
          setPlayers(playersWithDefaults);
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
        await AsyncStorage.setItem('munchkinGameData', JSON.stringify({ players }));
      } catch (error) {
        console.error('Error saving game data:', error);
      }
    };
    saveGameData();
  }, [players]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Munchkin Level Tracker</Text>
          <TouchableOpacity style={[styles.resetButton, { backgroundColor: theme.colors.danger }]} onPress={resetGame}>
            <Text style={styles.resetButtonText}>Reset Game</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.battleButton, { backgroundColor: theme.colors.warning }]} onPress={startBattle}>
          <Text style={styles.battleButtonText}>⚔️ Battle Mode</Text>
        </TouchableOpacity>

        <View style={styles.playersSection}>
          {players.map(player => (
            <View key={player.id} style={[styles.playerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.playerHeader}>
                {editingId === player.id ? (
                  <TextInput
                    style={[styles.nameInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                    value={player.name}
                    onChangeText={(text) => updateName(player.id, text)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                ) : (
                  <TouchableOpacity onPress={() => setEditingId(player.id)}>
                    <Text style={[styles.playerName, { color: theme.colors.text }]}>{player.name}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.colors.danger }]}
                  onPress={() => removePlayer(player.id)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.levelContainer}>
                <TouchableOpacity
                  style={[styles.levelButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => updateLevel(player.id, -1)}
                >
                  <Text style={styles.levelButtonText}>−</Text>
                </TouchableOpacity>

                <View style={styles.levelDisplay}>
                  <Text style={[styles.levelLabel, { color: theme.colors.textSecondary }]}>Level</Text>
                  <Text style={[styles.levelNumber, { color: theme.colors.primary }]}>{player.level}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.levelButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => updateLevel(player.id, 1)}
                >
                  <Text style={styles.levelButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.statsRow, { borderTopColor: theme.colors.border }]}>
                <View style={styles.statContainer}>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Gear</Text>
                  <View style={styles.statControls}>
                    <TouchableOpacity
                      style={[styles.smallButton, { backgroundColor: theme.colors.primary }]}
                      onPress={() => updateGear(player.id, -1)}
                    >
                      <Text style={styles.smallButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.statValue, { color: theme.colors.text }]}>{player.gear}</Text>
                    <TouchableOpacity
                      style={[styles.smallButton, { backgroundColor: theme.colors.primary }]}
                      onPress={() => updateGear(player.id, 1)}
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
          ))}

          <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.colors.success }]} onPress={addPlayer}>
            <Text style={styles.addButtonText}>+ Add Player</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Game Info</Text>
          <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
            • First to Level 10 wins!{'\n'}
            • Combat Strength = Level + Gear{'\n'}
            • Use Battle Mode to calculate fights{'\n'}
            • Track gear for each player{'\n'}
            • Tap player names to edit
          </Text>
        </View>
      </ScrollView>

      {/* Battle Mode Modal */}
      <Modal
        visible={showBattleModal}
        transparent={true}
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

              {battleStep === 'selectPlayer' && (
                <ScrollView style={styles.battleScrollView}>
                  <Text style={[styles.battleSectionTitle, { color: theme.colors.text }]}>Select Player for Battle:</Text>
                  {players.map(player => (
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
                      onPress={() => setBattleStep('selectPlayer')}
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

            {battleStep === 'battleCalculation' && (
              <ScrollView style={styles.battleScrollView}>
                {/* Players Side */}
                <View style={styles.battleSide}>
                  <Text style={[styles.sideTitle, { color: theme.colors.text }]}>👥 Players</Text>
                  {battle.players.map(player => (
                    <View key={player.playerId} style={[styles.battleEntity, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                      <View style={styles.entityHeader}>
                        <Text style={[styles.entityName, { color: theme.colors.text }]}>{player.name}</Text>
                        {battle.players.length > 1 && (
                          <TouchableOpacity
                            style={styles.removeEntityButton}
                            onPress={() => removePlayerFromBattle(player.playerId)}
                          >
                            <Text style={styles.removeEntityText}>×</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={[styles.baseStrength, { color: theme.colors.textSecondary }]}>Base: {player.baseStrength}</Text>

                      {player.bonuses.map((bonus, index) => (
                        <View key={index} style={styles.bonusRow}>
                          <Text style={[styles.bonusSign, { color: theme.colors.text }]}>{bonus.isNegative ? '-' : '+'}</Text>
                          <TextInput
                            style={[styles.bonusInput, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={bonus.value.toString()}
                            onChangeText={(text) => updatePlayerBonus(player.playerId, index, text)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={theme.colors.textTertiary}
                          />
                          <TouchableOpacity
                            style={styles.removeBonusButton}
                            onPress={() => removePlayerBonus(player.playerId, index)}
                          >
                            <Text style={styles.removeBonusText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}

                      <View style={styles.bonusButtons}>
                        <TouchableOpacity
                          style={[styles.addBonusButton, { backgroundColor: theme.colors.success }]}
                          onPress={() => addBonusToPlayer(player.playerId, 5)}
                        >
                          <Text style={styles.addBonusText}>+ Bonus</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.addBonusButton, { backgroundColor: theme.colors.warning }]}
                          onPress={() => addBonusToPlayer(player.playerId, -5)}
                        >
                          <Text style={styles.addBonusText}>- Penalty</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.totalStrength, { color: theme.colors.primary }]}>
                        Total: {calculateTotalStrength(player)}
                      </Text>
                    </View>
                  ))}

                  {players.filter(p => !battle.players.find(bp => bp.playerId === p.id)).length > 0 ? (
                    <View>
                      <Text style={[styles.availablePlayersLabel, { color: theme.colors.text }]}>Available Players:</Text>
                      {players.filter(p => !battle.players.find(bp => bp.playerId === p.id)).map(player => (
                        <TouchableOpacity
                          key={player.id}
                          style={[styles.availablePlayerButton, { backgroundColor: theme.colors.card, borderLeftColor: theme.colors.primary }]}
                          onPress={() => addPlayerToBattle(player)}
                        >
                          <Text style={[styles.availablePlayerText, { color: theme.colors.primary }]}>{player.name} (Strength: {player.level + player.gear})</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.noAvailablePlayersText, { color: theme.colors.textTertiary }]}>All players are in the battle</Text>
                  )}

                  <View style={[styles.sideTotalContainer, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.sideTotalLabel, { color: theme.colors.text }]}>Players Total:</Text>
                    <Text style={[styles.sideTotalValue, { color: theme.colors.primary }]}>{getPlayersTotalStrength()}</Text>
                  </View>
                </View>

                {/* VS Divider */}
                <View style={styles.vsDivider}>
                  <Text style={[styles.vsText, { color: theme.colors.danger }]}>VS</Text>
                </View>

                {/* Monsters Side */}
                <View style={styles.battleSide}>
                  <Text style={[styles.sideTitle, { color: theme.colors.text }]}>👹 Monsters</Text>
                  {battle.monsters.map((monster, monsterIndex) => (
                    <View key={monster.id} style={[styles.battleEntity, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                      <View style={styles.entityHeader}>
                        <Text style={[styles.entityName, { color: theme.colors.text }]}>Monster {monsterIndex + 1}</Text>
                        {battle.monsters.length > 1 && (
                          <TouchableOpacity
                            style={styles.removeEntityButton}
                            onPress={() => removeMonsterFromBattle(monster.id)}
                          >
                            <Text style={styles.removeEntityText}>×</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={[styles.baseStrength, { color: theme.colors.textSecondary }]}>Base: {monster.strength}</Text>

                      {monster.bonuses.map((bonus, index) => (
                        <View key={index} style={styles.bonusRow}>
                          <Text style={[styles.bonusSign, { color: theme.colors.text }]}>{bonus.isNegative ? '-' : '+'}</Text>
                          <TextInput
                            style={[styles.bonusInput, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                            value={bonus.value.toString()}
                            onChangeText={(text) => updateMonsterBonus(monster.id, index, text)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={theme.colors.textTertiary}
                          />
                          <TouchableOpacity
                            style={styles.removeBonusButton}
                            onPress={() => removeMonsterBonus(monster.id, index)}
                          >
                            <Text style={styles.removeBonusText}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}

                      <View style={styles.bonusButtons}>
                        <TouchableOpacity
                          style={[styles.addBonusButton, { backgroundColor: theme.colors.success }]}
                          onPress={() => addBonusToMonster(monster.id, 5)}
                        >
                          <Text style={styles.addBonusText}>+ Bonus</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.addBonusButton, { backgroundColor: theme.colors.warning }]}
                          onPress={() => addBonusToMonster(monster.id, -5)}
                        >
                          <Text style={styles.addBonusText}>- Penalty</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.totalStrength, { color: theme.colors.primary }]}>
                        Total: {calculateTotalStrength(monster)}
                      </Text>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[styles.addEntityButton, { backgroundColor: theme.colors.primary }]}
                    onPress={addAnotherMonster}
                  >
                    <Text style={styles.addEntityText}>+ Add Monster</Text>
                  </TouchableOpacity>

                  <View style={[styles.sideTotalContainer, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.sideTotalLabel, { color: theme.colors.text }]}>Monsters Total:</Text>
                    <Text style={[styles.sideTotalValue, { color: theme.colors.primary }]}>{getMonstersTotalStrength()}</Text>
                  </View>
                </View>

                {/* Battle Result */}
                <View style={[styles.battleResult, { backgroundColor: theme.colors.card, borderColor: theme.colors.warning }]}>
                  <Text style={[styles.resultText, { color: theme.colors.text }]}>
                    {getPlayersTotalStrength() > getMonstersTotalStrength()
                      ? '👥 Players Win!'
                      : getPlayersTotalStrength() < getMonstersTotalStrength()
                      ? '👹 Monsters Win!'
                      : '⚖️ It\'s a Tie!'}
                  </Text>
                  <Text style={[styles.resultDetails, { color: theme.colors.textSecondary }]}>
                    {getPlayersTotalStrength()} vs {getMonstersTotalStrength()}
                  </Text>
                </View>
              </ScrollView>
            )}

              <TouchableOpacity
                style={[styles.closeBattleButton, { backgroundColor: theme.colors.primary }]}
                onPress={closeBattle}
              >
                <Text style={styles.closeBattleButtonText}>Close Battle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Winner Modal */}
      <Modal
        visible={showWinner}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWinner(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.winnerModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.winnerEmoji}>🎉</Text>
            <Text style={[styles.winnerTitle, { color: theme.colors.text }]}>We Have a Winner!</Text>
            <Text style={[styles.winnerName, { color: theme.colors.primary }]}>{winner?.name}</Text>
            <Text style={[styles.winnerMessage, { color: theme.colors.textSecondary }]}>has reached Level 10!</Text>

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
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
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
    textAlign: 'center',
  },
  resetButton: {
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
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
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
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  levelDisplay: {
    alignItems: 'center',
    flex: 1,
  },
  levelLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  levelNumber: {
    fontSize: 48,
    fontWeight: 'bold',
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
  infoSection: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
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
  battleButton: {
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
  battleButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
  },
  statContainer: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  statControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 30,
    textAlign: 'center',
  },
  combatStrength: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  combatLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  combatValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  battleModal: {
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  battleTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  battleSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  battleSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  battlePlayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  battlePlayerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  battlePlayerStrength: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  battleInfo: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  battleInfoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  closeBattleButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBattleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  battleScrollView: {
    maxHeight: 500,
    width: '100%',
  },
  playerSelectButton: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
  },
  playerSelectName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playerSelectStrength: {
    fontSize: 14,
  },
  monsterInputContainer: {
    width: '100%',
    paddingVertical: 20,
  },
  monsterInput: {
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    borderWidth: 2,
    marginBottom: 16,
    textAlign: 'center',
  },
  monsterButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  battleSide: {
    marginBottom: 20,
  },
  sideTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  battleEntity: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  entityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entityName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  removeEntityButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeEntityText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  baseStrength: {
    fontSize: 14,
    marginBottom: 8,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  bonusSign: {
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 20,
    textAlign: 'center',
  },
  bonusInput: {
    flex: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    borderWidth: 1,
    textAlign: 'center',
  },
  removeBonusButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBonusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bonusButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  addBonusButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  positiveBonusButton: {
  },
  negativeBonusButton: {
  },
  addBonusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  totalStrength: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
  },
  addEntityButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  addEntityText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  availablePlayersLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 4,
  },
  availablePlayerButton: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderLeftWidth: 4,
  },
  availablePlayerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  noAvailablePlayersText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
  sideTotalContainer: {
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sideTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sideTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  vsDivider: {
    alignItems: 'center',
    marginVertical: 10,
  },
  vsText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  battleResult: {
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 2,
  },
  resultText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultDetails: {
    fontSize: 18,
  },
});

