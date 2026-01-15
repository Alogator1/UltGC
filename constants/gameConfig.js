// Storage keys for different games
export const STORAGE_KEYS = {
  COUNTER: 'counterGameData',
  SEVEN_WONDERS: 'sevenWondersGameData',
  TICKET_TO_RIDE: 'ticketToRideGameData',
  UNO: 'unoGameData',
  MUNCHKIN: 'munchkinGameData',
  CATAN: 'catanGameData',
  AZUL: 'azulGameData',
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
