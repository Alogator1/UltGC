// Number of free games before premium is required
export const FREE_GAMES_COUNT = 6;

// Available games list
export const GAMES = [
  {
    name: '👆 Player Selector',
    description: 'Put thumbs on screen to randomly select a player',
    route: 'PlayerSelector',
    supportsOnline: false,
  },
  {
    name: '🔮 Fortune Orb',
    description: 'Shake or tap to get answers to your questions',
    route: 'FortuneOrb',
    supportsOnline: false,
  },
  {
    name: '🔢 Counter',
    description: 'Fast-paced counting game',
    route: 'Counter',
    supportsOnline: true,
  },
  {
    name: '🎲 Dice Roller',
    description: 'Roll multiple dice types for players and track results',
    route: 'DiceRoller',
    supportsOnline: true,
  },
  {
    name: '⭕ Tic Tac Toe',
    description: 'Classic strategy game - get three in a row to win, or play against AI',
    route: 'TicTacToe',
    supportsOnline: true,
  },
  {
    name: '🪨 Rock Paper Scissors',
    description: 'Quick battle - rock beats scissors, scissors beats paper, paper beats rock',
    route: 'RockPaperScissors',
    supportsOnline: true,
  },
  {
    name: '🏝️ Catan',
    description: 'Settle the island - track victory points, roll dice, and compete for longest road',
    route: 'Catan',
    supportsOnline: true,
  },
  {
    name: '⚔️ Munchkin',
    description: 'Satirical dungeon-crawling card game with backstabbing fun',
    route: 'Munchkin',
    supportsOnline: true,
  },
  {
    name: '🏛️ 7 Wonders',
    description: 'Build your civilization and track points across all categories',
    route: 'SevenWonders',
    supportsOnline: true,
  },
  {
    name: '🚂 Ticket to Ride',
    description: 'Build railway routes across North America',
    route: 'TicketToRide',
    supportsOnline: true,
  },
  {
    name: '🎴 UNO',
    description: 'Classic card-matching game - don\'t forget to say UNO!',
    route: 'Uno',
    supportsOnline: true,
  },
  {
    name: '🎨 Azul',
    description: 'Beautiful tile-laying game - score walls, avoid penalties',
    route: 'Azul',
    supportsOnline: true,
  },
  {
    name: '🎯 Word Guess',
    description: 'Explain words to your team - swipe to guess or skip',
    route: 'WordGuess',
    supportsOnline: false,
  },
  {
    name: '🎲 Yahtzee',
    description: 'Roll five dice up to three times and score 13 categories to win',
    route: 'Yahtzee',
    supportsOnline: true,
  },
];
