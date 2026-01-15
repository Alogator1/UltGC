import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import GamesScreen from './screens/GamesScreen';
import SettingsScreen from './screens/SettingsScreen';
import FAQScreen from './screens/FAQScreen';
import CounterScreen from './screens/CounterScreen';
import MunchkinScreen from './screens/MunchkinScreen';
import TicketToRideScreen from './screens/TicketToRideScreen';
import UnoScreen from './screens/UnoScreen';
import DiceRollerScreen from './screens/DiceRollerScreen';
import CatanScreen from './screens/CatanScreen';
import SevenWondersScreen from './screens/SevenWondersScreen';
import AzulScreen from './screens/AzulScreen';
import PlayerSelectorScreen from './screens/PlayerSelectorScreen';
import Magic8BallScreen from './screens/Magic8BallScreen';
import TicTacToeScreen from './screens/TicTacToeScreen';

const Tab = createBottomTabNavigator();
const GamesStack = createNativeStackNavigator();

function GamesStackNavigator() {
  const { theme } = useTheme();
  
  return (
    <GamesStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <GamesStack.Screen
        name="GamesList"
        component={GamesScreen}
        options={{ title: 'Games' }}
      />
      <GamesStack.Screen
        name="Counter"
        component={CounterScreen}
        options={{ title: 'Counter' }}
      />
      <GamesStack.Screen
        name="Munchkin"
        component={MunchkinScreen}
        options={{ title: 'Munchkin' }}
      />
      <GamesStack.Screen
        name="TicketToRide"
        component={TicketToRideScreen}
        options={{ title: 'Ticket to Ride' }}
      />
      <GamesStack.Screen
        name="Uno"
        component={UnoScreen}
        options={{ title: 'UNO' }}
      />
      <GamesStack.Screen
        name="DiceRoller"
        component={DiceRollerScreen}
        options={{ title: 'Dice Roller' }}
      />
      <GamesStack.Screen
        name="Catan"
        component={CatanScreen}
        options={{ title: 'Catan' }}
      />
      <GamesStack.Screen
        name="SevenWonders"
        component={SevenWondersScreen}
        options={{ title: '7 Wonders' }}
      />
      <GamesStack.Screen
        name="Azul"
        component={AzulScreen}
        options={{ title: 'Azul' }}
      />
      <GamesStack.Screen
        name="PlayerSelector"
        component={PlayerSelectorScreen}
        options={{ title: 'Player Selector' }}
      />
      <GamesStack.Screen
        name="FortuneOrb"
        component={Magic8BallScreen}
        options={{ title: 'Fortune Orb' }}
      />
      <GamesStack.Screen
        name="TicTacToe"
        component={TicTacToeScreen}
        options={{ title: 'Tic Tac Toe' }}
      />
    </GamesStack.Navigator>
  );
}

export default function App() {
  return (
    <SubscriptionProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SubscriptionProvider>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/active/) &&
        nextAppState === 'background'
      ) {
        // App is going to background, save a timestamp
        AsyncStorage.setItem('appBackgroundTime', Date.now().toString());
      }

      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App is coming back to foreground
        // Check if it was closed (typically > 30 minutes in background means it was terminated)
        AsyncStorage.getItem('appBackgroundTime').then(timestamp => {
          if (timestamp) {
            const timeDiff = Date.now() - parseInt(timestamp);
            // If more than 30 minutes, clear the game data (app was likely terminated)
            if (timeDiff > 30 * 60 * 1000) {
              AsyncStorage.multiRemove(['ticketToRideGameData', 'munchkinGameData', 'counterGameData', 'unoGameData', 'diceRollerGameData', 'catanGameData', 'sevenWondersGameData', 'azulGameData']);
            }
          }
        });
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textTertiary,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Games') {
              iconName = focused ? 'game-controller' : 'game-controller-outline';
            } else if (route.name === 'FAQ') {
              iconName = focused ? 'help-circle' : 'help-circle-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Games"
          component={GamesStackNavigator}
          options={{
            title: 'Games',
          }}
        />
        <Tab.Screen
          name="FAQ"
          component={FAQScreen}
          options={{
            title: 'FAQ',
            headerShown: true,
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            headerShown: true,
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
      </Tab.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

