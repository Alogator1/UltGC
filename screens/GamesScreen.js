import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import GameCard from '../components/GameCard';

const GAMES = [
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
];

export default function GamesScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const { theme } = useTheme();

  const filteredGames = GAMES.filter(game => {
    const query = searchQuery.toLowerCase();
    return (
      game.name.toLowerCase().includes(query) ||
      game.description.toLowerCase().includes(query)
    );
  });

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
          filteredGames.map((game) => (
            <GameCard
              key={game.route}
              name={game.name}
              description={game.description}
              onPress={() => navigation.navigate(game.route)}
            />
          ))
        ) : (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>No games found</Text>
            <Text style={[styles.noResultsSubtext, { color: theme.colors.textTertiary }]}>Try a different search term</Text>
          </View>
        )}
      </ScrollView>
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

