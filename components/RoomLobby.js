import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Share,
  Switch,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';

export default function RoomLobby({ visible, onClose, room, gameType }) {
  const { theme } = useTheme();
  const { isPremium } = useSubscription();
  const [mode, setMode] = useState('menu'); // 'menu' | 'lobby'
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    room.setError(null);
    const code = await room.createRoom();
    setIsCreating(false);
    if (code) {
      setMode('lobby');
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      room.setError('Please enter a room code.');
      return;
    }
    setIsJoining(true);
    room.setError(null);
    const success = await room.joinRoom(joinCode);
    setIsJoining(false);
    if (success) {
      setMode('lobby');
      setJoinCode('');
    }
    // error is shown inline via room.error
  };

  const handleLeaveRoom = () => {
    Alert.alert('Leave Room', 'Are you sure you want to leave this game room?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          room.leaveRoom();
          setMode('menu');
          setJoinCode('');
        },
      },
    ]);
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join my game room! Code: ${room.roomCode}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCopyCode = () => {
    Alert.alert('Room Code', `${room.roomCode}\n\nShare this code with other players.`);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={[styles.container, { backgroundColor: theme.colors.overlay }]}>
        <View
          style={[
            styles.content,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {mode === 'menu' ? 'Game Room' : 'Room Lobby'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Inline error banner */}
            {room.error ? (
              <View style={[styles.errorBanner, { backgroundColor: theme.colors.danger + '22', borderColor: theme.colors.danger }]}>
                <Ionicons name="alert-circle" size={16} color={theme.colors.danger} style={styles.errorIcon} />
                <Text style={[styles.errorText, { color: theme.colors.danger }]}>{room.error}</Text>
              </View>
            ) : null}

            {mode === 'menu' ? (
              <>
                <View style={styles.section}>
                  <Text style={[styles.subtitle, { color: theme.colors.text }]}>
                    Play {gameType} Online
                  </Text>
                </View>

                {isPremium ? (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.primaryButton,
                      { backgroundColor: theme.colors.primary },
                      isCreating && styles.buttonDisabled,
                    ]}
                    onPress={handleCreateRoom}
                    disabled={isCreating}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color="#fff"
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.buttonText}>
                      {isCreating ? 'Creating...' : 'Create Room'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.premiumGate, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Ionicons name="lock-closed" size={20} color={theme.colors.warning} style={styles.buttonIcon} />
                    <Text style={[styles.premiumGateText, { color: theme.colors.textSecondary }]}>
                      Creating rooms requires Premium. You can still join rooms for free.
                    </Text>
                  </View>
                )}

                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                  Already have a room code?
                </Text>

                <TextInput
                  style={[
                    styles.codeInput,
                    {
                      color: theme.colors.text,
                      borderColor: room.error ? theme.colors.danger : theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                  placeholder="Enter room code (e.g., BA3KO7)"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={joinCode}
                  onChangeText={(text) => {
                    setJoinCode(text.toUpperCase());
                    if (room.error) room.setError(null);
                  }}
                  maxLength={6}
                  editable={!isJoining}
                  autoCapitalize="characters"
                />

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.secondaryButton,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.primary,
                    },
                    isJoining && styles.buttonDisabled,
                  ]}
                  onPress={handleJoinRoom}
                  disabled={isJoining || !joinCode.trim()}
                >
                  <Ionicons
                    name="enter-outline"
                    size={20}
                    color={theme.colors.primary}
                    style={styles.buttonIcon}
                  />
                  <Text style={[styles.buttonText, { color: theme.colors.primary }]}>
                    {isJoining ? 'Joining...' : 'Join Room'}
                  </Text>
                </TouchableOpacity>

                <View style={[styles.infoBox, { backgroundColor: theme.colors.surface }]}>
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={theme.colors.primary}
                    style={styles.infoIcon}
                  />
                  <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                    {isPremium
                      ? 'Create a room to invite friends, or join an existing room with a code.'
                      : 'Join an existing room with a code. Upgrade to Premium to create rooms.'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                {/* Lobby Mode */}
                <View style={styles.section}>
                  <View style={[styles.codeDisplay, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.codeLabel, { color: theme.colors.textSecondary }]}>
                      Room Code
                    </Text>
                    <Text style={[styles.codeValue, { color: theme.colors.primary }]}>
                      {room.roomCode}
                    </Text>
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: theme.colors.surface, flex: 1 }]}
                      onPress={handleCopyCode}
                    >
                      <Ionicons name="copy" size={18} color={theme.colors.primary} />
                      <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>
                        Copy
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: theme.colors.primary, flex: 1, marginLeft: 8 }]}
                      onPress={handleShareCode}
                    >
                      <Ionicons name="share-social" size={18} color="#fff" />
                      <Text style={[styles.actionButtonText, { color: '#fff' }]}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Everyone Can Edit toggle */}
                <View style={[styles.editToggleRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={styles.editToggleInfo}>
                    <Text style={[styles.editToggleLabel, { color: theme.colors.text }]}>
                      Everyone Can Edit
                    </Text>
                    <Text style={[styles.editToggleSubtext, { color: theme.colors.textSecondary }]}>
                      {room.allCanEdit
                        ? 'All players can update the game state'
                        : 'Only the host can update the game state'}
                    </Text>
                  </View>
                  <Switch
                    value={room.allCanEdit}
                    onValueChange={room.isHost ? room.toggleAllCanEdit : undefined}
                    disabled={!room.isHost}
                  />
                </View>
                {!room.isHost && (
                  <Text style={[styles.hostOnlyNote, { color: theme.colors.textSecondary }]}>
                    Only the host can change this setting.
                  </Text>
                )}

                {/* Players List */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Players ({room.players.length})
                  </Text>

                  <View style={[styles.playersList, { borderColor: theme.colors.border }]}>
                    {room.players.map((player) => (
                      <View
                        key={player.id}
                        style={[styles.playerItem, { borderBottomColor: theme.colors.border }]}
                      >
                        <View style={styles.playerInfo}>
                          <View
                            style={[
                              styles.statusDot,
                              {
                                backgroundColor: player.isConnected
                                  ? theme.colors.success
                                  : theme.colors.textTertiary,
                              },
                            ]}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.playerName, { color: theme.colors.text }]}>
                              {player.displayName}
                              {player.id === room.userId ? ' (You)' : ''}
                            </Text>
                          </View>
                          {player.id === room.players[0]?.id && (
                            <Ionicons name="trophy" size={16} color={theme.colors.warning} />
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Status */}
                <View style={[styles.statusSection, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>
                    Status: {room.roomStatus}
                  </Text>
                  {room.isHost && (
                    <Text style={[styles.hostLabel, { color: theme.colors.warning }]}>
                      You are the host
                    </Text>
                  )}
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          {mode === 'lobby' && (
            <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.colors.danger }]}
                onPress={handleLeaveRoom}
              >
                <Text style={styles.buttonText}>Leave Room</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'menu' && (
            <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.colors.textTertiary }]}
                onPress={onClose}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    maxHeight: '90%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  primaryButton: {
    marginTop: 0,
  },
  secondaryButton: {
    borderWidth: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  premiumGate: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 8,
  },
  premiumGateText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  codeDisplay: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  codeValue: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  editToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  editToggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  editToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  editToggleSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  hostOnlyNote: {
    fontSize: 12,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  playersList: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  playerItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusSection: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
  },
  hostLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
