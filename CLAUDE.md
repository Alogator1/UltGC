# CLAUDE.md - Project Guide for AI Assistants

## Project Overview

**UltGC** (Ultimate Game Companion) — a React Native / Expo mobile app that serves as a board game companion. It includes score trackers, dice rollers, and standalone mini-games.

- **Framework:** React Native 0.81 + Expo 54
- **Language:** JavaScript (ES6+)
- **Platforms:** iOS, Android, Web
- **Bundle ID:** `com.groltor.ultgc`

## Directory Structure

```
App.js                        # Root: providers + navigation setup
├── components/
│   ├── AdBanner.js           # Google AdMob banner (hides for premium)
│   └── GameCard.js           # Game list card with lock/emoji
├── context/
│   ├── ThemeContext.js        # Light/dark theme (persisted)
│   └── SubscriptionContext.js # Premium subscription state (persisted)
├── constants/
│   ├── colors.js             # Theme palettes + per-game color arrays
│   ├── games.js              # Game list metadata (emoji, description, route)
│   ├── gameConfig.js         # Storage keys, timeouts, dice types, scoring tables
│   ├── playerNames.js        # Default player name helpers
│   └── words.json            # Word list for WordGuess game
├── screens/                  # One file per screen (15 total)
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
└── utils/
    └── ads.js                # Interstitial ad load/show helpers
```

## Navigation

Bottom tabs (3):
1. **Games** — Stack navigator containing `GamesScreen` + all 13 game screens
2. **FAQ** — Single `FAQScreen`
3. **Settings** — Single `SettingsScreen`

Route names match PascalCase: `Counter`, `Munchkin`, `TicketToRide`, `Uno`, `DiceRoller`, `Catan`, `SevenWonders`, `Azul`, `PlayerSelector`, `FortuneOrb`, `TicTacToe`, `WordGuess`.

## State Management

- **ThemeContext** — `useTheme()` returns `{ theme, isDark, toggleTheme }`. Colors at `theme.colors.*`.
- **SubscriptionContext** — `useSubscription()` returns `{ isPremium, toggleSubscription }`.
- **Local state** — Each screen manages its own `useState` / `useEffect` / `useRef`.
- **Persistence** — `AsyncStorage` with keys centralized in `gameConfig.js → STORAGE_KEYS`.
- **Auto-save timeout** — 30-minute window; data cleared if app terminated beyond that.

## Styling Conventions

- `StyleSheet.create()` at the bottom of every screen file.
- Theme colors accessed via `const { theme } = useTheme()` then `theme.colors.primary`, `.background`, `.surface`, `.text`, `.textSecondary`, `.border`, `.danger`, `.success`, `.warning`, `.card`, `.overlay`.
- Flexbox layouts; shadows for depth; `TouchableOpacity` for pressable elements.
- No external UI library — all custom components.

## Monetization

- **Free tier:** 4 games (Player Selector, Fortune Orb, Counter, Dice Roller) + banner ads + 30% chance interstitial on returning to games list.
- **Premium:** All games unlocked + ad-free. Toggled in Settings, stored as `isPremium` in AsyncStorage.
- **AdBanner** component conditionally renders; gracefully falls back if ad module unavailable.
- Ad unit IDs use `TestIds` in dev; production IDs go in `app.json` and `utils/ads.js`.

## Adding a New Game — Checklist

1. **Create screen** — `screens/YourGameScreen.js`. Follow existing pattern: `useTheme()`, `useSubscription()`, local state, `StyleSheet.create()` at bottom.
2. **Register route** — In `App.js`, import the screen and add a `<Stack.Screen name="YourGame" component={YourGameScreen} options={{ title: 'Your Game' }} />` inside the Games stack.
3. **Add to games list** — In `constants/games.js`, add an entry: `{ name: 'Your Game', emoji: '...', description: '...', route: 'YourGame' }`. The first 4 entries are free; anything after requires premium.
4. **Storage key** — If game state needs persistence, add a key to `STORAGE_KEYS` in `constants/gameConfig.js` and use `AsyncStorage.setItem/getItem` in the screen.
5. **Game-specific colors** — If the game needs a color palette (e.g., per-player colors), add an array to `constants/colors.js`.
6. **Game-specific config** — Scoring tables, default values, etc. go in `constants/gameConfig.js`.

## Key Patterns

| Pattern | Convention |
|---------|-----------|
| File names | PascalCase (`CounterScreen.js`, `GameCard.js`) |
| Variables | camelCase |
| Constants | UPPER_SNAKE_CASE |
| Route names | PascalCase matching screen name |
| Icons | `Ionicons` from `@expo/vector-icons` |
| Confirmations | `Alert.alert()` with cancel/confirm buttons |
| Animations | `Animated` API with `useNativeDriver: true` |
| Gestures | `PanResponder` for swipe-based interactions |
| Player objects | `{ id, name, score, ...gameSpecificFields }` |
| Game phases | Setup → Playing → GameOver (varies per game) |

## Commands

```bash
npx expo start          # Start dev server
npx expo start --ios    # iOS simulator
npx expo start --android # Android emulator
npx expo start --web    # Web browser
```

## Dependencies Worth Knowing

| Package | Purpose |
|---------|---------|
| `expo-sensors` | Accelerometer (Magic 8 Ball shake detection) |
| `react-native-google-mobile-ads` | AdMob banners + interstitials |
| `@react-native-async-storage/async-storage` | All local persistence |
| `@react-navigation/*` | Bottom tabs + native stack |
| `@expo/vector-icons` | Ionicons throughout the UI |

## Gotchas

- Ad imports are wrapped in try/catch because `react-native-google-mobile-ads` may not be available in all environments (e.g., Expo Go).
- The interstitial ad in `utils/ads.js` fires with a 30% probability on game list return — keep this in mind when testing.
- `words.json` is a flat JSON file with categories — loaded synchronously via `require()`.
- Seven Wonders science scoring uses a specific formula: `(compass² + gear² + tablet²) + (7 × min(compass, gear, tablet))`.
- Azul floor penalties follow a fixed array: `[-1, -1, -2, -2, -2, -3, -3]`.
