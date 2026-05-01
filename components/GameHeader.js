import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

export default function GameHeader({
  title,
  subtitle,
  showOnline = false,
  onOnlinePress,
  actions = [],
  style,
}) {
  const { theme } = useTheme();
  const visibleActions = [
    showOnline && {
      key: 'online',
      icon: 'wifi',
      color: theme.colors.primary,
      onPress: onOnlinePress,
      accessibilityLabel: 'Open online room',
    },
    ...actions,
  ].filter(Boolean);

  return (
    <View style={[styles.header, style]}>
      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {visibleActions.length > 0 && (
        <View style={styles.actions}>
          {visibleActions.map((action, index) => {
            const key = action.key || action.label || action.icon || String(index);
            const backgroundColor = action.color || theme.colors.surface;
            const borderColor = action.borderColor || theme.colors.border;

            if (action.icon) {
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.iconButton,
                    { backgroundColor },
                    action.outline && { borderWidth: 1, borderColor },
                    action.disabled && styles.disabled,
                  ]}
                  onPress={action.onPress}
                  disabled={action.disabled}
                  accessibilityLabel={action.accessibilityLabel}
                >
                  <Ionicons name={action.icon} size={16} color={action.iconColor || '#fff'} />
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.textButton,
                  { backgroundColor },
                  action.outline && { borderWidth: 1, borderColor },
                  action.disabled && styles.disabled,
                ]}
                onPress={action.onPress}
                disabled={action.disabled}
              >
                <Text style={[styles.textButtonLabel, { color: action.textColor || '#fff' }]} numberOfLines={1}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
});
