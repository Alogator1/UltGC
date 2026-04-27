import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

export default function OnlineBanner({ room, onPress }) {
  const { theme } = useTheme();

  if (!room.isOnline) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: theme.colors.success }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Ionicons name="wifi" size={16} color="#fff" style={styles.icon} />
        <Text style={styles.text}>
          Online: {room.roomCode} ({room.players.length} player{room.players.length !== 1 ? 's' : ''})
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
