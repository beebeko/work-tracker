import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { useClients } from '@/src/hooks/useClients';
import { usePendingImports } from '@/src/hooks/usePendingImports';
import { useTheme } from '@/src/theme';
import { PendingImport } from '@/src/types/pendingImport';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';

export default function ImportsScreen() {
  const { data: imports, isLoading, isError } = usePendingImports();
  const { data: clients } = useClients();
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();
  const [showDismissed, setShowDismissed] = useState(false);

  const visible = (imports ?? []).filter((i) =>
    showDismissed ? i.status !== 'imported' : i.status === 'pending',
  );

  if (isLoading) {
    return (
      <Screen>
        <EmptyState message="Loading imports…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <EmptyState message="Failed to load imports" hint="Check your connection and try again." />
      </Screen>
    );
  }

  return (
    <Screen flex={false}>
      <View
        style={[
          styles.toolbar,
          { borderBottomColor: colors.border, paddingHorizontal: spacing.md },
        ]}
      >
        <Text style={[typography.label, { color: colors.textSecondary }]}>Show dismissed</Text>
        <Switch
          value={showDismissed}
          onValueChange={setShowDismissed}
          accessibilityLabel="Show dismissed imports"
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState
            message={showDismissed ? 'No dismissed imports' : 'No pending imports'}
            hint={showDismissed ? undefined : 'Emails from tracked senders will appear here.'}
          />
        }
        renderItem={({ item }) => {
          const client = clients?.find((c) => c.id === item.clientId);
          return (
            <ImportRow
              item={item}
              clientName={client?.name ?? item.clientId}
              onPress={() =>
                router.push({
                  pathname: '/(modals)/import-review',
                  params: { importId: item.id },
                })
              }
            />
          );
        }}
      />
    </Screen>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ImportRowProps {
  item: PendingImport;
  clientName: string;
  onPress: () => void;
}

function ImportRow({ item, clientName, onPress }: ImportRowProps) {
  const { colors, typography } = useTheme();
  const confidenceColor = resolveConfidenceColor(item.extracted.confidence, colors);

  const subtitle = [
    item.extracted.date,
    item.extracted.entryType === 'shift' ? '⏱ Shift' : '💰 Lump sum',
    item.status === 'dismissed' ? '(dismissed)' : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Row
      title={clientName}
      subtitle={subtitle}
      right={
        <View style={styles.rightBlock}>
          <Text style={[typography.caption, { color: confidenceColor }]}>
            {Math.round(item.extracted.confidence * 100)}%
          </Text>
        </View>
      }
      onPress={item.status === 'pending' ? onPress : undefined}
    />
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rightBlock: {
    alignItems: 'flex-end',
  },
});
