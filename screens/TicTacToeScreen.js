import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import AdBanner from '../components/AdBanner';
import { INITIAL_TIC_TAC_TOE_BOARD as INITIAL_BOARD } from '../constants/gameConfig';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';
import GameHeader from '../components/GameHeader';

const EMPTY_SCORES = { X: 0, O: 0, draws: 0 };

export default function TicTacToeScreen() {
  const { theme } = useTheme();
  const room = useRoom('TicTacToe');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  // ── Offline state ────────────────────────────────────────────────────────────
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [isXNext, setIsXNext] = useState(true);
  const [scores, setScores] = useState(EMPTY_SCORES);

  // ── AI state ──────────────────────────────────────────────────────────────────
  const [vsAI, setVsAI] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState('hard');
  const [isAIThinking, setIsAIThinking] = useState(false);

  // ── Online state (read from sharedState) ─────────────────────────────────────
  const onlineBoard    = room.sharedState?.board    ?? INITIAL_BOARD;
  const onlineIsXNext  = room.sharedState?.isXNext  ?? true;
  const onlineScores   = room.sharedState?.scores   ?? EMPTY_SCORES;
  const onlineXPlayer  = room.sharedState?.xPlayerId ?? null;

  // Which symbol is the current user playing?
  const mySymbol  = room.isOnline ? (onlineXPlayer === room.userId ? 'X' : 'O') : null;
  const isMyTurn  = room.isOnline && ((onlineIsXNext && mySymbol === 'X') || (!onlineIsXNext && mySymbol === 'O'));
  const isWaiting = room.isOnline && room.players.length < 2;

  // Active values (online or offline)
  const activeBoard  = room.isOnline ? onlineBoard  : board;
  const activeIsXNext = room.isOnline ? onlineIsXNext : isXNext;
  const activeScores = room.isOnline ? onlineScores  : scores;

  const winner      = calculateWinner(activeBoard);
  const isDraw      = !winner && activeBoard.every((c) => c !== null);

  // Track which lastResult we already showed an alert for
  const handledResultRef = useRef(null);

  // ── When host creates a room, initialise shared game state ───────────────────
  useEffect(() => {
    if (room.isOnline && room.isHost && !room.sharedState?.xPlayerId) {
      room.updateSharedState({
        board: Array(9).fill(null),
        isXNext: true,
        scores: EMPTY_SCORES,
        xPlayerId: room.userId,
        lastResult: null,
      });
    }
  }, [room.isOnline, room.isHost]);

  // ── Offline: detect winner/draw and prompt ───────────────────────────────────
  useEffect(() => {
    if (room.isOnline) return;
    if (winner) {
      setTimeout(() => {
        Alert.alert('🎉 Winner!', `Player ${winner} wins!`, [{ text: 'New Game', onPress: resetBoard }]);
        setScores((prev) => ({ ...prev, [winner]: prev[winner] + 1 }));
      }, 300);
    } else if (isDraw) {
      setTimeout(() => {
        Alert.alert('🤝 Draw!', "It's a tie!", [{ text: 'New Game', onPress: resetBoard }]);
        setScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
      }, 300);
    }
  }, [winner, isDraw, room.isOnline]);

  // ── Online: react to lastResult set by the player who made the final move ────
  useEffect(() => {
    if (!room.isOnline) return;
    const result = room.sharedState?.lastResult;
    if (!result) return;
    const key = `${result.type}-${result.winner}-${result.at}`;
    if (handledResultRef.current === key) return;
    handledResultRef.current = key;

    setTimeout(() => {
      if (result.type === 'win') {
        Alert.alert('🎉 Winner!', `Player ${result.winner} wins!`);
      } else {
        Alert.alert('🤝 Draw!', "It's a tie!");
      }
    }, 300);
  }, [room.sharedState?.lastResult, room.isOnline]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => { room.deleteRoom(); };
  }, []);

  // ── AI move trigger ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!vsAI || room.isOnline) return;
    if (winner || isDraw) return;
    if (isXNext) return; // human plays X

    setIsAIThinking(true);
    const timer = setTimeout(() => {
      const move = getAIMove([...board], 'O', 'X', aiDifficulty);
      if (move !== null) {
        setBoard((prev) => {
          const next = [...prev];
          next[move] = 'O';
          return next;
        });
        setIsXNext(true);
      }
      setIsAIThinking(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [board, isXNext, vsAI, winner, isDraw, aiDifficulty, room.isOnline]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handlePress = (index) => {
    if (room.isOnline) {
      if (!isMyTurn || isWaiting) return;
      if (onlineBoard[index] || winner) return;

      const newBoard = [...onlineBoard];
      newBoard[index] = mySymbol;

      const newWinner = calculateWinner(newBoard);
      const newDraw   = !newWinner && newBoard.every((c) => c !== null);

      const nextXId = room.players.find((p) => p.id !== onlineXPlayer)?.id ?? onlineXPlayer;
      if (newWinner) {
        const newScores = { ...onlineScores, [newWinner]: onlineScores[newWinner] + 1 };
        room.updateSharedState({
          board: Array(9).fill(null),
          isXNext: true,
          scores: newScores,
          xPlayerId: nextXId,
          lastResult: { type: 'win', winner: newWinner, at: Date.now() },
        });
      } else if (newDraw) {
        const newScores = { ...onlineScores, draws: onlineScores.draws + 1 };
        room.updateSharedState({
          board: Array(9).fill(null),
          isXNext: true,
          scores: newScores,
          xPlayerId: nextXId,
          lastResult: { type: 'draw', winner: null, at: Date.now() },
        });
      } else {
        room.updateSharedState({
          board: newBoard,
          isXNext: !onlineIsXNext,
          scores: onlineScores,
          xPlayerId: onlineXPlayer,
          lastResult: null,
        });
      }
    } else {
      if (board[index] || winner) return;
      if (vsAI && (!isXNext || isAIThinking)) return; // AI's turn or thinking
      const newBoard = [...board];
      newBoard[index] = isXNext ? 'X' : 'O';
      setBoard(newBoard);
      setIsXNext(!isXNext);
    }
  };

  const resetBoard = () => {
    if (room.isOnline) {
      if (!room.isHost && !room.allCanEdit) return;
      const nextXId = room.players.find((p) => p.id !== onlineXPlayer)?.id ?? onlineXPlayer;
      room.updateSharedState({
        board: Array(9).fill(null),
        isXNext: true,
        scores: onlineScores,
        xPlayerId: nextXId,
        lastResult: null,
      });
    } else {
      setBoard(INITIAL_BOARD);
      setIsXNext(true);
    }
  };

  const toggleVsAI = () => {
    setVsAI((v) => !v);
    setBoard(INITIAL_BOARD);
    setIsXNext(true);
    setIsAIThinking(false);
  };

  const resetGame = () => {
    Alert.alert('Reset Game', 'Reset the game and all scores?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          if (room.isOnline) {
            if (!room.isHost && !room.allCanEdit) return;
            room.updateSharedState({
              board: Array(9).fill(null),
              isXNext: true,
              scores: EMPTY_SCORES,
              xPlayerId: onlineXPlayer,
              lastResult: null,
            });
          } else {
            setBoard(INITIAL_BOARD);
            setIsXNext(true);
            setScores(EMPTY_SCORES);
          }
        },
      },
    ]);
  };

  // ── Helpers for online player names ──────────────────────────────────────────

  const nameForSymbol = (symbol) => {
    if (!room.isOnline || !onlineXPlayer) return symbol;
    const targetId = symbol === 'X' ? onlineXPlayer : room.players.find((p) => p.id !== onlineXPlayer)?.id;
    const player = room.players.find((p) => p.id === targetId);
    return player ? player.displayName : symbol;
  };

  // ── Render cell ───────────────────────────────────────────────────────────────

  const renderCell = (index) => {
    const value = activeBoard[index];
    const winningLine = getWinningLine(activeBoard);
    const isWinningCell = winningLine?.includes(index);
    const blocked = room.isOnline && (!isMyTurn || isWaiting || !!winner || !!isDraw);

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.cell,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          isWinningCell && styles.winningCell,
          blocked && !value && { opacity: 0.6 },
        ]}
        onPress={() => handlePress(index)}
        activeOpacity={blocked ? 1 : 0.7}
      >
        <Text
          style={[
            styles.cellText,
            { color: value === 'X' ? '#FF6B6B' : '#4ECDC4' },
            isWinningCell && styles.winningCellText,
          ]}
        >
          {value}
        </Text>
      </TouchableOpacity>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GameHeader
          title="⭕ Tic Tac Toe"
          showOnline={!room.isOnline}
          onOnlinePress={() => setShowRoomLobby(true)}
          actions={[
            !room.isOnline && {
              icon: 'hardware-chip-outline',
              color: vsAI ? theme.colors.warning : theme.colors.surface,
              outline: true,
              borderColor: theme.colors.border,
              iconColor: vsAI ? '#fff' : theme.colors.text,
              onPress: toggleVsAI,
              accessibilityLabel: 'Toggle AI opponent',
            },
            { label: 'Reset', color: theme.colors.danger, onPress: resetGame },
          ].filter(Boolean)}
        />

        {/* AI difficulty selector */}
        {vsAI && !room.isOnline && (
          <View style={[styles.difficultyRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.diffLabel, { color: theme.colors.textSecondary }]}>🤖 Difficulty:</Text>
            {['easy', 'medium', 'hard'].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.diffBtn, { borderColor: theme.colors.border }, aiDifficulty === d && { backgroundColor: theme.colors.primary }]}
                onPress={() => { setAiDifficulty(d); setBoard(INITIAL_BOARD); setIsXNext(true); setIsAIThinking(false); }}
              >
                <Text style={[styles.diffBtnText, { color: aiDifficulty === d ? '#fff' : theme.colors.text }]}>
                  {d[0].toUpperCase() + d.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Online symbol badge */}
        {room.isOnline && mySymbol && (
          <View style={[styles.symbolBadge, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.symbolBadgeText, { color: theme.colors.textSecondary }]}>You are </Text>
            <Text style={[styles.symbolBadgeSymbol, { color: mySymbol === 'X' ? '#FF6B6B' : '#4ECDC4' }]}>
              {mySymbol}
            </Text>
          </View>
        )}

        {/* Scoreboard */}
        <View style={[styles.scoreboard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: '#FF6B6B' }]} numberOfLines={1}>
              {vsAI ? 'You (X)' : nameForSymbol('X')}
            </Text>
            <Text style={[styles.scoreValue, { color: theme.colors.text }]}>{activeScores.X}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>Draws</Text>
            <Text style={[styles.scoreValue, { color: theme.colors.text }]}>{activeScores.draws}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={[styles.scoreLabel, { color: '#4ECDC4' }]} numberOfLines={1}>
              {vsAI ? '🤖 AI' : nameForSymbol('O')}
            </Text>
            <Text style={[styles.scoreValue, { color: theme.colors.text }]}>{activeScores.O}</Text>
          </View>
        </View>

        {/* Waiting for opponent */}
        {isWaiting ? (
          <View style={[styles.waitingBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Ionicons name="time-outline" size={32} color={theme.colors.textSecondary} />
            <Text style={[styles.waitingText, { color: theme.colors.textSecondary }]}>
              Waiting for opponent…
            </Text>
            <Text style={[styles.waitingSubtext, { color: theme.colors.textSecondary }]}>
              Room code: {room.roomCode}
            </Text>
          </View>
        ) : (
          <>
            {/* Game status */}
            <View style={styles.statusContainer}>
              <Text style={[styles.statusText, { color: theme.colors.text }]}>
                {winner
                  ? `${nameForSymbol(winner)} wins!`
                  : isDraw
                  ? 'Draw!'
                  : room.isOnline
                  ? (isMyTurn ? 'Your turn' : "Opponent's turn")
                  : vsAI
                  ? (isXNext ? 'Your turn (X)' : isAIThinking ? '🤖 Thinking…' : '🤖 AI\'s turn')
                  : `Next: ${activeIsXNext ? 'X' : 'O'}`}
              </Text>
              {!winner && !isDraw && (
                <View style={[styles.turnDot, { backgroundColor: activeIsXNext ? '#FF6B6B' : '#4ECDC4' }]} />
              )}
            </View>

            {/* Board */}
            <View style={styles.board}>
              {[0, 1, 2].map((row) => (
                <View key={row} style={styles.row}>
                  {[0, 1, 2].map((col) => renderCell(row * 3 + col))}
                </View>
              ))}
            </View>
          </>
        )}

        {/* New game button — host-only in online mode */}
        {(!room.isOnline || room.isHost || room.allCanEdit) && !isWaiting && (
          <TouchableOpacity
            style={[styles.newGameButton, { backgroundColor: theme.colors.primary }]}
            onPress={resetBoard}
          >
            <Text style={styles.buttonText}>New Game</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <AdBanner />

      <RoomLobby
        visible={showRoomLobby}
        onClose={() => setShowRoomLobby(false)}
        room={room}
        gameType="TicTacToe"
      />
    </View>
  );
}

// ── Game logic ─────────────────────────────────────────────────────────────────

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function calculateWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function getWinningLine(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

// ── AI logic ───────────────────────────────────────────────────────────────────

function minimax(board, isMaximizing, aiSym, humanSym) {
  const w = calculateWinner(board);
  if (w === aiSym) return 10;
  if (w === humanSym) return -10;
  if (board.every((c) => c !== null)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = aiSym;
        best = Math.max(best, minimax(board, false, aiSym, humanSym));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = humanSym;
        best = Math.min(best, minimax(board, true, aiSym, humanSym));
        board[i] = null;
      }
    }
    return best;
  }
}

function getAIMove(board, aiSym, humanSym, difficulty) {
  const empty = board.reduce((acc, v, i) => (v === null ? [...acc, i] : acc), []);
  if (!empty.length) return null;

  if (difficulty === 'easy') {
    if (Math.random() < 0.75) return empty[Math.floor(Math.random() * empty.length)];
  }

  if (difficulty === 'medium') {
    for (const i of empty) {
      board[i] = aiSym;
      if (calculateWinner(board)) { board[i] = null; return i; }
      board[i] = null;
    }
    for (const i of empty) {
      board[i] = humanSym;
      if (calculateWinner(board)) { board[i] = null; return i; }
      board[i] = null;
    }
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // hard: full minimax
  let bestScore = -Infinity;
  let bestMove = empty[0];
  for (const i of empty) {
    board[i] = aiSym;
    const score = minimax(board, false, aiSym, humanSym);
    board[i] = null;
    if (score > bestScore) { bestScore = score; bestMove = i; }
  }
  return bestMove;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 15,
    alignItems: 'center',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  title: { fontSize: 26, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  symbolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  symbolBadgeText: { fontSize: 14 },
  symbolBadgeSymbol: { fontSize: 18, fontWeight: 'bold' },

  scoreboard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  scoreItem: { alignItems: 'center', flex: 1 },
  scoreLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 3 },
  scoreValue: { fontSize: 24, fontWeight: 'bold' },

  waitingBox: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginVertical: 10,
  },
  waitingText: { fontSize: 18, fontWeight: '600' },
  waitingSubtext: { fontSize: 14 },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusText: { fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  turnDot: { width: 12, height: 12, borderRadius: 6 },

  board: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    marginBottom: 15,
  },
  row: { flex: 1, flexDirection: 'row' },
  cell: {
    flex: 1,
    margin: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 10,
  },
  cellText: { fontSize: 40, fontWeight: 'bold' },
  winningCell: { backgroundColor: '#FFD700' },
  winningCellText: { transform: [{ scale: 1.2 }] },

  difficultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
    width: '100%',
  },
  diffLabel: { fontSize: 13, marginRight: 4 },
  diffBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  diffBtnText: { fontSize: 13, fontWeight: '600' },

  newGameButton: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
