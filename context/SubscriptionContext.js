import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      const savedStatus = await AsyncStorage.getItem('isPremium');
      if (savedStatus !== null) {
        setIsPremium(JSON.parse(savedStatus));
      }
    } catch (error) {
      console.error('Error loading subscription status:', error);
    }
  };

  const togglePremium = async () => {
    try {
      const newStatus = !isPremium;
      setIsPremium(newStatus);
      await AsyncStorage.setItem('isPremium', JSON.stringify(newStatus));
    } catch (error) {
      console.error('Error saving subscription status:', error);
    }
  };

  return (
    <SubscriptionContext.Provider value={{ isPremium, togglePremium }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
