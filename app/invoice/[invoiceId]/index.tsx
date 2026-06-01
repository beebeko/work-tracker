/**
 * Invoice detail screen — /invoice/[invoiceId]
 *
 * Shows invoice details, line items table, history, and action buttons:
 *  - "Open PDF" → getDownloadURL → Linking.openURL
 *  - "Send Email" → inline from/to fields + useSendInvoice
 *  - "Mark as Paid" (when status = sent)
 */
import { Badge } from '@/src/components/ui/Badge';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { formatDate, formatMoney } from '@/src/components/ui/format';
import { useInvoicePdfUrl, useSendInvoice } from '@/src/hooks/useInvoiceActions';
import { useInvoice, useUpdateInvoice } from '@/src/hooks/useInvoices';
import { useTheme } from '@/src/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function InvoiceDetailScreen() {
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();
  const { data: invoice, isLoading, isError } = useInvoice(invoiceId);
  const updateInvoice = useUpdateInvoice(invoiceId);
  const sendInvoice = useSendInvoice();
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();

  const { data: pdfUrl } = useInvoicePdfUrl(invoice?.pdfStoragePath);

  const [showSendForm, setShowSendForm] = useState(false);
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');

  if (isLoading)
    return (
      <Screen>
        <EmptyState message="Loading invoice…" />
      </Screen>
    );
  if (isError || !invoice)
    return (
      <Screen>
        <EmptyState message="Invoice not found" />
      </Screen>
    );

  async function handleOpenPdf() {
    if (!pdfUrl) {
      Alert.alert('No PDF', 'PDF not yet generated.');
      return;
    }
    await Linking.openURL(pdfUrl);
  }

  async function handleSend() {
    if (!fromAddress.trim() || !toAddress.trim()) {
      Alert.alert('Required', 'Enter from and to email addresses.');
      return;
    }
    try {
      await sendInvoice.mutateAsync({
        invoiceId,
        fromAddress: fromAddress.trim(),
        toAddress: toAddress.trim(),
      });
      setShowSendForm(false);
      Alert.alert('Sent', 'Invoice emailed successfully.');
    } catch {
      Alert.alert('Error', 'Failed to send invoice.');
    }
  }

  async function handleMarkPaid() {
    await updateInvoice.mutateAsync({ status: 'paid' });
  }

  async function handleRegenerate() {
    router.push({
      pathname: '/(modals)/invoice-entries',
      params: {
        clientId: invoice!.clientId,
        gigId: invoice!.gigId,
        invoiceId: invoice!.id,
      },
    });
  }

  return (
    <Screen flex={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[typography.title, { color: colors.text }]}>{invoice.invoiceNumber}</Text>
          <Badge status={invoice.status} />
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          Issued: {formatDate(invoice.createdAt.toDate?.()?.toISOString?.()?.slice(0, 10) ?? '')}
          {invoice.dueDate ? `  ·  Due: ${formatDate(invoice.dueDate)}` : ''}
        </Text>

        {/* Line items */}
        <Text style={[typography.label, { color: colors.text, marginTop: spacing.md }]}>
          Line Items
        </Text>
        {invoice.lineItems.map((item, i) => (
          <View key={i} style={[styles.lineItem, { borderBottomColor: colors.border }]}>
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
              {item.description}
            </Text>
            <View style={styles.lineItemRight}>
              {item.hours != null && (
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {item.hours}h
                </Text>
              )}
              <Text style={[typography.body, { color: colors.text }]}>
                {formatMoney(item.amount)}
              </Text>
            </View>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsRow}>
          <Text style={[typography.label, { color: colors.textSecondary }]}>Subtotal</Text>
          <Text style={[typography.body, { color: colors.text }]}>
            {formatMoney(invoice.subtotal)}
          </Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={[typography.label, { color: colors.text }]}>TOTAL</Text>
          <Text style={[typography.title, { color: colors.text }]}>
            {formatMoney(invoice.totalAmount)}
          </Text>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.label, { color: colors.textSecondary }]}>Notes</Text>
            <Text style={[typography.body, { color: colors.text }]}>{invoice.notes}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={[styles.actions, { marginTop: spacing.lg }]}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.accent }]}
            onPress={handleOpenPdf}
            disabled={!pdfUrl}
          >
            <Text style={[typography.label, { color: '#fff' }]}>Open PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.accent }]}
            onPress={() => setShowSendForm((v) => !v)}
          >
            <Text style={[typography.label, { color: '#fff' }]}>
              {showSendForm ? 'Cancel' : 'Send Email'}
            </Text>
          </TouchableOpacity>

          {invoice.status === 'draft' && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.accent }]}
              onPress={handleRegenerate}
            >
              <Text style={[typography.label, { color: '#fff' }]}>Regenerate</Text>
            </TouchableOpacity>
          )}

          {invoice.status === 'sent' && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#2ecc71' }]}
              onPress={handleMarkPaid}
              disabled={updateInvoice.isPending}
            >
              <Text style={[typography.label, { color: '#fff' }]}>Mark as Paid</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Send email inline form */}
        {showSendForm && (
          <View style={[styles.sendForm, { borderColor: colors.border }]}>
            <TextInput
              style={[styles.emailInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="From address"
              placeholderTextColor={colors.textSecondary}
              value={fromAddress}
              onChangeText={setFromAddress}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.emailInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="To address"
              placeholderTextColor={colors.textSecondary}
              value={toAddress}
              onChangeText={setToAddress}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.accent }]}
              onPress={handleSend}
              disabled={sendInvoice.isPending}
            >
              <Text style={[typography.label, { color: '#fff' }]}>
                {sendInvoice.isPending ? 'Sending…' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* History */}
        {invoice.history.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typography.label, { color: colors.textSecondary }]}>
              Prior Versions ({invoice.history.length})
            </Text>
            {invoice.history.map((snap, i) => (
              <View key={i} style={[styles.historyItem, { borderColor: colors.border }]}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Version {i + 1} · {snap.lineItems.length} line item(s) ·{' '}
                  {formatMoney(snap.totalAmount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lineItem: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineItemRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginTop: 4,
  },
  actions: {
    gap: 10,
  },
  btn: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  sendForm: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  emailInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
  },
  historyItem: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
});
