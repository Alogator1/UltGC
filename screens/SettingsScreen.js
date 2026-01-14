import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={clearAllData}>
          <Text style={styles.dangerButtonText}>Clear All Game Data</Text>
        </TouchableOpacity>
        <Text style={styles.helpText}>
          This will permanently delete all saved game data for all games. This action cannot be undone.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>
          UltGC - Ultimate Game Companion{'\n'}
          Version 1.0.0{'\n\n'}
          A companion app for tracking scores and game state across multiple popular board games.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Auto-Save</Text>
        <Text style={styles.helpText}>
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
    color: '#333',
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
    color: '#666',
    lineHeight: 20,
  },
  aboutText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
});
