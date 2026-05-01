import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AdBanner from '../components/AdBanner';
import { useRoom } from '../hooks/useRoom';
import RoomLobby from '../components/RoomLobby';
import OnlineBanner from '../components/OnlineBanner';
import GameHeader from '../components/GameHeader';

const GRID = 10;
const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const W = Dimensions.get('window').width;
const CELL = Math.max(24, Math.floor((W - 52) / (GRID + 1)));

const SHIPS = [
  { id: 'ship4-1', name: '4-Tile Ship', size: 4, emoji: '🚢' },
  { id: 'ship3-1', name: '3-Tile Ship 1', size: 3, emoji: '⚓' },
  { id: 'ship3-2', name: '3-Tile Ship 2', size: 3, emoji: '⚓' },
  { id: 'ship2-1', name: '2-Tile Ship 1', size: 2, emoji: '🛥️' },
  { id: 'ship2-2', name: '2-Tile Ship 2', size: 2, emoji: '🛥️' },
  { id: 'ship2-3', name: '2-Tile Ship 3', size: 2, emoji: '🛥️' },
  { id: 'ship1-1', name: '1-Tile Ship 1', size: 1, emoji: '•' },
  { id: 'ship1-2', name: '1-Tile Ship 2', size: 1, emoji: '•' },
  { id: 'ship1-3', name: '1-Tile Ship 3', size: 1, emoji: '•' },
  { id: 'ship1-4', name: '1-Tile Ship 4', size: 1, emoji: '•' },
];

const FLEET_GROUPS = [
  { size: 4, count: 1 },
  { size: 3, count: 2 },
  { size: 2, count: 3 },
  { size: 1, count: 4 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function emptyGrid() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

function emptyShotGrid() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

function shipCells(row, col, size, orient) {
  return Array.from({ length: size }, (_, i) =>
    orient === 'H' ? [row, col + i] : [row + i, col]
  );
}

function canPlace(grid, row, col, size, orient) {
  const cells = shipCells(row, col, size, orient);
  const inBounds = cells.every(([r, c]) => r >= 0 && r < GRID && c >= 0 && c < GRID);
  if (!inBounds) return false;

  return cells.every(([r, c]) => {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && grid[nr][nc] !== null) {
          return false;
        }
      }
    }
    return true;
  });
}

function placeOnGrid(grid, cells, shipId) {
  const g = grid.map(r => [...r]);
  cells.forEach(([r, c]) => { g[r][c] = shipId; });
  return g;
}

function randomPlacement() {
  for (let fleetAttempt = 0; fleetAttempt < 100; fleetAttempt++) {
    const grid = emptyGrid();
    const placements = [];
    let complete = true;

    for (const ship of SHIPS) {
      let placed = false;

      for (let attempts = 0; attempts < 1000 && !placed; attempts++) {
        const orient = Math.random() < 0.5 ? 'H' : 'V';
        const row = Math.floor(Math.random() * GRID);
        const col = Math.floor(Math.random() * GRID);
        if (canPlace(grid, row, col, ship.size, orient)) {
          const cells = shipCells(row, col, ship.size, orient);
          cells.forEach(([r, c]) => { grid[r][c] = ship.id; });
          placements.push({ id: ship.id, cells });
          placed = true;
        }
      }

      if (!placed) {
        complete = false;
        break;
      }
    }

    if (complete) return { grid, placements };
  }

  return { grid: emptyGrid(), placements: [] };
}

function getSunkIds(placements, shots) {
  return placements
    .filter(({ cells }) => cells.every(([r, c]) => shots[r][c] === 'hit'))
    .map(({ id }) => id);
}

function getShipSize(shipId) {
  return SHIPS.find(s => s.id === shipId)?.size ?? 0;
}

function countBySize(placements, shipIds = null) {
  const idSet = shipIds ? new Set(shipIds) : null;
  return placements.reduce((acc, placement) => {
    if (idSet && !idSet.has(placement.id)) return acc;
    const size = getShipSize(placement.id);
    return { ...acc, [size]: (acc[size] || 0) + 1 };
  }, {});
}

function markWaterAroundSunkShips(shots, placements, sunkIds) {
  if (!sunkIds.length) return shots;

  const next = shots.map(r => [...r]);
  const sunkSet = new Set(sunkIds);
  placements
    .filter(({ id }) => sunkSet.has(id))
    .forEach(({ cells }) => {
      cells.forEach(([r, c]) => {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && next[nr][nc] === null) {
              next[nr][nc] = 'miss';
            }
          }
        }
      });
    });

  return next;
}

function aiMove(shots, activeHits) {
  // Target: extend a line of 2+ hits
  if (activeHits.length >= 2) {
    const rows = activeHits.map(([r]) => r);
    const cols = activeHits.map(([, c]) => c);
    if (rows.every(r => r === rows[0])) {
      const minC = Math.min(...cols), maxC = Math.max(...cols);
      const cands = [];
      if (minC > 0 && !shots[rows[0]][minC - 1]) cands.push([rows[0], minC - 1]);
      if (maxC < GRID - 1 && !shots[rows[0]][maxC + 1]) cands.push([rows[0], maxC + 1]);
      if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
    }
    if (cols.every(c => c === cols[0])) {
      const minR = Math.min(...rows), maxR = Math.max(...rows);
      const cands = [];
      if (minR > 0 && !shots[minR - 1][cols[0]]) cands.push([minR - 1, cols[0]]);
      if (maxR < GRID - 1 && !shots[maxR + 1][cols[0]]) cands.push([maxR + 1, cols[0]]);
      if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
    }
  }
  // Target: fire adjacent to any hit
  if (activeHits.length > 0) {
    const cands = [];
    activeHits.forEach(([r, c]) => {
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && !shots[nr][nc]) cands.push([nr, nc]);
      });
    });
    if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
  }
  // Hunt: checkerboard parity
  const pool = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (!shots[r][c] && (r + c) % 2 === 0) pool.push([r, c]);
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (!shots[r][c]) return [r, c];
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SeaBattleScreen({ route }) {
  const { theme } = useTheme();
  const room = useRoom('SeaBattle');
  const [showRoomLobby, setShowRoomLobby] = useState(false);

  // Setup state
  const [phase, setPhase] = useState('setup'); // 'setup' | 'battle' | 'gameOver'
  const [playerGrid, setPlayerGrid] = useState(emptyGrid);
  const [playerPlacements, setPlayerPlacements] = useState([]);
  const [placingIdx, setPlacingIdx] = useState(0);
  const [orient, setOrient] = useState('H');

  // Battle state
  const [aiGrid, setAiGrid] = useState(emptyGrid);
  const [aiPlacements, setAiPlacements] = useState([]);
  const [playerShots, setPlayerShots] = useState(emptyShotGrid);
  const [aiShots, setAiShots] = useState(emptyShotGrid);
  const [aiSunkIds, setAiSunkIds] = useState([]);
  const [playerSunkIds, setPlayerSunkIds] = useState([]);
  const [activeView, setActiveView] = useState('attack');
  const [winner, setWinner] = useState(null);
  const [msg, setMsg] = useState('');

  const aiHitsRef = useRef([]); // hits not yet confirmed sunk
  const currentShip = SHIPS[placingIdx] ?? null;
  const allPlaced = placingIdx >= SHIPS.length;
  const opponent = room.isOnline ? room.players.find((p) => p.id !== room.userId) : null;
  const myOnlineData = room.players.find((p) => p.id === room.userId)?.playerData || {};
  const opponentData = opponent?.playerData || {};
  const onlinePhase = room.sharedState?.phase ?? 'setup';
  const onlineTurnId = room.sharedState?.turnId ?? room.players[0]?.id ?? null;
  const onlineShotsByPlayer = room.sharedState?.shotsByPlayer ?? {};
  const myOnlineShots = onlineShotsByPlayer[room.userId] ?? emptyShotGrid();
  const opponentOnlineShots = opponent ? (onlineShotsByPlayer[opponent.id] ?? emptyShotGrid()) : emptyShotGrid();
  const onlineAttackSunkCount = opponentData.placements ? getSunkIds(opponentData.placements, myOnlineShots).length : 0;
  const onlineDefenseSunkCount = myOnlineData.placements ? getSunkIds(myOnlineData.placements, opponentOnlineShots).length : 0;
  const myOnlineName = room.players.find((p) => p.id === room.userId)?.displayName || 'You';
  const readyKey = room.players.map((p) => `${p.id}:${p.playerData?.ready ? '1' : '0'}`).join('|');
  const isWaiting = room.isOnline && (!opponent || onlinePhase === 'setup');
  const isMyTurn = room.isOnline && onlinePhase === 'battle' && onlineTurnId === room.userId;

  useEffect(() => {
    return () => { room.deleteRoom(); };
  }, []);

  useEffect(() => {
    if (route?.params?.joinRoomOnly && !room.isOnline) {
      setShowRoomLobby(true);
    }
  }, [route?.params?.joinRoomOnly, room.isOnline]);

  useEffect(() => {
    if (room.isOnline && room.isHost && !room.sharedState?.phase) {
      room.updateSharedState({
        phase: 'setup',
        turnId: room.userId,
        shotsByPlayer: {},
        winnerId: null,
        msg: 'Place your fleet. Battle starts when both players are ready.',
      });
    }
  }, [room.isOnline, room.isHost]);

  useEffect(() => {
    if (!room.isOnline || !room.isHost || onlinePhase !== 'setup') return;
    if (room.players.length < 2) return;
    const readyPlayers = room.players.filter((p) => p.playerData?.ready && p.playerData?.grid && p.playerData?.placements);
    if (readyPlayers.length < 2) return;
    room.updateSharedState({
      phase: 'battle',
      turnId: readyPlayers[0].id,
      shotsByPlayer: {
        [readyPlayers[0].id]: emptyShotGrid(),
        [readyPlayers[1].id]: emptyShotGrid(),
      },
      winnerId: null,
      msg: `${readyPlayers[0].displayName} fires first.`,
    });
  }, [room.isOnline, room.isHost, onlinePhase, room.players.length, readyKey]);

  // ── Setup ──────────────────────────────────────────────────────────────────────

  const handleSetupCell = (row, col) => {
    if (!currentShip) return;
    if (!canPlace(playerGrid, row, col, currentShip.size, orient)) {
      Alert.alert("Can't place here", "Ship doesn't fit, overlaps another ship, or touches another ship.");
      return;
    }
    const cells = shipCells(row, col, currentShip.size, orient);
    setPlayerGrid(g => placeOnGrid(g, cells, currentShip.id));
    setPlayerPlacements(p => [...p, { id: currentShip.id, cells }]);
    setPlacingIdx(i => i + 1);
  };

  const handleRandom = () => {
    const { grid, placements } = randomPlacement();
    if (placements.length !== SHIPS.length) {
      Alert.alert('Try Again', 'Could not fit the fleet without ships touching. Please try random placement again.');
      return;
    }
    setPlayerGrid(grid);
    setPlayerPlacements(placements);
    setPlacingIdx(SHIPS.length);
  };

  const handleUndo = () => {
    if (playerPlacements.length === 0) return;

    const lastPlacement = playerPlacements[playerPlacements.length - 1];
    const newGrid = playerGrid.map(r => [...r]);
    lastPlacement.cells.forEach(([r, c]) => {
      newGrid[r][c] = null;
    });

    setPlayerGrid(newGrid);
    setPlayerPlacements(p => p.slice(0, -1));
    setPlacingIdx(i => i - 1);
  };

  const handleClear = () => {
    setPlayerGrid(emptyGrid());
    setPlayerPlacements([]);
    setPlacingIdx(0);
  };

  const handleReady = () => {
    if (room.isOnline) {
      if (!allPlaced) return;
      room.updateMyPlayerData({
        grid: playerGrid,
        placements: playerPlacements,
        ready: true,
      });
      setMsg('Fleet ready. Waiting for opponent...');
      return;
    }

    const ai = randomPlacement();
    setAiGrid(ai.grid);
    setAiPlacements(ai.placements);
    setPhase('battle');
    setMsg('Game on! Tap cells on the Attack grid to fire.');
  };

  // ── Battle ─────────────────────────────────────────────────────────────────────

  const handleFire = (row, col) => {
    if (room.isOnline) {
      if (!opponent || !isMyTurn || onlinePhase !== 'battle') return;
      if (myOnlineShots[row][col]) return;

      const targetGrid = opponentData.grid;
      const targetPlacements = opponentData.placements || [];
      if (!targetGrid || !targetPlacements.length) return;

      const isHit = targetGrid[row][col] !== null;
      let newShots = myOnlineShots.map(r => [...r]);
      newShots[row][col] = isHit ? 'hit' : 'miss';
      const newSunk = getSunkIds(targetPlacements, newShots);
      const previousSunk = getSunkIds(targetPlacements, myOnlineShots);
      const justSunk = newSunk.filter(id => !previousSunk.includes(id));
      newShots = markWaterAroundSunkShips(newShots, targetPlacements, justSunk);
      const ship = SHIPS.find(s => s.id === justSunk[0]);
      const winnerId = newSunk.length === SHIPS.length ? room.userId : null;
      const playerMsg = winnerId
        ? `${myOnlineName} won! All enemy ships were sunk.`
        : justSunk.length
        ? `${myOnlineName} sank ${opponent.displayName}'s ${ship?.name}! ${myOnlineName} fires again.`
        : isHit
        ? `${myOnlineName} hit! ${myOnlineName} fires again.`
        : `${myOnlineName} missed.`;

      room.updateSharedState({
        phase: winnerId ? 'gameOver' : 'battle',
        turnId: winnerId ? onlineTurnId : isHit ? room.userId : opponent.id,
        shotsByPlayer: { ...onlineShotsByPlayer, [room.userId]: newShots },
        winnerId,
        msg: playerMsg,
      });
      return;
    }

    if (phase !== 'battle' || winner || playerShots[row][col]) return;

    const isHit = aiGrid[row][col] !== null;
    let newShots = playerShots.map(r => [...r]);
    newShots[row][col] = isHit ? 'hit' : 'miss';

    const newSunk = getSunkIds(aiPlacements, newShots);
    const justSunk = newSunk.filter(id => !aiSunkIds.includes(id));
    newShots = markWaterAroundSunkShips(newShots, aiPlacements, justSunk);
    setPlayerShots(newShots);
    setAiSunkIds(newSunk);

    let playerMsg = isHit ? '💥 Hit!' : '💧 Miss!';
    if (justSunk.length > 0) {
      const ship = SHIPS.find(s => s.id === justSunk[0]);
      playerMsg = `☠️ You sank the enemy ${ship?.name}!`;
    }

    if (newSunk.length === SHIPS.length) {
      setMsg('🎉 Victory! All enemy ships destroyed!');
      setWinner('player');
      setPhase('gameOver');
      return;
    }

    setMsg(playerMsg);
    if (isHit) {
      setMsg(`${playerMsg} Shoot again.`);
      return;
    }

    // AI fires back after 350ms
    const fireAiTurn = (shotsBefore, activeHitsBefore, prefixMsg) => {
      const move = aiMove(shotsBefore, activeHitsBefore);
      if (!move) return;
      const [ar, ac] = move;
      const aiHit = playerGrid[ar][ac] !== null;
      let newAiShots = shotsBefore.map(r => [...r]);
      newAiShots[ar][ac] = aiHit ? 'hit' : 'miss';

      let nextActiveHits = activeHitsBefore;
      if (aiHit) {
        nextActiveHits = [...activeHitsBefore, [ar, ac]];
      }

      const previousSunk = getSunkIds(playerPlacements, shotsBefore);
      const pSunk = getSunkIds(playerPlacements, newAiShots);
      const justPSunk = pSunk.filter(id => !previousSunk.includes(id));
      newAiShots = markWaterAroundSunkShips(newAiShots, playerPlacements, justPSunk);
      setAiShots(newAiShots);
      setPlayerSunkIds(pSunk);

      let aiMsg;
      if (justPSunk.length > 0) {
        const ship = SHIPS.find(s => s.id === justPSunk[0]);
        const sunkCells = playerPlacements.find(p => p.id === justPSunk[0])?.cells ?? [];
        nextActiveHits = nextActiveHits.filter(
          ([r, c]) => !sunkCells.some(([sr, sc]) => sr === r && sc === c)
        );
        aiMsg = `${prefixMsg} → AI sank your ${ship?.name}!`;
      } else {
        aiMsg = `${prefixMsg} → AI ${aiHit ? 'hit!' : 'missed.'}`;
      }

      aiHitsRef.current = nextActiveHits;

      if (pSunk.length === SHIPS.length) {
        setMsg('💀 Defeat! All your ships were sunk.');
        setWinner('ai');
        setPhase('gameOver');
        return;
      }

      setMsg(aiHit ? `${aiMsg} AI shoots again.` : aiMsg);
      if (aiHit) {
        setTimeout(() => fireAiTurn(newAiShots, nextActiveHits, aiMsg), 350);
      }
    };

    setTimeout(() => fireAiTurn(aiShots, aiHitsRef.current, playerMsg), 350);
  };

  // ── Reset ──────────────────────────────────────────────────────────────────────

  const resetGame = () => {
    if (room.isOnline) {
      if (!room.isHost && !room.allCanEdit) return;
      room.players.forEach((p) => {
        room.updatePlayerData(p.id, { ready: false });
      });
      room.updateSharedState({
        phase: 'setup',
        turnId: room.userId,
        shotsByPlayer: {},
        winnerId: null,
        msg: 'Place your fleet. Battle starts when both players are ready.',
      });
    }

    setPhase('setup');
    setPlayerGrid(emptyGrid());
    setPlayerPlacements([]);
    setPlacingIdx(0);
    setOrient('H');
    setAiGrid(emptyGrid());
    setAiPlacements([]);
    setPlayerShots(emptyShotGrid());
    setAiShots(emptyShotGrid());
    setAiSunkIds([]);
    setPlayerSunkIds([]);
    setActiveView('attack');
    setWinner(null);
    setMsg('');
    aiHitsRef.current = [];
  };

  // ── Grid render ────────────────────────────────────────────────────────────────

  const renderGrid = (grid, shots, showShips, onPress, disabled) => (
    <View>
      <View style={styles.labelsRow}>
        <View style={{ width: CELL, height: CELL }} />
        {COL_LABELS.map(l => (
          <View key={l} style={[styles.labelCell, { width: CELL, height: CELL }]}>
            <Text style={[styles.labelTxt, { color: theme.colors.textSecondary }]}>{l}</Text>
          </View>
        ))}
      </View>
      {Array.from({ length: GRID }, (_, r) => (
        <View key={r} style={styles.gridRow}>
          <View style={[styles.labelCell, { width: CELL, height: CELL }]}>
            <Text style={[styles.labelTxt, { color: theme.colors.textSecondary }]}>{r + 1}</Text>
          </View>
          {Array.from({ length: GRID }, (_, c) => {
            const shot = shots[r][c];
            const hasShip = showShips && grid[r][c] !== null;
            let bg = theme.dark ? '#1a2744' : '#c5dff7';
            if (hasShip) bg = '#1565C0';
            if (shot === 'hit') bg = '#C62828';
            if (shot === 'miss') bg = theme.dark ? '#1e3520' : '#c8e6c9';
            return (
              <TouchableOpacity
                key={c}
                style={[styles.gridCell, { width: CELL, height: CELL, backgroundColor: bg, borderColor: theme.dark ? '#243a5e' : '#90caf9' }]}
                onPress={() => !disabled && onPress?.(r, c)}
                disabled={disabled || !!shot}
                activeOpacity={shot || disabled ? 1 : 0.6}
              >
                {shot === 'hit' && <Text style={styles.cellEmoji}>💥</Text>}
                {shot === 'miss' && <Text style={[styles.missText, { color: theme.dark ? '#888' : '#555' }]}>•</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  const renderGroupedFleet = () => {
    const placedBySize = countBySize(playerPlacements);

    return (
      <View style={[styles.shipList, { backgroundColor: theme.colors.card, marginHorizontal: 16 }]}>
        {FLEET_GROUPS.map(({ size, count }) => {
          const placed = placedBySize[size] || 0;
          const complete = placed >= count;
          const active = currentShip?.size === size && !complete;

          return (
            <View key={size} style={[styles.shipRow, { borderTopColor: theme.colors.border }]}>
              <Text style={[styles.shipRowName, {
                color: complete ? theme.colors.textSecondary : active ? theme.colors.primary : theme.colors.text,
              }]}>
                {size}-tile x{count}
              </Text>
              <Text style={[styles.shipRowSize, { color: theme.colors.textSecondary }]}>
                {placed}/{count}
              </Text>
              {complete && <Text style={{ color: theme.colors.success, marginLeft: 6 }}>✓</Text>}
            </View>
          );
        })}
      </View>
    );
  };

  const renderEnemyFleetLeft = () => {
    const targetPlacements = room.isOnline ? (opponentData.placements || []) : aiPlacements;
    const shots = room.isOnline ? myOnlineShots : playerShots;
    const sunkIds = getSunkIds(targetPlacements, shots);
    const sunkBySize = countBySize(targetPlacements, sunkIds);

    return (
      <View style={[styles.fleetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Text style={[styles.fleetTitle, { color: theme.colors.textSecondary }]}>Enemy Ships Left</Text>
        <View style={styles.fleetChips}>
          {FLEET_GROUPS.map(({ size, count }) => {
            const left = Math.max(0, count - (sunkBySize[size] || 0));
            return (
              <View
                key={size}
                style={[
                  styles.fleetChip,
                  {
                    backgroundColor: left > 0 ? theme.colors.surface : theme.colors.success + '22',
                    borderColor: left > 0 ? theme.colors.border : theme.colors.success,
                  },
                ]}
              >
                <Text style={[styles.fleetChipText, { color: left > 0 ? theme.colors.text : theme.colors.success }]}>
                  {size}-tile x{left}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // ── Setup Phase ────────────────────────────────────────────────────────────────

  if ((room.isOnline ? onlinePhase : phase) === 'setup') {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />
        <GameHeader
          title="🚢 Sea Battle"
          showOnline={!room.isOnline}
          onOnlinePress={() => setShowRoomLobby(true)}
          style={{ paddingHorizontal: 16, paddingTop: 12, marginBottom: 8 }}
          actions={[
            ...(playerPlacements.length > 0 ? [{
              label: 'Undo',
              color: theme.colors.surface,
              outline: true,
              borderColor: theme.colors.border,
              textColor: theme.colors.text,
              onPress: handleUndo,
            }] : []),
            {
              label: 'Clear',
              color: theme.colors.surface,
              outline: true,
              borderColor: theme.colors.border,
              textColor: theme.colors.text,
              onPress: handleClear,
            }
          ]}
        />

        <View style={[styles.placingBar, { backgroundColor: theme.colors.card }]}>
          {room.isOnline && myOnlineData.ready ? (
            <Text style={[styles.allPlaced, { color: theme.colors.success }]}>
              Fleet ready — {opponent ? 'waiting for the other fleet.' : 'share the room code to invite an opponent.'}
            </Text>
          ) : currentShip ? (
            <>
              <View style={{ flex: 1 }}>
                <Text style={[styles.placingName, { color: theme.colors.text }]}>
                  {currentShip.emoji} Place {currentShip.name}
                </Text>
                <Text style={[styles.placingSize, { color: theme.colors.textSecondary }]}>
                  {Array(currentShip.size).fill('▮').join(' ')} · {currentShip.size} cells
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.orientBtn, { backgroundColor: theme.colors.primary }]}
                onPress={() => setOrient(o => o === 'H' ? 'V' : 'H')}
              >
                <Text style={styles.orientBtnTxt}>{orient === 'H' ? '↔ Horiz' : '↕ Vert'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.allPlaced, { color: theme.colors.success }]}>
              ✅ All ships placed — ready to battle!
            </Text>
          )}
        </View>

        <View style={styles.gridWrap}>
          {renderGrid(playerGrid, emptyShotGrid(), true, handleSetupCell, allPlaced || (room.isOnline && myOnlineData.ready))}
        </View>

        {renderGroupedFleet()}

        <View style={styles.setupBtns}>
          <TouchableOpacity
            style={[styles.setupBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]}
            onPress={handleRandom}
          >
            <Text style={[styles.setupBtnTxt, { color: theme.colors.text }]}>🎲 Random</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.setupBtn, { backgroundColor: allPlaced && !(room.isOnline && myOnlineData.ready) ? theme.colors.primary : theme.colors.textSecondary }]}
            onPress={allPlaced && !(room.isOnline && myOnlineData.ready) ? handleReady : undefined}
            disabled={!allPlaced || (room.isOnline && myOnlineData.ready)}
          >
            <Text style={styles.setupBtnTxtWhite}>{room.isOnline ? '✓ Ready' : '⚔️ Battle!'}</Text>
          </TouchableOpacity>
        </View>
        <AdBanner />
        <RoomLobby
          visible={showRoomLobby}
          onClose={() => setShowRoomLobby(false)}
          room={room}
          gameType="SeaBattle"
        />
      </ScrollView>
    );
  }

  // ── Battle / GameOver Phase ────────────────────────────────────────────────────

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: 30 }}
    >
      <OnlineBanner room={room} onPress={() => setShowRoomLobby(true)} />
      <GameHeader
        title="🚢 Sea Battle"
        showOnline={!room.isOnline}
        onOnlinePress={() => setShowRoomLobby(true)}
        style={{ paddingHorizontal: 16, paddingTop: 12, marginBottom: 8 }}
        actions={[{
          label: 'New Game',
          color: theme.colors.surface,
          outline: true,
          borderColor: theme.colors.border,
          textColor: theme.colors.text,
          onPress: resetGame,
        }]}
      />

      {(room.isOnline ? onlinePhase === 'gameOver' : phase === 'gameOver') && (
        <View style={[styles.resultBanner, {
          backgroundColor: (room.isOnline ? room.sharedState?.winnerId === room.userId : winner === 'player') ? theme.colors.success + '22' : theme.colors.danger + '22',
        }]}>
          <Text style={[styles.resultTxt, {
            color: (room.isOnline ? room.sharedState?.winnerId === room.userId : winner === 'player') ? theme.colors.success : theme.colors.danger,
          }]}>
            {(room.isOnline ? room.sharedState?.winnerId === room.userId : winner === 'player')
              ? '🎉 Victory! All enemy ships sunk!'
              : 'Defeat! All your ships were sunk.'}
          </Text>
          <TouchableOpacity
            style={[styles.playAgainBtn, { backgroundColor: theme.colors.primary }]}
            onPress={resetGame}
          >
            <Text style={styles.playAgainTxt}>Play Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!!(room.isOnline ? room.sharedState?.msg : msg) && (
        <View style={[styles.msgBar, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.msgTxt, { color: theme.colors.text }]}>
            {room.isOnline
              ? isWaiting
                ? (opponent ? 'Both fleets are not ready yet.' : `Waiting for opponent. Room: ${room.roomCode}`)
                : isMyTurn
                ? 'Your turn to fire.'
                : `${opponent?.displayName || 'Opponent'} is firing.`
              : msg}
          </Text>
          {room.isOnline && room.sharedState?.msg && (
            <Text style={[styles.msgSubTxt, { color: theme.colors.textSecondary }]}>{room.sharedState.msg}</Text>
          )}
        </View>
      )}

      {renderEnemyFleetLeft()}

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.border }]}>
        {[
          { key: 'attack', label: `🎯 Attack (${room.isOnline ? onlineAttackSunkCount : aiSunkIds.length}/${SHIPS.length})` },
          { key: 'defense', label: `🛡️ Defense (${room.isOnline ? onlineDefenseSunkCount : playerSunkIds.length}/${SHIPS.length})` },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeView === tab.key && { borderBottomColor: theme.colors.primary }]}
            onPress={() => setActiveView(tab.key)}
          >
            <Text style={[styles.tabTxt, {
              color: activeView === tab.key ? theme.colors.primary : theme.colors.textSecondary,
            }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.gridWrap}>
        {activeView === 'attack'
          ? renderGrid(
              room.isOnline ? (opponentData.grid || emptyGrid()) : aiGrid,
              room.isOnline ? myOnlineShots : playerShots,
              false,
              handleFire,
              room.isOnline ? (!isMyTurn || onlinePhase === 'gameOver' || isWaiting) : phase === 'gameOver'
            )
          : renderGrid(
              room.isOnline ? (myOnlineData.grid || playerGrid) : playerGrid,
              room.isOnline ? opponentOnlineShots : aiShots,
              true,
              null,
              true
            )
        }
      </View>
      <AdBanner />
      <RoomLobby
        visible={showRoomLobby}
        onClose={() => setShowRoomLobby(false)}
        room={room}
        gameType="SeaBattle"
      />
    </ScrollView>
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
  smallBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  smallBtnTxt: { fontSize: 14, fontWeight: '600' },

  placingBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 10, padding: 12, borderRadius: 12,
  },
  placingName: { fontSize: 16, fontWeight: 'bold' },
  placingSize: { fontSize: 13, marginTop: 2, letterSpacing: 2 },
  allPlaced: { fontSize: 15, fontWeight: '600', flex: 1 },
  orientBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  orientBtnTxt: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  gridWrap: { alignItems: 'center', marginVertical: 10 },
  labelsRow: { flexDirection: 'row' },
  gridRow: { flexDirection: 'row' },
  labelCell: { justifyContent: 'center', alignItems: 'center' },
  labelTxt: { fontSize: 10, fontWeight: '600' },
  gridCell: { borderWidth: 0.5, justifyContent: 'center', alignItems: 'center' },
  cellEmoji: { fontSize: CELL * 0.55 },
  missText: { fontSize: CELL * 0.6, fontWeight: 'bold' },

  shipList: { borderRadius: 12, marginTop: 12, overflow: 'hidden' },
  shipRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1,
  },
  shipRowName: { flex: 1, fontSize: 14, fontWeight: '600' },
  shipRowSize: { fontSize: 12, letterSpacing: 2 },

  fleetCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  fleetTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fleetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fleetChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fleetChipText: {
    fontSize: 13,
    fontWeight: '700',
  },

  setupBtns: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 16 },
  setupBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  setupBtnTxt: { fontSize: 16, fontWeight: 'bold' },
  setupBtnTxtWhite: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  resultBanner: { margin: 16, padding: 16, borderRadius: 14, alignItems: 'center', gap: 12 },
  resultTxt: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  playAgainBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  playAgainTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  msgBar: { marginHorizontal: 16, marginVertical: 6, padding: 10, borderRadius: 10 },
  msgTxt: { fontSize: 13, textAlign: 'center' },
  msgSubTxt: { fontSize: 12, textAlign: 'center', marginTop: 4 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginTop: 4 },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabTxt: { fontSize: 13, fontWeight: '600' },
});
