import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput } from 'react-native';
import GameCard from '../components/GameCard';

const GAMES = [
  {
    name: 'Counter',
    description: 'Fast-paced counting game',
    route: 'Counter',
  },
  {
    name: 'Dice Roller',
    description: 'Roll multiple dice types for players and track results',
    route: 'DiceRoller',
  },
  {
    name: 'Catan',
    description: 'Settle the island - track victory points, roll dice, and compete for longest road',
    route: 'Catan',
  },
  {
    name: 'Munchkin',
    description: 'Satirical dungeon-crawling card game with backstabbing fun',
    route: 'Munchkin',
  },
  {
    name: '7 Wonders',
    description: 'Build your civilization and track points across all categories',
    route: 'SevenWonders',
  },
  {
    name: 'Ticket to Ride',
    description: 'Build railway routes across North America',
    route: 'TicketToRide',
  },
  {
    name: 'UNO',
    description: 'Classic card-matching game - don\'t forget to say UNO!',
    route: 'Uno',
  },
];

export default function GamesScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGames = GAMES.filter(game => {
    const query = searchQuery.toLowerCase();
    return (
      game.name.toLowerCase().includes(query) ||
      game.description.toLowerCase().includes(query)
    );
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Games</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search games..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
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
            <Text style={styles.noResultsText}>No games found</Text>
            <Text style={styles.noResultsSubtext}>Try a different search term</Text>
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
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
  },
});

