import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AdBanner from '../components/AdBanner';
import { INITIAL_TIC_TAC_TOE_BOARD as INITIAL_BOARD } from '../constants/gameConfig';

export default function TicTacToeScreen() {
  const { theme } = useTheme();
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [isXNext, setIsXNext] = useState(true);
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });

  const winner = calculateWinner(board);
  const isDraw = !winner && board.every(cell => cell !== null);

  useEffect(() => {
    if (winner) {
      setTimeout(() => {
        Alert.alert(
          '🎉 Winner!',
          `Player ${winner} wins!`,
          [
            { text: 'New Game', onPress: resetBoard }
          ]
        );
        setScores(prev => ({
          ...prev,
          [winner]: prev[winner] + 1
        }));
      }, 500);
    } else if (isDraw) {
      setTimeout(() => {
        Alert.alert(
          '🤝 Draw!',
          'It\'s a tie!',
          [
            { text: 'New Game', onPress: resetBoard }
          ]
        );
        setScores(prev => ({
          ...prev,
          draws: prev.draws + 1
        }));
      }, 500);
    }
  }, [winner, isDraw]);

  const handlePress = (index) => {
    if (board[index] || winner) return;

    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    setIsXNext(!isXNext);
  };

  const resetBoard = () => {
    setBoard(INITIAL_BOARD);
    setIsXNext(true);
  };

  const resetGame = () => {
    Alert.alert(
      'Reset Game',
      'Are you sure you want to reset the game and all scores?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: () => {
            setBoard(INITIAL_BOARD);
            setIsXNext(true);
            setScores({ X: 0, O: 0, draws: 0 });
          }
        }
      ]
    );
  };

  const renderCell = (index) => {
    const value = board[index];
    const winningLine = getWinningLine(board);
    const isWinningCell = winningLine && winningLine.includes(index);

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.cell,
          { 
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
          isWinningCell && styles.winningCell
        ]}
        onPress={() => handlePress(index)}
        activeOpacity={0.7}
      >
        <Text 
          style={[
            styles.cellText, 
            { color: value === 'X' ? '#FF6B6B' : '#4ECDC4' },
            isWinningCell && styles.winningCellText
          ]}
        >
          {value}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Header with Reset Button */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>⭕ Tic Tac Toe</Text>
          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: theme.colors.danger }]}
            onPress={resetGame}
          >
            <Text style={styles.resetButtonText}>Reset Game</Text>
          </TouchableOpacity>
        </View>

      {/* Scoreboard */}
      <View style={[styles.scoreboard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreLabel, { color: '#FF6B6B' }]}>X</Text>
          <Text style={[styles.scoreValue, { color: theme.colors.text }]}>{scores.X}</Text>
        </View>
        
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>Draws</Text>
          <Text style={[styles.scoreValue, { color: theme.colors.text }]}>{scores.draws}</Text>
        </View>
        
        <View style={styles.scoreItem}>
          <Text style={[styles.scoreLabel, { color: '#4ECDC4' }]}>O</Text>
          <Text style={[styles.scoreValue, { color: theme.colors.text }]}>{scores.O}</Text>
        </View>
      </View>

      {/* Game Status */}
      <View style={styles.statusContainer}>
        <Text style={[styles.statusText, { color: theme.colors.text }]}>
          {winner ? `Winner: ${winner}` : isDraw ? 'Draw!' : `Next: ${isXNext ? 'X' : 'O'}`}
        </Text>
        <View style={[
          styles.currentPlayerIndicator,
          { backgroundColor: isXNext ? '#FF6B6B' : '#4ECDC4' }
        ]} />
      </View>

      {/* Game Board */}
      <View style={styles.board}>
        {[0, 1, 2].map(row => (
          <View key={row} style={styles.row}>
            {[0, 1, 2].map(col => renderCell(row * 3 + col))}
          </View>
        ))}
      </View>

        {/* New Game Button */}
        <TouchableOpacity
          style={[styles.newGameButton, { backgroundColor: theme.colors.primary }]}
          onPress={resetBoard}
        >
          <Text style={styles.buttonText}>New Game</Text>
        </TouchableOpacity>
      </View>

      <AdBanner />
    </View>
  );
}

function calculateWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];

  for (let line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function getWinningLine(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  for (let line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  resetButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scoreboard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  currentPlayerIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  board: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    marginBottom: 15,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    margin: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cellText: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  winningCell: {
    backgroundColor: '#FFD700',
  },
  winningCellText: {
    transform: [{ scale: 1.2 }],
  },
  newGameButton: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
