import type { Metric } from 'expo-app-metrics';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/utils/theme';

export function MetricsPanel({ metrics }: { metrics: Metric[] }) {
  const theme = useTheme();
  if (metrics.length === 0) {
    return <Text style={[styles.empty, { color: theme.text.secondary }]}>No metrics recorded</Text>;
  }

  const groups = groupByCategory(metrics);

  return (
    <View style={styles.container}>
      {groups.map(({ category, items }) => (
        <View
          key={category}
          style={[
            styles.group,
            { backgroundColor: theme.background.element, borderColor: theme.border.default },
          ]}>
          <View style={styles.groupHeader}>
            <Text style={[styles.groupTitle, { color: theme.text.default }]}>
              {capitalize(category)}
            </Text>
            <Text style={[styles.groupCount, { color: theme.text.tertiary }]}>{items.length}</Text>
          </View>
          {items.map((metric, index) => (
            <View key={`${metric.name}-${index}`} style={styles.metricRow}>
              <Text style={[styles.metricName, { color: theme.text.default }]} numberOfLines={1}>
                {metric.name}
                {metric.routeName ? (
                  <Text style={{ color: theme.text.tertiary }}> · {metric.routeName}</Text>
                ) : null}
              </Text>
              <Text style={[styles.metricValue, { color: theme.text.secondary }]}>
                {formatValue(metric.value)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function groupByCategory(metrics: Metric[]) {
  const map = new Map<string, Metric[]>();
  for (const metric of metrics) {
    const list = map.get(metric.category);
    if (list) {
      list.push(metric);
    } else {
      map.set(metric.category, [metric]);
    }
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

function formatValue(value: number) {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(3);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  group: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  groupCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 3,
  },
  metricName: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  metricValue: {
    fontFamily: 'Menlo',
    fontSize: 12,
  },
  empty: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 12,
  },
});
