import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Linking, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';

export default function SettingsScreen() {
  const { isDarkMode, toggleTheme, theme } = useTheme();
  const { isPremium, togglePremium } = useSubscription();
  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all saved game data? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'ticketToRideGameData',
                'munchkinGameData',
                'counterGameData',
                'unoGameData',
                'diceRollerGameData',
                'catanGameData',
                'sevenWondersGameData'
              ]);
              Alert.alert('Success', 'All game data has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data: ' + error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View style={[styles.section, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Subscription</Text>
        <View style={[styles.themeToggle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.themeLabel, { color: theme.colors.text }]}>Premium Mode</Text>
            <Text style={[styles.toggleSubtext, { color: theme.colors.textSecondary }]}>
              {isPremium ? 'All games unlocked' : 'Only 4 games available'}
            </Text>
          </View>
          <Switch value={isPremium} onValueChange={togglePremium} />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Appearance</Text>
        <View style={[styles.themeToggle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.themeLabel, { color: theme.colors.text }]}>Dark Mode</Text>
          <Switch value={isDarkMode} onValueChange={toggleTheme} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Data Management</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={clearAllData}>
          <Text style={styles.dangerButtonText}>Clear All Game Data</Text>
        </TouchableOpacity>
        <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
          This will permanently delete all saved game data for all games. This action cannot be undone.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About</Text>
        <Text style={[styles.aboutText, { color: theme.colors.text }]}>
          UltGC - Ultimate Game Companion{'\n'}
          Version 1.0.0{'\n\n'}
          A companion app for tracking scores and game state across multiple popular board games.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Auto-Save</Text>
        <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
          Game data is automatically saved as you play. If the app is closed for more than 30 minutes,
          saved data will be cleared on next launch.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  themeToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  themeLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggleSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    lineHeight: 20,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
