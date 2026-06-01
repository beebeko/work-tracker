/**
 * Invoice gig picker — two-step flow for the Invoices tab "+" button.
 *
 * Step 1: pick a client
 * Step 2: pick a gig for that client
 * Then navigate to invoice-entries modal.
 */
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Row } from '@/src/components/ui/Row';
import { Screen } from '@/src/components/ui/Screen';
import { useClients } from '@/src/hooks/useClients';
import { useGigs } from '@/src/hooks/useGigs';
import { Client } from '@/src/types/client';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList } from 'react-native';

export default function InvoiceGigPickerModal() {
  const router = useRouter();
  const { data: clients, isLoading: loadingClients } = useClients();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const { data: gigs, isLoading: loadingGigs } = useGigs(selectedClient?.id ?? '');

  if (!selectedClient) {
    // Step 1 — pick client
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Select Client' }} />
        {loadingClients ? (
          <EmptyState message="Loading clients…" />
        ) : (
          <FlatList
            data={clients ?? []}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <Row
                title={item.name}
                subtitle={item.email}
                onPress={() => setSelectedClient(item)}
                chevron
              />
            )}
            ListEmptyComponent={<EmptyState message="No clients" hint="Create a client first." />}
          />
        )}
      </Screen>
    );
  }

  // Step 2 — pick gig
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: `${selectedClient.name} — Gig`,
          headerBackTitle: 'Clients',
        }}
      />
      {loadingGigs ? (
        <EmptyState message="Loading gigs…" />
      ) : (
        <FlatList
          data={gigs ?? []}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => (
            <Row
              title={item.name}
              subtitle={item.status}
              onPress={() =>
                router.replace({
                  pathname: '/(modals)/invoice-entries',
                  params: { clientId: selectedClient.id, gigId: item.id },
                })
              }
              chevron
            />
          )}
          ListEmptyComponent={
            <EmptyState message="No gigs" hint="Add gigs to this client first." />
          }
        />
      )}
    </Screen>
  );
}
