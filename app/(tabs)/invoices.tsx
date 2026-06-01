import { Badge } from '@/src/components/ui/Badge';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { formatDate, formatMoney } from '@/src/components/ui/format';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useTheme } from '@/src/theme';
import { Stack, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

export default function InvoicesScreen() {
  const { data: invoices, isLoading, isError } = useInvoices();
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();

  if (isLoading) {
    return (
      <Screen>
        <EmptyState message="Loading invoices…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <EmptyState message="Failed to load invoices" hint="Check your connection and try again." />
      </Screen>
    );
  }

  return (
    <Screen flex={false}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/(modals)/invoice-gig-picker')}
              accessibilityRole="button"
              accessibilityLabel="Create invoice"
            >
              <Text style={{ color: colors.accent, fontSize: 28, lineHeight: 32 }}>+</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={invoices ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { backgroundColor: colors.background },
          !invoices?.length && styles.emptyList,
        ]}
        style={{ backgroundColor: colors.background }}
        ListEmptyComponent={
          <EmptyState message="No invoices yet" hint="Tap + to create your first invoice." />
        }
        renderItem={({ item }) => (
          <Row
            title={item.invoiceNumber}
            subtitle={item.dueDate ? `Due ${formatDate(item.dueDate)}` : undefined}
            onPress={() => router.push(`/invoice/${item.id}`)}
            right={
              <>
                <Text style={[typography.body, { color: colors.text, marginRight: spacing.sm }]}>
                  {formatMoney(item.totalAmount)}
                </Text>
                <Badge status={item.status} />
              </>
            }
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
  },
  emptyList: {
    flex: 1,
  },
});
