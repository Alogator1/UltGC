import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Linking, Switch, TextInput, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';
import { FREE_GAMES_COUNT } from '../constants/games';

export default function SettingsScreen() {
  const { isDarkMode, toggleTheme, theme } = useTheme();
  const { isPremium, isLoading, product, purchasePremium, restorePurchases } = useSubscription();
  const { displayName, updateDisplayName } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(displayName);
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

  const handleSaveName = async () => {
    if (tempName.trim()) {
      await updateDisplayName(tempName.trim());
      setIsEditingName(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View style={[styles.section, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Profile</Text>
        <View style={[styles.themeToggle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {isEditingName ? (
            <TextInput
              style={[
                styles.nameInput,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.primary,
                }
              ]}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Enter your name"
              placeholderTextColor={theme.colors.textTertiary}
              maxLength={30}
            />
          ) : (
            <Text style={[styles.themeLabel, { color: theme.colors.text }]}>{displayName}</Text>
          )}
          <TouchableOpacity
            onPress={() => {
              if (isEditingName) {
                handleSaveName();
              } else {
                setTempName(displayName);
                setIsEditingName(true);
              }
            }}
            style={styles.editButton}
          >
            <Text style={[styles.editButtonText, { color: theme.colors.primary }]}>
              {isEditingName ? 'Save' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
          Your display name appears in online game rooms
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Subscription</Text>
        {isPremium ? (
          <View style={[styles.premiumActive, { backgroundColor: theme.colors.surface, borderColor: theme.colors.success }]}>
            <Text style={[styles.premiumActiveTitle, { color: theme.colors.success }]}>Premium Active</Text>
            <Text style={[styles.toggleSubtext, { color: theme.colors.textSecondary }]}>
              All games unlocked · No ads
            </Text>
          </View>
        ) : (
          <View style={[styles.premiumCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.themeLabel, { color: theme.colors.text }]}>UltGC Premium</Text>
            <Text style={[styles.toggleSubtext, { color: theme.colors.textSecondary }]}>
              Unlock all games · Remove ads
            </Text>
            <TouchableOpacity
              style={[styles.purchaseButton, { backgroundColor: theme.colors.primary }, isLoading && styles.purchaseButtonDisabled]}
              onPress={purchasePremium}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.purchaseButtonText}>
                  {product ? `${product.displayPrice} / month` : 'Get Premium'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity onPress={restorePurchases} disabled={isLoading}>
          <Text style={[styles.restoreText, { color: theme.colors.primary }]}>Restore Purchases</Text>
        </TouchableOpacity>
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
        {__DEV__ && (
          <TouchableOpacity
            style={[styles.dangerButton, { marginTop: 8, backgroundColor: '#666' }]}
            onPress={async () => {
              await AsyncStorage.removeItem('isPremium');
              Alert.alert('Dev', 'Premium status cleared. Restart the app.');
            }}
          >
            <Text style={styles.dangerButtonText}>[DEV] Reset Premium</Text>
          </TouchableOpacity>
        )}
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
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    borderBottomWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  premiumActive: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  premiumActiveTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  premiumCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  purchaseButton: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  restoreText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
