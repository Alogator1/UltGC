import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const lightTheme = {
  dark: false,
  colors: {
    primary: '#007AFF',
    background: '#fff',
    surface: '#f5f5f5',
    text: '#333',
    textSecondary: '#666',
    textTertiary: '#999',
    border: '#e0e0e0',
    danger: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    card: '#f9f9f9',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
};

export const darkTheme = {
  dark: true,
  colors: {
    primary: '#0A84FF',
    background: '#000',
    surface: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#A9A9AF',
    textTertiary: '#8E8E93',
    border: '#424245',
    danger: '#FF453A',
    success: '#30B0C0',
    warning: '#FF9500',
    card: '#2C2C2E',
    overlay: 'rgba(0, 0, 0, 0.8)',
  },
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('appTheme');
      if (savedTheme) {
        setIsDarkMode(JSON.parse(savedTheme));
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem('appTheme', JSON.stringify(newMode));
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};
