import { useTheme } from '@/src/theme';
import { GigStatus } from '@/src/types/gig';
import { InvoiceStatus } from '@/src/types/invoice';
import { StyleSheet, Text, View } from 'react-native';

type BadgeVariant = GigStatus | InvoiceStatus;

const LABELS: Record<BadgeVariant, string> = {
  active: 'Active',
  complete: 'Complete',
  cancelled: 'Cancelled',
  on_hold: 'On Hold',
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
};

interface Props {
  status: BadgeVariant;
}

export function Badge({ status }: Props) {
  const { colors } = useTheme();

  const badgeColor = resolveBadgeColor(status, colors);

  return (
    <View style={[styles.badge, { backgroundColor: badgeColor.bg }]}>
      <Text style={[styles.label, { color: badgeColor.text }]}>{LABELS[status]}</Text>
    </View>
  );
}

function resolveBadgeColor(
  status: BadgeVariant,
  colors: ReturnType<typeof useTheme>['colors'],
): { bg: string; text: string } {
  switch (status) {
    case 'active':
      return { bg: `${colors.success}22`, text: colors.success };
    case 'complete':
    case 'paid':
      return { bg: `${colors.accent}22`, text: colors.accent };
    case 'cancelled':
      return { bg: `${colors.danger}22`, text: colors.danger };
    case 'on_hold':
      return { bg: `${colors.warning}22`, text: colors.warning };
    case 'draft':
      return { bg: `${colors.textSecondary}22`, text: colors.textSecondary };
    case 'sent':
      return { bg: `${colors.warning}22`, text: colors.warning };
  }
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
