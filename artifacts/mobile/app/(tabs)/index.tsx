import { Feather } from "@expo/vector-icons";
import { getListDevicesQueryKey, useListDevices } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const TEN_MIN = 10 * 60 * 1000;

function hourmeterH(min: number | null | undefined) {
  if (min == null) return null;
  return Math.floor(min / 60);
}

function statusColor(
  hours: number | null | undefined,
  limit: number | null | undefined,
  colors: ReturnType<typeof useColors>
) {
  if (hours == null || limit == null) return colors.mutedForeground;
  if (hours >= limit) return colors.danger;
  if (hours >= limit - 50) return colors.warning;
  return colors.success;
}

function KpiCard({
  label,
  value,
  icon,
  accent,
  colors,
}: {
  label: string;
  value: string | number;
  icon: string;
  accent: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        kpiStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[kpiStyles.iconWrap, { backgroundColor: accent + "22" }]}>
        <Feather name={icon as never} size={18} color={accent} />
      </View>
      <Text
        style={[kpiStyles.value, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={[kpiStyles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

export default function FleetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const { data: devices = [], isLoading, refetch, isRefetching } = useListDevices(
    undefined,
    {
      query: {
        queryKey: getListDevicesQueryKey(),
        refetchInterval: 30_000,
        enabled: !!token,
      },
    }
  );

  const kpis = useMemo(() => {
    const now = Date.now();
    let active = 0;
    let totalH = 0;
    let upcoming = 0;
    let overdue = 0;

    for (const d of devices) {
      const seenAt = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
      if (now - seenAt < TEN_MIN) active++;

      const h = hourmeterH(d.lastHourmeterMin) ?? 0;
      totalH += h;

      const limit = d.serviceLimitHours;
      if (limit) {
        if (h >= limit) overdue++;
        else if (h >= limit - 50) upcoming++;
      }
    }

    return { active, totalH, upcoming, overdue };
  }, [devices]);

  const s = styles(colors, insets);

  const renderItem = ({ item: d }: { item: (typeof devices)[0] }) => {
    const hours = hourmeterH(d.lastHourmeterMin);
    const limit = d.serviceLimitHours;
    const sc = statusColor(hours, limit, colors);
    const now = Date.now();
    const seenMs = d.lastSeenAt ? now - new Date(d.lastSeenAt).getTime() : null;
    const isActive = seenMs != null && seenMs < TEN_MIN;
    const seenLabel =
      seenMs == null
        ? "Nunca"
        : seenMs < 60_000
        ? "Agora"
        : seenMs < 3_600_000
        ? `${Math.floor(seenMs / 60_000)}min`
        : seenMs < 86_400_000
        ? `${Math.floor(seenMs / 3_600_000)}h`
        : `${Math.floor(seenMs / 86_400_000)}d`;

    const pct = hours != null && limit ? Math.min((hours / limit) * 100, 100) : null;
    const barColor = statusColor(hours, limit, colors);

    return (
      <Pressable
        style={({ pressed }) => [s.row, pressed && s.rowPressed]}
        onPress={() => router.push(`/machine/${d.id}`)}
      >
        <View style={s.rowLeft}>
          <View style={[s.statusDot, { backgroundColor: isActive ? colors.success : colors.mutedForeground }]} />
          <View style={s.rowInfo}>
            <Text style={s.rowName} numberOfLines={1}>
              {d.displayName || d.id}
            </Text>
            <Text style={s.rowSub} numberOfLines={1}>
              {d.machineModel || d.model} · Visto {seenLabel} atrás
            </Text>
            {pct != null && (
              <View style={s.barWrap}>
                <View style={[s.barFill, { width: `${pct}%` as never, backgroundColor: barColor }]} />
              </View>
            )}
          </View>
        </View>
        <View style={s.rowRight}>
          {hours != null ? (
            <>
              <Text style={[s.hours, { color: sc }]}>{hours.toLocaleString("pt-BR")}h</Text>
              {limit && (
                <Text style={[s.limit, { color: colors.mutedForeground }]}>
                  / {limit}h
                </Text>
              )}
            </>
          ) : (
            <Text style={[s.hours, { color: colors.mutedForeground }]}>—</Text>
          )}
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Frota</Text>
          <Text style={s.headerSub}>{devices.length} equipamentos</Text>
        </View>
        <Pressable onPress={() => refetch()} hitSlop={8}>
          <Feather name="refresh-cw" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* KPI row */}
      <View style={s.kpiRow}>
        <KpiCard
          label="Ativos"
          value={kpis.active}
          icon="activity"
          accent={colors.success}
          colors={colors}
        />
        <KpiCard
          label="Horas Total"
          value={`${kpis.totalH.toLocaleString("pt-BR")}h`}
          icon="clock"
          accent={colors.primary}
          colors={colors}
        />
        <KpiCard
          label="Revisão"
          value={kpis.overdue > 0 ? `${kpis.overdue} atras.` : kpis.upcoming > 0 ? `${kpis.upcoming} próx.` : "—"}
          icon="tool"
          accent={kpis.overdue > 0 ? colors.danger : kpis.upcoming > 0 ? colors.warning : colors.mutedForeground}
          colors={colors}
        />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[s.centerText, { color: colors.mutedForeground }]}>
            Carregando frota…
          </Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[s.centerText, { color: colors.mutedForeground }]}>
                Nenhum equipamento encontrado
              </Text>
            </View>
          }
          scrollEnabled={devices.length > 0}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = (
  colors: ReturnType<typeof useColors>,
  insets: ReturnType<typeof useSafeAreaInsets>
) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop:
        Platform.OS === "web" ? 67 : insets.top + 12,
      paddingBottom: 12,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    headerSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    kpiRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: insets.bottom + 90,
      gap: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 12,
    },
    rowPressed: {
      opacity: 0.75,
    },
    rowLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    rowInfo: {
      flex: 1,
      gap: 2,
    },
    rowName: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    rowSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    barWrap: {
      height: 3,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginTop: 4,
      overflow: "hidden",
    },
    barFill: {
      height: 3,
      borderRadius: 2,
    },
    rowRight: {
      alignItems: "flex-end",
      gap: 2,
    },
    hours: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
    limit: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 60,
    },
    centerText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
  });
