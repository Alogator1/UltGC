// Storage keys for different games
export const STORAGE_KEYS = {
  COUNTER: 'counterGameData',
  SEVEN_WONDERS: 'sevenWondersGameData',
  TICKET_TO_RIDE: 'ticketToRideGameData',
  UNO: 'unoGameData',
  MUNCHKIN: 'munchkinGameData',
  CATAN: 'catanGameData',
  AZUL: 'azulGameData',
  WORD_GUESS: 'wordGuessGameData',
};

// Auto-save timeout (30 minutes)
export const AUTO_SAVE_TIMEOUT = 30 * 60 * 1000;

// Dice types available in dice roller
export const DICE_TYPES = [2, 3, 4, 6, 8, 10, 12, 20, 100];

// Ticket to Ride route points
export const ROUTE_POINTS = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 10,
  6: 15,
  7: 18,
  8: 21,
};

// Initial Tic Tac Toe board
export const INITIAL_TIC_TAC_TOE_BOARD = Array(9).fill(null);

// WordGuess game defaults
export const WORD_GUESS_DEFAULTS = {
  roundTime: 60,          // seconds (regular mode)
  speedModeTime: 30,      // seconds (speed mode)
  extendedModeTime: 90,   // seconds (extended mode)
  skipPenalty: 0,         // points deducted on skip (0 or -1)
  targetScore: 30,        // points to win
  lastWordRule: 'lost',   // 'lost', 'nextTeam', 'allTeams'
  soundEnabled: true,     // sound effects toggle
};

// Online multiplayer constants
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds
export const STALE_ROOM_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

// Ad cooldown — minimum ms between game-launch interstitials
export const GAME_LAUNCH_AD_COOLDOWN_MS = 1 * 60 * 1000; // 1 minute
