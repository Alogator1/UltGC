import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function FAQScreen() {
  const { theme } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Frequently Asked Questions</Text>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>What is UltGC?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          UltGC stands for Ultimate Game Companion. It's a comprehensive companion app for tracking scores,
          managing game state, and enhancing your board game experience across multiple popular games.
        </Text>
      </View>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>What games are supported?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          Currently supports 10 games:{'\n'}
          • Player Selector - Random player selection tool{'\n'}
          • Fortune Orb (Magic 8 Ball) - Get answers to your questions{'\n'}
          • Counter - Simple score tracking{'\n'}
          • Dice Roller - Multi-dice roller with history{'\n'}
          • Catan - Victory points, dice rolling, longest road{'\n'}
          • Munchkin - Level, gear, and battle calculator{'\n'}
          • 7 Wonders - Complete scoring system{'\n'}
          • Ticket to Ride - Route and destination tracking{'\n'}
          • UNO - Round-based score tracking{'\n'}
          • Azul - Wall tiling, floor penalties, end game bonuses
        </Text>
      </View>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>How does the 7 Wonders science scoring work?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          Science scoring uses the formula: n² + 7 per set.{'\n\n'}
          • Each symbol (📐 compass, ⚙️ gear, 📜 tablet) gives points equal to its count squared{'\n'}
          • Complete sets of all 3 symbols give 7 bonus points each{'\n\n'}
          Example: 3 compasses, 2 gears, 2 tablets = (3² + 2² + 2²) + (2 × 7) = 9 + 4 + 4 + 14 = 31 points
        </Text>
      </View>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>How does the Munchkin battle calculator work?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          Enter your level and gear strength, then the monster's level and any bonuses.
          The calculator automatically determines if you win or lose the battle based on total combat strength.
        </Text>
      </View>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>What dice types are available in Dice Roller?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          d2, d3, d4, d6, d8, d10, d12, d20, and d100. Each dice type has its own unique visual representation
          and color coding for easy identification.
        </Text>
      </View>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>Is my game data saved?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          Yes! Game data is automatically saved locally on your device. Your progress persists even if you
          close the app. The auto-save feature includes a 30-minute timeout - if you haven't made changes
          in 30 minutes, the data is preserved but considered inactive.
        </Text>
      </View>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>Can I edit player names?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          Yes, in most games you can tap on a player's name to edit it. This helps personalize your
          gaming experience.
        </Text>
      </View>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>How do I clear all saved data?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          Use the "Clear Data" tab at the bottom of the app. This will remove all saved game data
          across all games. This action cannot be undone, so use it carefully!
        </Text>
      </View>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>Is this app free?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          Yes! The app is free with ads. The first 4 games are completely free to use.{' \n\n'}
          Free users get:{' \n'}
          • Player Selector{' \n'}
          • Fortune Orb{' \n'}
          • Counter{' \n'}
          • Dice Roller{' \n\n'}
          Banner ads are displayed at the bottom of screens, and occasional interstitial ads may appear.
        </Text>
      </View>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>What does Premium subscription include?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          Premium subscription unlocks:{' \n'}
          • All 10 games (Catan, Munchkin, 7 Wonders, Ticket to Ride, UNO, Azul){' \n'}
          • No banner ads{' \n'}
          • No interstitial ads{' \n'}
          • Support ongoing development{' \n\n'}
          You can subscribe in the Settings screen. Premium is an optional one-time or recurring purchase.
        </Text>
      </View>

      <View style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.question, { color: theme.colors.primary }]}>How do ads work?</Text>
        <Text style={[styles.answer, { color: theme.colors.text }]}>
          For free users:{' \n'}
          • Banner ads appear at the bottom of most screens{' \n'}
          • Interstitial ads may occasionally show when returning to the games list{' \n'}
          • Ads are powered by Google AdMob{' \n\n'}
          Premium users experience no ads at all.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  faqItem: {
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  question: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  answer: {
    fontSize: 14,
    lineHeight: 20,
  },
});
