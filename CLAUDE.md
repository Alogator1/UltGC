# CLAUDE.md - Project Guide for AI Assistants

## Project Overview

**UltGC** (Ultimate Game Companion) — a React Native / Expo mobile app that serves as a board game companion. It includes score trackers, dice rollers, standalone mini-games, and online multiplayer support via Firebase Firestore.

- **Framework:** React Native 0.81 + Expo 54
- **Language:** JavaScript (ES6+)
- **Platforms:** iOS, Android, Web
- **Bundle ID:** `com.groltor.ultgc`
- **Backend:** Firebase (Auth + Firestore)
- **State:** Local async storage + real-time Firestore sync

## Directory Structure

```
App.js                        # Root: providers + navigation setup
├── components/
│   ├── AdBanner.js           # Google AdMob banner (hides for premium)
│   ├── GameCard.js           # Game list card with lock/emoji
│   ├── OnlineBanner.js       # Online multiplayer banner
│   └── RoomLobby.js          # Online room management
├── config/
│   └── firebase.js           # Firebase initialization with env vars
├── constants/
│   ├── colors.js             # Theme palettes + per-game color arrays
│   ├── games.js              # Game list metadata (emoji, description, route)
│   ├── gameConfig.js         # Storage keys, timeouts, dice types, scoring tables
│   ├── playerNames.js        # Default player name helpers
│   └── words.json            # Word list for WordGuess game
├── context/
│   ├── AuthContext.js        # Firebase anonymous authentication
│   ├── ThemeContext.js       # Light/dark theme (persisted)
│   └── SubscriptionContext.js # Premium subscription state (persisted)
├── hooks/
│   └── useRoom.js            # Online room management hook
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
    ├── ads.js                # Interstitial ad load/show helpers
    └── roomCode.js           # Room code generation utilities
```

## Navigation

Bottom tabs (3):
1. **Games** — Stack navigator containing `GamesScreen` + all 12 game screens
2. **FAQ** — Single `FAQScreen`
3. **Settings** — Single `SettingsScreen`

Route names match PascalCase: `Counter`, `Munchkin`, `TicketToRide`, `Uno`, `DiceRoller`, `Catan`, `SevenWonders`, `Azul`, `PlayerSelector`, `FortuneOrb`, `TicTacToe`, `WordGuess`.

## State Management

- **AuthContext** — `useAuth()` returns `{ user, isAuthReady }`. Handles Firebase anonymous authentication.
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

- **Free tier:** 5 games (Player Selector, Fortune Orb, Counter, Dice Roller, Tic Tac Toe) + banner ads + 30% chance interstitial on returning to games list.
- **Premium:** All games unlocked + ad-free. Toggled in Settings, stored as `isPremium` in AsyncStorage.
- **AdBanner** component conditionally renders; gracefully falls back if ad module unavailable.
- Ad unit IDs use `TestIds` in dev; production IDs go in `app.json` and `utils/ads.js`.

## Adding a New Game — Checklist

1. **Create screen** — `screens/YourGameScreen.js`. Follow existing pattern: `useTheme()`, `useSubscription()`, local state, `StyleSheet.create()` at bottom.
2. **Register route** — In `App.js`, import the screen and add a `<Stack.Screen name="YourGame" component={YourGameScreen} options={{ title: 'Your Game' }} />` inside the Games stack.
3. **Add to games list** — In `constants/games.js`, add an entry: `{ name: 'Your Game', emoji: '...', description: '...', route: 'YourGame' }`. The first 5 entries are free; anything after requires premium.
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
| `firebase` | Authentication and Firestore for online multiplayer |

## Online Multiplayer (Firebase Integration)

### Architecture

Games can support **online mode** via the `useRoom()` hook. Each game using online mode:

1. **Creates or joins a room** — identified by a 4-character alphanumeric code
2. **Syncs player list** — all players see connected players in real-time
3. **Syncs shared game state** — changes broadcast to all players via Firestore listeners
4. **Manages permissions** — host can enable "allCanEdit" to let any player update shared state

### useRoom() Hook

The `useRoom(gameType)` hook manages all online features:

**State:**
- `roomCode` — 4-char unique identifier
- `isOnline` — boolean; true if in a room
- `isHost` — boolean; true if this user created the room
- `allCanEdit` — boolean; if true, any player can update shared state
- `players` — array of `{ id, displayName, joinedAt, isConnected, playerData }`
- `sharedState` — shared game state, updated in real-time
- `roomStatus` — 'waiting' | 'playing' | 'finished'
- `error` — connection error message
- `userId` — current user's Firebase UID

**Methods:**
- `createRoom(initialGameState)` — creates a room and returns the code
- `joinRoom(code)` — joins an existing room
- `leaveRoom()` — disconnects and marks as offline
- `deleteRoom()` — deletes all room data (host only)
- `updateMyPlayerData(playerData)` — update own player state
- `updatePlayerData(targetUserId, playerData)` — update another player (if allCanEdit or own)
- `updateSharedState(newState)` — update shared game state
- `toggleAllCanEdit()` — toggle permission for all players to edit (host only)

### Online Game Pattern

To add online support to a game (see `CounterScreen.js` for example):

```javascript
const room = useRoom('GameName');
const [showRoomLobby, setShowRoomLobby] = useState(false);

// Derive effective players from room OR local state
const players = room.isOnline ? room.players : localPlayers;

// On score change, update both local state and room
const updateScore = (playerId, newScore) => {
  if (room.isOnline) {
    room.updatePlayerData(playerId, { score: newScore });
  } else {
    setLocalPlayers(prev => prev.map(p => p.id === playerId ? {...p, score: newScore} : p));
  }
};

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (room.isOnline) room.deleteRoom();
  };
}, []);
```

### Firebase Firestore Schema

```
rooms/{roomCode}
  ├── gameType: string
  ├── hostId: string (userId)
  ├── status: 'waiting' | 'playing' | 'finished'
  ├── allCanEdit: boolean
  ├── createdAt: timestamp
  ├── lastActivity: timestamp
  ├── players/{userId}
  │   ├── displayName: string
  │   ├── joinedAt: timestamp
  │   ├── lastSeen: timestamp
  │   ├── isConnected: boolean
  │   └── playerData: object (game-specific)
  └── gameState/{current}
      ├── updatedAt: timestamp
      └── ... (game-specific fields)
```

### Real-time Sync Details

- **Listeners:** `useRoom()` sets up three real-time listeners (room, players subcollection, gameState)
- **Heartbeat:** Every 30s while online, updates `lastSeen` to track active players
- **Cleanup:** All listeners unsubscribed on unmount or when leaving room
- **Auto-disconnect:** If host sees `isConnected: false` for a player, they remain in the players list but marked offline

### Testing Online Features

1. Use two simulator instances (iOS + Android) or two browser tabs (web)
2. Firebase Emulator recommended for local dev (configure in `config/firebase.js`)
3. Room codes are checked for uniqueness via Firestore — collisions very unlikely but retried up to 10 times

## App Lifecycle & State Persistence

### Background/Foreground Handling

`App.js` tracks foreground/background transitions:

- **App → Background:** Timestamp saved to AsyncStorage
- **Background → Foreground:** 
  - If `timeSince(backgroundTime) > 30 minutes`, clear all game data (likely terminated)
  - Otherwise, game state restored from AsyncStorage
  
This ensures old stale data doesn't reappear if the app was force-closed.

### Storage Keys

All keys centralized in `constants/gameConfig.js` under `STORAGE_KEYS`:
```javascript
STORAGE_KEYS = {
  COUNTER: 'counterGameData',
  MUNCHKIN: 'munchkinGameData',
  // ... one per game
}
```

When adding a new game, add its storage key here to benefit from auto-clear logic in `App.js`.

## Firebase Setup

### Environment Variables

Create a `.env` file in the root with:
```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

These are loaded in `config/firebase.js` via `process.env.EXPO_PUBLIC_*`.

### Firestore Rules (Security)

Default public rules for development. For production, restrict to authenticated users and validate room membership:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Gotchas

- Ad imports are wrapped in try/catch because `react-native-google-mobile-ads` may not be available in all environments (e.g., Expo Go).
- The interstitial ad in `utils/ads.js` fires with a 30% probability on game list return — keep this in mind when testing.
- `words.json` is a flat JSON file with categories — loaded synchronously via `require()`.
- Seven Wonders science scoring uses a specific formula: `(compass² + gear² + tablet²) + (7 × min(compass, gear, tablet))`.
- Azul floor penalties follow a fixed array: `[-1, -1, -2, -2, -2, -3, -3]`.
- Firebase config is loaded from environment variables in `.env` file.
- **Online mode gotcha:** Always clean up room listeners on unmount; forgetting `useEffect` cleanup causes memory leaks and double-listeners.
- **Room code format:** 4 uppercase alphanumeric characters (generated via `roomCode.js`). User input is trimmed and uppercased before lookup.
- **allCanEdit permission:** When false, only the host can update shared state. Setting true grants all players write access — design your game's UI accordingly.
- **Player disconnect:** Players marked `isConnected: false` remain in the players list. Games should exclude them from turns/scoring if needed.

## Future Enhancement Opportunities

### High-Impact Additions

1. **Cross-game persistence** — Save player statistics/achievements across all games
2. **Spectator mode** — Allow read-only observers to join online rooms
3. **Elo/rating system** — Track player skill across games
4. **Game replay** — Store move history, allow playback
5. **Tournaments/matchmaking** — Schedule rounds, auto-match players by rating
6. **Themed game variants** — E.g., "Hardcore Munchkin" with alternate rules

### Medium-Effort Improvements

1. **Offline queue** — Queue actions while offline, sync when reconnected
2. **Push notifications** — Notify waiting players when it's their turn (Firebase Cloud Messaging)
3. **More AI opponents** — Add computer players to games
4. **Accessibility features** — Larger fonts, color-blind modes, voice commands
5. **Custom game rules** — Let users tweak scoring/card rules before game start
6. **Move validation** — Prevent invalid moves in complex games (Azul, Seven Wonders)

### Infrastructure Improvements

1. **Error reporting** — Sentry/Bugsnag integration for crash logs
2. **Analytics** — Track gameplay metrics, identify stalled games
3. **Firestore cleanup** — Scheduled jobs to delete old rooms (>7 days idle)
4. **Caching strategy** — Cache game rules/word lists locally to reduce Firestore reads
5. **Batch writes** — Group multiple updates into single transaction for consistency
6. **Rate limiting** — Prevent abuse of room creation, state updates

## Common Modifications

### Adding a Game-Specific Color Palette

In `constants/colors.js`, define per-player colors:
```javascript
export const AZUL_COLORS = ['#E74C3C', '#3498DB', '#F39C12', '#9B59B6'];
```

Then use in game:
```javascript
const playerColor = AZUL_COLORS[playerIndex % AZUL_COLORS.length];
```

### Adding Game State Validation

For complex games, validate moves before updating:
```javascript
const isValidMove = (gameState, move) => {
  // Check rules, return boolean
};

if (isValidMove(sharedState, move)) {
  await room.updateSharedState(newState);
}
```

### Extending Storage for New Game

1. Add key to `STORAGE_KEYS` in `constants/gameConfig.js`
2. Add key to cleanup array in `App.js` (line 152)
3. Use `AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))` in game
4. Use `AsyncStorage.getItem(STORAGE_KEY)` to restore on load

### Debugging Online Sync Issues

1. Check `room.error` state — displays connection errors
2. Verify `room.players.length > 0` — confirms subscription active
3. Log `room.sharedState` on every update to trace changes
4. Use Firebase console to inspect room data in real-time
5. Check browser DevTools / React Native Debugger for unhandled promise rejections
