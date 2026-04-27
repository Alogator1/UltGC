import React, { createContext, useState, useContext, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';

const ADJECTIVES = ['Bold','Calm','Dark','Eager','Fair','Glad','Hazy','Icy','Jolly','Kind','Lazy','Merry','Noble','Proud','Quick','Rare','Sage','Tame','Vast','Warm','Young','Zany'];
const ANIMALS = ['Bear','Crow','Deer','Eagle','Fox','Goat','Hawk','Jay','Kite','Lion','Mole','Newt','Owl','Pike','Raven','Seal','Toad','Wolf','Yak'];

function generateRandomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj}${animal}${num}`;
}

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [displayName, setDisplayName] = useState('Player');

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is already signed in
        setUser(firebaseUser);
      } else {
        // No user, sign in anonymously
        try {
          const result = await signInAnonymously(auth);
          setUser(result.user);
        } catch (error) {
          console.error('Anonymous auth failed:', error);
        }
      }
      setIsAuthReady(true);
    });

    // Load saved display name from local storage, generate random one if none
    const loadDisplayName = async () => {
      try {
        const savedName = await AsyncStorage.getItem('userDisplayName');
        if (savedName) {
          setDisplayName(savedName);
        } else {
          const randomName = generateRandomName();
          setDisplayName(randomName);
          await AsyncStorage.setItem('userDisplayName', randomName);
        }
      } catch (error) {
        console.error('Error loading display name:', error);
      }
    };

    loadDisplayName();

    return unsubscribe;
  }, []);

  const updateDisplayName = async (name) => {
    try {
      setDisplayName(name);
      await AsyncStorage.setItem('userDisplayName', name);
    } catch (error) {
      console.error('Error saving display name:', error);
    }
  };

  const value = {
    user,
    userId: user?.uid || null,
    isAuthReady,
    displayName,
    updateDisplayName,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
