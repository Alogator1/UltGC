# UltGC - Ultimate Game Companion

A React Native Expo app for managing and playing various board games with friends, featuring both local and online multiplayer modes.

## Features

- 🎮 **12 Game Utilities:**
  - 👆 **Player Selector** - Random player selection tool
  - 🔮 **Fortune Orb** (Magic 8 Ball) - Get answers to your questions
  - 🔢 **Counter** - Simple +/- score counter
  - 🎲 **Dice Roller** - Multi-dice roller with history
  - ⭕ **Tic Tac Toe** - Classic strategy game
  - 🏝️ **Catan** - Victory points, dice rolling, longest road tracking
  - ⚔️ **Munchkin** - Level, gear, and battle calculator
  - 🏛️ **7 Wonders** - Complete scoring system for all categories
  - 🚂 **Ticket to Ride** - Route-based scoring
  - 🎴 **UNO** - Round-based cumulative scoring
  - 🎨 **Azul** - Tile placement + floor penalties
  - 🎯 **Word Guess** - Timed team word-guessing
- 🌐 **Online Multiplayer** - Play games with friends remotely using Firebase
- 🎉 **Free to Use** - First 5 games are completely free
- 💳 **Premium Subscription** - Unlock all games and remove ads
- 📱 Cross-platform (iOS, Android, Web)
- 🎨 Dark/Light theme support
- 💾 Auto-save game data locally
- 🎯 Bottom tab navigation
- ⚙️ Settings screen with theme and subscription management
- ❓ Comprehensive FAQ screen
- 📢 Ad-supported with Google AdMob

## Project Structure

```
UltGC/
├── App.js                    # Root: providers + navigation setup
├── app.json                  # Expo configuration
├── package.json              # Dependencies
├── babel.config.js           # Babel configuration
├── .env                      # Environment variables (Firebase config)
├── .gitignore                # Git ignore rules
├── README.md                 # This file
├── CLAUDE.md                 # AI assistant guide
├── assets/                   # Images and other assets
├── components/               # Reusable components
│   ├── AdBanner.js           # Google AdMob banner (hides for premium)
│   ├── GameCard.js           # Game list card with lock/emoji
│   ├── OnlineBanner.js       # Online multiplayer banner
│   └── RoomLobby.js          # Online room management
├── config/                   # Configuration files
│   └── firebase.js           # Firebase initialization
├── constants/                # App constants
│   ├── colors.js             # Theme palettes + per-game colors
│   ├── games.js              # Game list metadata
│   ├── gameConfig.js         # Storage keys, timeouts, scoring tables
│   ├── playerNames.js        # Default player name helpers
│   └── words.json            # Word list for WordGuess game
├── context/                  # React contexts
│   ├── AuthContext.js        # Firebase authentication
│   ├── ThemeContext.js       # Light/dark theme
│   └── SubscriptionContext.js # Premium subscription state
├── hooks/                    # Custom React hooks
│   └── useRoom.js            # Online room management
├── screens/                  # Screen components (15 total)
│   ├── GamesScreen.js        # Home — searchable game list
│   ├── SettingsScreen.js     # Theme toggle, premium toggle
│   ├── FAQScreen.js          # Accordion FAQ
│   ├── CounterScreen.js      # Simple +/- score counter
│   ├── DiceRollerScreen.js   # Multi-dice with history
│   ├── PlayerSelectorScreen.js # Multi-touch random selector
│   ├── Magic8BallScreen.js   # Shake-to-reveal fortune orb
│   ├── TicTacToeScreen.js    # Classic tic-tac-toe
│   ├── MunchkinScreen.js     # Battle calculator
│   ├── TicketToRideScreen.js # Route-based scoring
│   ├── CatanScreen.js        # Victory point tracker
│   ├── SevenWondersScreen.js # Full 7-category scoring
│   ├── UnoScreen.js          # Round-based cumulative scoring
│   ├── AzulScreen.js         # Tile placement + floor penalties
│   └── WordGuessScreen.js    # Timed team word-guessing
├── utils/                    # Utility functions
│   ├── ads.js                # Interstitial ad helpers
│   └── roomCode.js           # Room code generation
└── ios/                      # iOS native code
    └── ...                   # Xcode project files
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

3. Create a `.env` file with your Firebase configuration (copy from `.env.example`)

4. Start the development server:
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

## Online Multiplayer

Several games support real-time multiplayer using Firebase Firestore:

- Create or join rooms with unique codes
- Real-time synchronization of game state
- Anonymous authentication for seamless play
- Supported games: Counter, Tic Tac Toe, Catan, Munchkin, 7 Wonders, Ticket to Ride, UNO, Azul, Word Guess

To enable online features, configure your Firebase project and add the credentials to `.env`.

## Technologies Used

- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform and tooling
- **Firebase** - Authentication, Firestore for online multiplayer
- **React Navigation** - Bottom tabs and stack navigation
- **AsyncStorage** - Local data persistence
- **Google AdMob** - Mobile advertising
- **Expo Sensors** - Device accelerometer for Magic 8 Ball

## Monetization Model

### Free Tier
- Access to 5 games: Player Selector, Fortune Orb, Counter, Dice Roller, and Tic Tac Toe
- Banner ads displayed at bottom of screens
- Occasional interstitial ads

### Premium Subscription
- Unlocks all 12 games
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
