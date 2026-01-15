import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../context/SubscriptionContext';
import GameCard from '../components/GameCard';
import AdBanner from '../components/AdBanner';
import { loadInterstitialAd, showInterstitialAd } from '../utils/ads';

const FREE_GAMES_COUNT = 4;

const GAMES = [
  {
    name: '👆 Player Selector',
    description: 'Put thumbs on screen to randomly select a player',
    route: 'PlayerSelector',
  },
  {
    name: '🔮 Fortune Orb',
    description: 'Shake or tap to get answers to your questions',
    route: 'FortuneOrb',
  },
  {
    name: '🔢 Counter',
    description: 'Fast-paced counting game',
    route: 'Counter',
  },
  {
    name: '🎲 Dice Roller',
    description: 'Roll multiple dice types for players and track results',
    route: 'DiceRoller',
  },
  {
    name: '🏝️ Catan',
    description: 'Settle the island - track victory points, roll dice, and compete for longest road',
    route: 'Catan',
  },
  {
    name: '⚔️ Munchkin',
    description: 'Satirical dungeon-crawling card game with backstabbing fun',
    route: 'Munchkin',
  },
  {
    name: '🏛️ 7 Wonders',
    description: 'Build your civilization and track points across all categories',
    route: 'SevenWonders',
  },
  {
    name: '🚂 Ticket to Ride',
    description: 'Build railway routes across North America',
    route: 'TicketToRide',
  },
  {
    name: '🎴 UNO',
    description: 'Classic card-matching game - don\'t forget to say UNO!',
    route: 'Uno',
  },
  {
    name: '🎨 Azul',
    description: 'Beautiful tile-laying game - score walls, avoid penalties',
    route: 'Azul',
  },
];

export default function GamesScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const { theme } = useTheme();
  const { isPremium } = useSubscription();

  // Load interstitial ad on mount (for free users)
  useEffect(() => {
    if (!isPremium) {
      loadInterstitialAd();
    }
  }, [isPremium]);

  // Show interstitial when returning to this screen (from a game)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Only show interstitial sometimes (e.g., 30% chance) to not annoy users
      if (!isPremium && Math.random() < 0.3) {
        showInterstitialAd();
      }
    });

    return unsubscribe;
  }, [navigation, isPremium]);

  const filteredGames = GAMES.filter(game => {
    const query = searchQuery.toLowerCase();
    return (
      game.name.toLowerCase().includes(query) ||
      game.description.toLowerCase().includes(query)
    );
  });

  const handleGamePress = (game) => {
    const originalIndex = GAMES.findIndex(g => g.route === game.route);
    if (!isPremium && originalIndex >= FREE_GAMES_COUNT) {
      Alert.alert(
        'Premium Required',
        'This game is only available for premium users. Enable premium in Settings to unlock all games.',
        [
          { text: 'OK', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
        ]
      );
      return;
    }
    navigation.navigate(game.route);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Games</Text>

        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          placeholder="Search games..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.colors.textTertiary}
        />

        {filteredGames.length > 0 ? (
          filteredGames.map((game) => {
            const originalIndex = GAMES.findIndex(g => g.route === game.route);
            const isLocked = !isPremium && originalIndex >= FREE_GAMES_COUNT;
            return (
              <GameCard
                key={game.route}
                name={isLocked ? `🔒 ${game.name}` : game.name}
                description={game.description}
                onPress={() => handleGamePress(game)}
                locked={isLocked}
              />
            );
          })
        ) : (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>No games found</Text>
            <Text style={[styles.noResultsSubtext, { color: theme.colors.textTertiary }]}>Try a different search term</Text>
          </View>
        )}
      </ScrollView>

      {/* Banner ad at the bottom for free users */}
      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 70, // Extra space for banner ad
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  searchInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
  },
});
