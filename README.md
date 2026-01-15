# UltGC - Ultimate Game Companion

A React Native Expo app for managing and playing various board games with friends.

## Features

- � **10 Game Utilities:**
  - 👆 **Player Selector** - Random player selection tool
  - 🔮 **Fortune Orb** (Magic 8 Ball) - Get answers to your questions
  - 🔢 **Counter** - Simple score tracking
  - 🎲 **Dice Roller** - Multi-dice roller with history for players
  - 🏝️ **Catan** - Victory points, dice rolling, longest road tracking
  - ⚔️ **Munchkin** - Level, gear, and battle calculator
  - 🏛️ **7 Wonders** - Complete scoring system for all categories
  - 🚂 **Ticket to Ride** - Route and destination tracking
  - 🎴 **UNO** - Round-based score tracking
  - 🎨 **Azul** - Wall tiling, floor penalties, end game bonuses
- 🎉 **Free to Use** - First 4 games are completely free
- 💳 **Premium Subscription** - Unlock all games and remove ads
- 📱 Cross-platform (iOS, Android, Web)
- 🎨 Dark/Light theme support
- 💾 Auto-save game data locally
- 🎯 Bottom tab navigation
- ⚙️ Settings screen with subscription management
- ❓ Comprehensive FAQ screen

## Project Structure

```
UltGC/
├── App.js                 # Main app component with navigation
├── app.json              # Expo configuration
├── package.json          # Dependencies
├── babel.config.js       # Babel configuration
├── components/           # Reusable components
│   └── GameCard.js       # Game card component
├── screens/              # Screen components
│   ├── GamesScreen.js    # Games list
│   ├── CounterScreen.js
│   ├── MunchkinScreen.js
│   ├── TicketToRideScreen.js
│   ├── UnoScreen.js
│   ├── DiceRollerScreen.js
│   ├── CatanScreen.js
│   ├── SevenWondersScreen.js
│   ├── SettingsScreen.js
│   └── FAQScreen.js
├── assets/               # Images and other assets
└── node_modules/         # Dependencies

```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`

### Installation

1. Clone or navigate to the project directory:
```bash
cd UltGC
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

### Running on Different Platforms

- **iOS Simulator:**
  ```bash
  npm run ios
  ```

- **Android Emulator:**
  ```bash
  npm run android
  ```

- **Web Browser:**
  ```bash
  npm run web
  ```

## Technologies Used

- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform and tooling
- **React Navigation** - Navigation library with bottom tabs and stack navigation
- **AsyncStorage** - Local data persistence
- **React 19** - Latest React version
- **Google AdMob** - Ad monetization for free tier
- **Context API** - State management for theme and subscription

## Monetization Model

### Free Tier
- Access to 4 games: Player Selector, Fortune Orb, Counter, and Dice Roller
- Banner ads displayed at bottom of screens
- Occasional interstitial ads

### Premium Subscription
- Unlocks all 10 games
- Complete ad-free experience
- Support ongoing development
- One-time or recurring purchase available in Settings

## Development

### Adding a New Game Screen

1. Create a new screen component in `screens/YourGameScreen.js`
2. Import it in `App.js`
3. Add it to the navigation stack
4. Add a game card in `GamesScreen.js`

### Scripts

- `npm start` - Start the dev server
- `npm run android` - Start Android emulator
- `npm run ios` - Start iOS simulator
- `npm run web` - Start web version

## License

MIT
