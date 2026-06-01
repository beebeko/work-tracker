import { usePendingImportCount } from '@/src/hooks/usePendingImports';
import { useTheme } from '@/src/theme';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

export default function TabLayout() {
  const { colors } = useTheme();
  const pendingCount = usePendingImportCount();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
        },
        headerStyle: { backgroundColor: colors.headerBackground },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Clients',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'person.2.fill', android: 'people', web: 'people' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="entries"
        options={{
          title: 'Entries',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="imports"
        options={{
          title: 'Imports',
          tabBarIcon: ({ color }) => (
            <View>
              <SymbolView
                name={{
                  ios: 'tray.and.arrow.down.fill',
                  android: 'move_to_inbox',
                  web: 'move_to_inbox',
                }}
                tintColor={color}
                size={24}
              />
              {pendingCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.badgeText}>
                    {pendingCount > 99 ? '99+' : String(pendingCount)}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Invoices',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      {/* gigs screen is still accessible via client drill-down; hidden from tab bar */}
      <Tabs.Screen name="gigs" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
  },
});
