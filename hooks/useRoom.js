import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot,
  collection, serverTimestamp, getDocs, deleteDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { generateRoomCode } from '../utils/roomCode';

export function useRoom(gameType) {
  const { userId, displayName } = useAuth();
  const [roomCode, setRoomCode] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [allCanEdit, setAllCanEditState] = useState(false);
  const [players, setPlayers] = useState([]);
  const [sharedState, setSharedState] = useState(null);
  const [roomStatus, setRoomStatus] = useState(null);
  const [error, setError] = useState(null);

  const unsubscribeRefs = useRef([]);
  const roomCodeRef = useRef(null); // ref so deleteRoom always sees current value

  // Create a new room
  const createRoom = useCallback(
    async (initialGameState = {}) => {
      if (!userId) return null;

      let code;
      let attempts = 0;

      // Generate unique room code
      do {
        code = generateRoomCode();
        const roomRef = doc(db, 'rooms', code);
        try {
          const existing = await getDoc(roomRef);
          if (!existing.exists()) break;
        } catch (err) {
          console.error('Error checking room code:', err);
          break;
        }
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        setError('Could not generate unique room code. Please try again.');
        return null;
      }

      try {
        // Create room document
        const roomRef = doc(db, 'rooms', code);
        await setDoc(roomRef, {
          gameType,
          hostId: userId,
          status: 'waiting',
          allCanEdit: false,
          createdAt: serverTimestamp(),
          lastActivity: serverTimestamp(),
        });

        // Add host as first player
        const playerRef = doc(db, 'rooms', code, 'players', userId);
        await setDoc(playerRef, {
          displayName,
          joinedAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
          isConnected: true,
          playerData: {},
        });

        // Set initial shared game state
        const stateRef = doc(db, 'rooms', code, 'gameState', 'current');
        await setDoc(stateRef, {
          ...initialGameState,
          updatedAt: serverTimestamp(),
        });

        setRoomCode(code);
        roomCodeRef.current = code;
        setIsOnline(true);
        setIsHost(true);
        setRoomStatus('waiting');
        setError(null);

        subscribeToRoom(code);
        return code;
      } catch (err) {
        console.error('Error creating room:', err);
        setError('Failed to create room. Please try again.');
        return null;
      }
    },
    [userId, displayName, gameType]
  );

  // Join an existing room
  const joinRoom = useCallback(
    async (code) => {
      if (!userId) return false;

      const normalizedCode = code.toUpperCase().trim();

      try {
        const roomRef = doc(db, 'rooms', normalizedCode);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
          setError('Room not found. Check the code and try again.');
          return false;
        }

        const roomData = roomSnap.data();

        if (roomData.gameType !== gameType) {
          setError(`This room is for ${roomData.gameType}, not ${gameType}.`);
          return false;
        }

        if (roomData.status === 'finished') {
          setError('This game has already ended.');
          return false;
        }

        // Add self as player
        const playerRef = doc(db, 'rooms', normalizedCode, 'players', userId);
        await setDoc(
          playerRef,
          {
            displayName,
            joinedAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
            isConnected: true,
            playerData: {},
          },
          { merge: true }
        );

        setRoomCode(normalizedCode);
        roomCodeRef.current = normalizedCode;
        setIsOnline(true);
        setIsHost(roomData.hostId === userId);
        setRoomStatus(roomData.status);
        setError(null);

        subscribeToRoom(normalizedCode);
        return true;
      } catch (err) {
        console.error('Error joining room:', err);
        setError('Failed to join room. Please try again.');
        return false;
      }
    },
    [userId, displayName, gameType]
  );

  // Subscribe to real-time room updates
  const subscribeToRoom = useCallback(
    (code) => {
      // Unsubscribe from previous listeners
      unsubscribeRefs.current.forEach((unsub) => unsub());
      unsubscribeRefs.current = [];

      try {
        // Listen to room document
        const roomUnsub = onSnapshot(doc(db, 'rooms', code), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setRoomStatus(data.status);
            setIsHost(data.hostId === userId);
            setAllCanEditState(data.allCanEdit ?? false);
          } else {
            // Room was deleted
            leaveRoom();
          }
        });

        // Listen to players subcollection
        const playersUnsub = onSnapshot(
          collection(db, 'rooms', code, 'players'),
          (snapshot) => {
            const playerList = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            setPlayers(playerList);
          }
        );

        // Listen to game state
        const stateUnsub = onSnapshot(
          doc(db, 'rooms', code, 'gameState', 'current'),
          (snap) => {
            if (snap.exists()) {
              setSharedState(snap.data());
            }
          }
        );

        unsubscribeRefs.current = [roomUnsub, playersUnsub, stateUnsub];
      } catch (err) {
        console.error('Error subscribing to room:', err);
        setError('Connection lost. Please rejoin the room.');
      }
    },
    [userId]
  );

  // Update own player data
  const updateMyPlayerData = useCallback(
    async (playerData) => {
      if (!roomCode || !userId) return;
      try {
        const playerRef = doc(db, 'rooms', roomCode, 'players', userId);
        await updateDoc(playerRef, { playerData, lastSeen: serverTimestamp() });
        await updateDoc(doc(db, 'rooms', roomCode), { lastActivity: serverTimestamp() });
      } catch (err) {
        console.error('Error updating player data:', err);
      }
    },
    [roomCode, userId]
  );

  // Update any player's data — only allowed when allCanEdit is true or it's your own
  const updatePlayerData = useCallback(
    async (targetUserId, playerData) => {
      if (!roomCode || !userId) return;
      if (!isHost && !allCanEdit && targetUserId !== userId) return;
      try {
        const playerRef = doc(db, 'rooms', roomCode, 'players', targetUserId);
        await updateDoc(playerRef, { playerData, lastSeen: serverTimestamp() });
        await updateDoc(doc(db, 'rooms', roomCode), { lastActivity: serverTimestamp() });
      } catch (err) {
        console.error('Error updating player data:', err);
      }
    },
    [roomCode, userId, allCanEdit, isHost]
  );

  // Update shared game state
  const updateSharedState = useCallback(
    async (newState) => {
      if (!roomCode) return;

      try {
        const stateRef = doc(db, 'rooms', roomCode, 'gameState', 'current');
        await updateDoc(stateRef, {
          ...newState,
          updatedAt: serverTimestamp(),
        });

        // Update room's lastActivity
        await updateDoc(doc(db, 'rooms', roomCode), {
          lastActivity: serverTimestamp(),
        });
      } catch (err) {
        console.error('Error updating shared state:', err);
      }
    },
    [roomCode]
  );

  // Delete the room and all subcollection documents from Firestore
  const deleteRoom = useCallback(async () => {
    const code = roomCodeRef.current;
    if (!code) return;

    unsubscribeRefs.current.forEach((unsub) => unsub());
    unsubscribeRefs.current = [];

    try {
      const [playersSnap, stateSnap] = await Promise.all([
        getDocs(collection(db, 'rooms', code, 'players')),
        getDocs(collection(db, 'rooms', code, 'gameState')),
      ]);
      await Promise.all([
        ...playersSnap.docs.map((d) => deleteDoc(d.ref)),
        ...stateSnap.docs.map((d) => deleteDoc(d.ref)),
        deleteDoc(doc(db, 'rooms', code)),
      ]);
    } catch (err) {
      console.error('Error deleting room:', err);
    }

    roomCodeRef.current = null;
    setRoomCode(null);
    setIsOnline(false);
    setIsHost(false);
    setAllCanEditState(false);
    setPlayers([]);
    setSharedState(null);
    setRoomStatus(null);
    setError(null);
  }, []); // no deps — reads from ref to avoid stale closures

  // Toggle whether all players can edit shared state (host only)
  const toggleAllCanEdit = useCallback(async () => {
    if (!roomCode || !isHost) return;
    try {
      await updateDoc(doc(db, 'rooms', roomCode), {
        allCanEdit: !allCanEdit,
        lastActivity: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error toggling allCanEdit:', err);
    }
  }, [roomCode, isHost, allCanEdit]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (roomCode && userId) {
      try {
        const playerRef = doc(db, 'rooms', roomCode, 'players', userId);
        await updateDoc(playerRef, {
          isConnected: false,
          lastSeen: serverTimestamp(),
        });
      } catch (err) {
        // Ignore if doc already deleted
        console.error('Error leaving room:', err);
      }
    }

    // Unsubscribe from all listeners
    unsubscribeRefs.current.forEach((unsub) => unsub());
    unsubscribeRefs.current = [];

    roomCodeRef.current = null;
    setRoomCode(null);
    setIsOnline(false);
    setIsHost(false);
    setAllCanEditState(false);
    setPlayers([]);
    setSharedState(null);
    setRoomStatus(null);
    setError(null);
  }, [roomCode, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeRefs.current.forEach((unsub) => unsub());
    };
  }, []);

  // Heartbeat: update lastSeen every 30 seconds while online
  useEffect(() => {
    if (!isOnline || !roomCode || !userId) return;

    const interval = setInterval(async () => {
      try {
        const playerRef = doc(db, 'rooms', roomCode, 'players', userId);
        await updateDoc(playerRef, {
          lastSeen: serverTimestamp(),
          isConnected: true,
        });
      } catch (err) {
        console.error('Heartbeat error:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline, roomCode, userId]);

  return {
    // State
    roomCode,
    isOnline,
    isHost,
    allCanEdit,
    players,
    sharedState,
    roomStatus,
    error,
    userId,

    // Actions
    createRoom,
    joinRoom,
    leaveRoom,
    deleteRoom,
    updateMyPlayerData,
    updatePlayerData,
    updateSharedState,
    toggleAllCanEdit,
    setError,
  };
}
