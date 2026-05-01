import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AdBanner from '../components/AdBanner';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';
import GameHeader from '../components/GameHeader';

const ROWS = 6;
const COLS = 7;
const P1 = 1;
const P2 = 2;
const DEPTH = 5;

// ── Game logic ─────────────────────────────────────────────────────────────────

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function getValidCols(board) {
  return Array.from({ length: COLS }, (_, c) => c).filter(c => board[0][c] === 0);
}

function dropPiece(board, col, piece) {
  const b = board.map(r => [...r]);
  for (let r = ROWS - 1; r >= 0; r--) {
    if (b[r][col] === 0) { b[r][col] = piece; break; }
  }
  return b;
}

function checkWin(board, piece) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (board[r][c] === piece && board[r][c+1] === piece && board[r][c+2] === piece && board[r][c+3] === piece) return true;
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      if (board[r][c] === piece && board[r+1][c] === piece && board[r+2][c] === piece && board[r+3][c] === piece) return true;
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (board[r][c] === piece && board[r-1][c+1] === piece && board[r-2][c+2] === piece && board[r-3][c+3] === piece) return true;
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (board[r][c] === piece && board[r+1][c+1] === piece && board[r+2][c+2] === piece && board[r+3][c+3] === piece) return true;
  return false;
}

function getWinCells(board, piece) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if ([c, c+1, c+2, c+3].every(i => board[r][i] === piece)) return [[r,c],[r,c+1],[r,c+2],[r,c+3]];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      if ([r, r+1, r+2, r+3].every(i => board[i][c] === piece)) return [[r,c],[r+1,c],[r+2,c],[r+3,c]];
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++) {
      const cells = [[r,c],[r-1,c+1],[r-2,c+2],[r-3,c+3]];
      if (cells.every(([rr, cc]) => board[rr][cc] === piece)) return cells;
    }
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++) {
      const cells = [[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]];
      if (cells.every(([rr, cc]) => board[rr][cc] === piece)) return cells;
    }
  return [];
}

function evalWindow(window, piece) {
  const opp = piece === P1 ? P2 : P1;
  const pc = window.filter(c => c === piece).length;
  const ec = window.filter(c => c === 0).length;
  const oc = window.filter(c => c === opp).length;
  if (pc === 4) return 100;
  if (pc === 3 && ec === 1) return 5;
  if (pc === 2 && ec === 2) return 2;
  if (oc === 3 && ec === 1) return -4;
  return 0;
}

function scoreBoard(board, piece) {
  let score = board.map(r => r[Math.floor(COLS / 2)]).filter(c => c === piece).length * 3;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evalWindow([board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]], piece);
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      score += evalWindow([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]], piece);
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evalWindow([board[r][c], board[r-1][c+1], board[r-2][c+2], board[r-3][c+3]], piece);
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evalWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]], piece);
  return score;
}

function minimax(board, depth, alpha, beta, maximizing) {
  if (checkWin(board, P2)) return 1000000;
  if (checkWin(board, P1)) return -1000000;
  const valid = getValidCols(board);
  if (depth === 0 || valid.length === 0) return scoreBoard(board, P2);
  if (maximizing) {
    let best = -Infinity;
    for (const c of valid) {
      best = Math.max(best, minimax(dropPiece(board, c, P2), depth - 1, alpha, beta, false));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const c of valid) {
      best = Math.min(best, minimax(dropPiece(board, c, P1), depth - 1, alpha, beta, true));
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
}

function getAICol(board) {
  const valid = getValidCols(board);
  let best = -Infinity, bestCol = valid[0];
  for (const c of valid) {
    const score = minimax(dropPiece(board, c, P2), DEPTH - 1, -Infinity, Infinity, false);
    if (score > best) { best = score; bestCol = c; }
  }
  return bestCol;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function FourInALineScreen({ route }) {
  const { theme } = useTheme();
  const room = useRoom('FourInALine');
  const [showRoomLobby, setShowRoomLobby] = useState(false);
  const [board, setBoard] = useState(createBoard);
  const [currentPiece, setCurrentPiece] = useState(P1);
  const [winner, setWinner] = useState(null); // null | P1 | P2 | 'draw'
  const [winCells, setWinCells] = useState([]);
  const [scores, setScores] = useState({ p1: 0, p2: 0, draws: 0 });
  const [thinking, setThinking] = useState(false);
  const [vsAI, setVsAI] = useState(true);

  const onlineBoard = room.sharedState?.board ?? createBoard();
  const onlineCurrentPiece = room.sharedState?.currentPiece ?? P1;
  const onlineWinner = room.sharedState?.winner ?? null;
  const onlineWinCells = room.sharedState?.winCells ?? [];
  const onlineScores = room.sharedState?.scores ?? { p1: 0, p2: 0, draws: 0 };
  const onlineRedPlayerId = room.sharedState?.redPlayerId ?? room.players[0]?.id ?? null;
  const onlineYellowPlayerId = room.players.find((p) => p.id !== onlineRedPlayerId)?.id ?? null;
  const myPiece = room.isOnline ? (room.userId === onlineRedPlayerId ? P1 : P2) : null;
  const isWaiting = room.isOnline && room.players.length < 2;
  const isMyTurn = room.isOnline && !isWaiting && myPiece === onlineCurrentPiece;

  const activeBoard = room.isOnline ? onlineBoard : board;
  const activePiece = room.isOnline ? onlineCurrentPiece : currentPiece;
  const activeWinner = room.isOnline ? onlineWinner : winner;
  const activeWinCells = room.isOnline ? onlineWinCells : winCells;
  const activeScores = room.isOnline ? onlineScores : scores;

  const isOver = activeWinner !== null;
  const isWinCell = (r, c) => activeWinCells.some(([wr, wc]) => wr === r && wc === c);

  useEffect(() => {
    return () => { room.deleteRoom(); };
  }, []);

  useEffect(() => {
    if (route?.params?.joinRoomOnly && !room.isOnline) {
      setShowRoomLobby(true);
    }
  }, [route?.params?.joinRoomOnly, room.isOnline]);

  useEffect(() => {
    if (room.isOnline && room.isHost && !room.sharedState?.board) {
      room.updateSharedState({
        board: createBoard(),
        currentPiece: P1,
        winner: null,
        winCells: [],
        scores: { p1: 0, p2: 0, draws: 0 },
        redPlayerId: room.userId,
      });
    }
  }, [room.isOnline, room.isHost]);

  const handleColPress = (col) => {
    if (room.isOnline) {
      if (isWaiting || !isMyTurn || isOver || activeBoard[0][col] !== 0) return;

      const newBoard = dropPiece(activeBoard, col, activePiece);
      const nextState = {
        board: newBoard,
        currentPiece: activePiece === P1 ? P2 : P1,
        winner: null,
        winCells: [],
        scores: activeScores,
        redPlayerId: onlineRedPlayerId,
      };

      if (checkWin(newBoard, activePiece)) {
        nextState.winner = activePiece;
        nextState.winCells = getWinCells(newBoard, activePiece);
        nextState.scores = {
          ...activeScores,
          p1: activeScores.p1 + (activePiece === P1 ? 1 : 0),
          p2: activeScores.p2 + (activePiece === P2 ? 1 : 0),
        };
      } else if (getValidCols(newBoard).length === 0) {
        nextState.winner = 'draw';
        nextState.scores = { ...activeScores, draws: activeScores.draws + 1 };
      }

      room.updateSharedState(nextState);
      return;
    }

    if (isOver || thinking) return;
    if (board[0][col] !== 0) return;

    const newBoard = dropPiece(board, col, currentPiece);

    if (checkWin(newBoard, currentPiece)) {
      setBoard(newBoard);
      setWinCells(getWinCells(newBoard, currentPiece));
      setWinner(currentPiece);
      setScores(s => ({
        ...s,
        p1: s.p1 + (currentPiece === P1 ? 1 : 0),
        p2: s.p2 + (currentPiece === P2 ? 1 : 0),
      }));
      return;
    }

    if (getValidCols(newBoard).length === 0) {
      setBoard(newBoard);
      setWinner('draw');
      setScores(s => ({ ...s, draws: s.draws + 1 }));
      return;
    }

    if (vsAI && currentPiece === P1) {
      setBoard(newBoard);
      setThinking(true);
      setTimeout(() => {
        const aiCol = getAICol(newBoard);
        const aiBoard = dropPiece(newBoard, aiCol, P2);
        if (checkWin(aiBoard, P2)) {
          setBoard(aiBoard);
          setWinCells(getWinCells(aiBoard, P2));
          setWinner(P2);
          setScores(s => ({ ...s, p2: s.p2 + 1 }));
        } else if (getValidCols(aiBoard).length === 0) {
          setBoard(aiBoard);
          setWinner('draw');
          setScores(s => ({ ...s, draws: s.draws + 1 }));
        } else {
          setBoard(aiBoard);
        }
        setThinking(false);
      }, 100);
    } else {
      setBoard(newBoard);
      setCurrentPiece(currentPiece === P1 ? P2 : P1);
    }
  };

  const resetGame = () => {
    if (room.isOnline) {
      if (!room.isHost && !room.allCanEdit) return;
      room.updateSharedState({
        board: createBoard(),
        currentPiece: P1,
        winner: null,
        winCells: [],
        scores: activeScores,
        redPlayerId: onlineRedPlayerId || room.userId,
      });
      return;
    }
    setBoard(createBoard());
    setCurrentPiece(P1);
    setWinner(null);
    setWinCells([]);
    setThinking(false);
  };

  const switchMode = () => {
    if (room.isOnline) return;
    setVsAI(v => !v);
    setBoard(createBoard());
    setCurrentPiece(P1);
    setWinner(null);
    setWinCells([]);
    setThinking(false);
  };

  const statusText = () => {
    if (room.isOnline) {
      if (isWaiting) return 'Waiting for opponent...';
      if (activeWinner === 'draw') return 'It\'s a draw!';
      if (activeWinner === P1) return `${nameForPiece(P1)} wins!`;
      if (activeWinner === P2) return `${nameForPiece(P2)} wins!`;
      return isMyTurn ? 'Your turn' : `${nameForPiece(activePiece)}'s turn`;
    }
    if (thinking) return '🤔 AI is thinking...';
    if (winner === 'draw') return '🤝 It\'s a draw!';
    if (winner === P1) return vsAI ? '🎉 You win!' : '🔴 Red wins!';
    if (winner === P2) return vsAI ? '😞 AI wins!' : '🟡 Yellow wins!';
    if (vsAI) return '🔴 Your turn';
    return currentPiece === P1 ? '🔴 Red\'s turn' : '🟡 Yellow\'s turn';
  };

  const nameForPiece = (piece) => {
    if (!room.isOnline) return piece === P1 ? 'Red' : 'Yellow';
    const id = piece === P1 ? onlineRedPlayerId : onlineYellowPlayerId;
    if (id === room.userId) return 'You';
    return room.players.find((p) => p.id === id)?.displayName ?? (piece === P1 ? 'Red' : 'Yellow');
  };

  const cellColor = (val, r, c) => {
    if (val === 0) return theme.dark ? '#0d1b2a' : '#b8d4e8';
    const win = isWinCell(r, c);
    if (val === P1) return win ? '#FF0000' : '#E53935';
    return win ? '#FFD700' : '#FFA726';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />
      <GameHeader
        title="🔴 Four in a Line"
        showOnline={!room.isOnline}
        onOnlinePress={() => setShowRoomLobby(true)}
        style={{ paddingHorizontal: 16, paddingTop: 12, marginBottom: 8 }}
        actions={[
          !room.isOnline && {
            icon: 'hardware-chip-outline',
            color: vsAI ? theme.colors.warning : theme.colors.surface,
            outline: true,
            borderColor: theme.colors.border,
            iconColor: vsAI ? '#fff' : theme.colors.text,
            onPress: switchMode,
            accessibilityLabel: 'Toggle AI opponent',
          },
          {
            label: 'New Game',
            color: theme.colors.surface,
            outline: true,
            borderColor: theme.colors.border,
            textColor: theme.colors.text,
            onPress: resetGame,
          },
        ].filter(Boolean)}
      />

      {/* Score bar */}
      <View style={[styles.scoreBar, { backgroundColor: theme.colors.card }]}>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreDot}>🔴</Text>
          <Text style={[styles.scoreNum, { color: theme.colors.text }]}>{activeScores.p1}</Text>
          <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>{room.isOnline ? nameForPiece(P1) : vsAI ? 'You' : 'Red'}</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreDot}>🤝</Text>
          <Text style={[styles.scoreNum, { color: theme.colors.text }]}>{activeScores.draws}</Text>
          <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>Draw</Text>
        </View>
        <View style={styles.scoreItem}>
          <Text style={styles.scoreDot}>🟡</Text>
          <Text style={[styles.scoreNum, { color: theme.colors.text }]}>{activeScores.p2}</Text>
          <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>{room.isOnline ? nameForPiece(P2) : vsAI ? 'AI' : 'Yellow'}</Text>
        </View>
      </View>

      {/* Status */}
      <View style={[styles.statusBar, {
        backgroundColor: isOver ? theme.colors.primary + '22' : 'transparent',
      }]}>
        <Text style={[styles.statusTxt, {
          color: isOver ? theme.colors.primary : theme.colors.textSecondary,
        }]}>
          {statusText()}
        </Text>
        {isOver && (
          <TouchableOpacity
            style={[styles.playAgainBtn, { backgroundColor: theme.colors.primary }]}
            onPress={resetGame}
          >
            <Text style={styles.playAgainTxt}>Play Again</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Board */}
      <View style={[styles.board, { backgroundColor: '#1565C0' }]}>
        {/* Drop arrows */}
        <View style={styles.arrows}>
          {Array.from({ length: COLS }, (_, c) => (
            <TouchableOpacity
              key={c}
              style={styles.arrow}
              onPress={() => handleColPress(c)}
              disabled={isOver || thinking || (room.isOnline && (!isMyTurn || isWaiting))}
            >
              <Text style={styles.arrowTxt}>▼</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Grid */}
        {activeBoard.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((val, c) => (
              <TouchableOpacity
                key={c}
                style={styles.cellWrap}
                onPress={() => handleColPress(c)}
                disabled={isOver || thinking || (room.isOnline && (!isMyTurn || isWaiting))}
                activeOpacity={0.8}
              >
                <View style={[styles.cell, { backgroundColor: cellColor(val, r, c) }]} />
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {room.isOnline && myPiece && (
        <View style={[styles.modeBtn, { borderColor: theme.colors.border }]}>
          <Text style={[styles.modeTxt, { color: theme.colors.textSecondary }]}>
            You are {myPiece === P1 ? 'Red' : 'Yellow'}
          </Text>
        </View>
      )}
      <AdBanner />
      <RoomLobby
        visible={showRoomLobby}
        onClose={() => setShowRoomLobby(false)}
        room={room}
        gameType="FourInALine"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  newBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  newBtnTxt: { fontSize: 14, fontWeight: '600' },

  scoreBar: {
    flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10,
  },
  scoreItem: { alignItems: 'center' },
  scoreDot: { fontSize: 20 },
  scoreNum: { fontSize: 22, fontWeight: 'bold' },
  scoreLabel: { fontSize: 12 },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingVertical: 8, paddingHorizontal: 16,
  },
  statusTxt: { fontSize: 15, fontWeight: '600' },
  playAgainBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  playAgainTxt: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  board: { marginHorizontal: 12, borderRadius: 12, padding: 6, gap: 3 },
  arrows: { flexDirection: 'row', gap: 3, marginBottom: 2 },
  arrow: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  arrowTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  row: { flexDirection: 'row', gap: 3 },
  cellWrap: { flex: 1, aspectRatio: 1 },
  cell: { flex: 1, borderRadius: 999 },

  modeBtn: {
    marginHorizontal: 16, marginTop: 16, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, alignItems: 'center',
  },
  modeTxt: { fontSize: 13 },
});
