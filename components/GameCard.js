import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function GameCard({ name, description, onPress }) {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        { 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        }
      ]} 
      onPress={onPress}
    >
      <Text style={[styles.name, { color: theme.colors.text }]}>{name}</Text>
      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
});
