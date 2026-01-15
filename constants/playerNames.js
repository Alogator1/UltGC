// Default player names for various game screens
export const DEFAULT_PLAYER_NAMES = [
  'Player 1',
  'Player 2',
  'Player 3',
  'Player 4',
  'Player 5',
  'Player 6',
  'Player 7',
];

export const getDefaultPlayerName = (playerId) => {
  return DEFAULT_PLAYER_NAMES[playerId - 1] || `Player ${playerId}`;
};

// Helper to load custom names from storage
export const loadPlayerNames = async (AsyncStorage) => {
  try {
    const saved = await AsyncStorage.getItem('customPlayerNames');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading custom player names:', error);
  }
  return [...DEFAULT_PLAYER_NAMES];
};
