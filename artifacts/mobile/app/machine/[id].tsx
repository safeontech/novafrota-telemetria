import { Feather } from "@expo/vector-icons";
import { getGetDeviceQueryKey, useGetDevice } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function hourmeterH(min: number | null | undefined) {
  if (min == null) return null;
  return Math.floor(min / 60);
}

function fmtTs(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[badgeS.wrap, { backgroundColor: bg }]}>
      <Text style={[badgeS.text, { color }]}>{label}</Text>
    </View>
  );
}

const badgeS = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

export default function MachineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: device, isLoading, error } = useGetDevice(id ?? "", {
    query: {
      queryKey: getGetDeviceQueryKey(id ?? ""),
      enabled: !!id,
    },
  });

  const s = styles(colors, insets);

  if (isLoading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[s.centerText, { color: colors.mutedForeground }]}>
          Carregando…
        </Text>
      </View>
    );
  }

  if (error || !device) {
    return (
      <View style={[s.root, s.center]}>
        <Feather name="alert-triangle" size={36} color={colors.danger} />
        <Text style={[s.centerText, { color: colors.foreground }]}>
          Equipamento não encontrado
        </Text>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
            Voltar
          </Text>
        </Pressable>
      </View>
    );
  }

  const hours = hourmeterH(device.lastHourmeterMin);
  const limit = device.serviceLimitHours;

  const pct = hours != null && limit ? Math.min((hours / limit) * 100, 100) : null;
  const remaining = hours != null && limit ? limit - hours : null;

  let barColor = colors.success;
  let statusLabel = "Em dia";
  let statusBg = colors.success + "22";

  if (hours != null && limit != null) {
    if (hours >= limit) {
      barColor = colors.danger;
      statusLabel = "Atrasada";
      statusBg = colors.danger + "22";
    } else if (hours >= limit - 50) {
      barColor = colors.warning;
      statusLabel = `Faltam ${remaining}h`;
      statusBg = colors.warning + "22";
    } else {
      statusLabel = `Faltam ${remaining}h`;
    }
  }

  const now = Date.now();
  const seenMs = device.lastSeenAt
    ? now - new Date(device.lastSeenAt).getTime()
    : null;
  const isActive = seenMs != null && seenMs < 10 * 60 * 1000;

  return (
    <View style={s.root}>
      {/* Back header */}
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.backIcon} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.topTitle} numberOfLines={1}>
          {device.displayName || device.id}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={s.heroCard}>
          <View style={s.heroRow}>
            <View style={s.heroLeft}>
              <Text style={s.heroId}>{device.id}</Text>
              <Text style={s.heroName}>{device.displayName || "—"}</Text>
              <Text style={s.heroModel}>
                {device.machineType || ""} {device.machineModel || device.model}
              </Text>
            </View>
            <View style={s.heroRight}>
              <Badge
                label={isActive ? "Online" : "Offline"}
                color={isActive ? colors.success : colors.mutedForeground}
                bg={isActive ? colors.success + "22" : colors.muted}
              />
              <Badge
                label={statusLabel}
                color={barColor}
                bg={statusBg}
              />
            </View>
          </View>

          {/* Hourmeter progress */}
          {hours != null && (
            <View style={s.meterSection}>
              <View style={s.meterRow}>
                <Text style={s.meterLabel}>Horímetro</Text>
                <Text style={[s.meterVal, { color: barColor }]}>
                  {hours.toLocaleString("pt-BR")}h
                  {limit ? ` / ${limit}h` : ""}
                </Text>
              </View>
              <View style={s.meterBar}>
                <View
                  style={[
                    s.meterFill,
                    {
                      width: `${pct ?? 0}%` as never,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
              {pct != null && (
                <Text style={[s.meterPct, { color: colors.mutedForeground }]}>
                  {Math.round(pct)}% do limite de revisão
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Telemetry section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Telemetria</Text>
          <View style={s.infoCard}>
            <InfoRow
              icon="navigation"
              label="Velocidade"
              value={
                device.lastSpeedKmh != null
                  ? `${device.lastSpeedKmh} km/h`
                  : "—"
              }
              colors={colors}
            />
            <Div colors={colors} />
            <InfoRow
              icon="zap"
              label="Ignição"
              value={
                device.lastIgnition == null
                  ? "—"
                  : device.lastIgnition
                  ? "Ligada"
                  : "Desligada"
              }
              valueColor={
                device.lastIgnition == null
                  ? colors.mutedForeground
                  : device.lastIgnition
                  ? colors.success
                  : colors.danger
              }
              colors={colors}
            />
            <Div colors={colors} />
            <InfoRow
              icon="map-pin"
              label="Posição"
              value={
                device.lastLat != null && device.lastLon != null
                  ? `${device.lastLat.toFixed(5)}, ${device.lastLon.toFixed(5)}`
                  : "Sem GPS"
              }
              colors={colors}
            />
            <Div colors={colors} />
            <InfoRow
              icon="activity"
              label="Odômetro"
              value={
                device.lastOdometerM != null
                  ? `${(device.lastOdometerM / 1000).toFixed(1)} km`
                  : "—"
              }
              colors={colors}
            />
          </View>
        </View>

        {/* Connectivity section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Conectividade</Text>
          <View style={s.infoCard}>
            <InfoRow
              icon="clock"
              label="Último contato"
              value={fmtTs(device.lastSeenAt)}
              colors={colors}
            />
            <Div colors={colors} />
            <InfoRow
              icon="radio"
              label="Transporte"
              value={device.lastTransport?.toUpperCase() ?? "—"}
              colors={colors}
            />
            <Div colors={colors} />
            <InfoRow
              icon="wifi"
              label="Peer"
              value={device.lastPeer ?? "—"}
              colors={colors}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={infoS.row}>
      <View style={[infoS.iconWrap, { backgroundColor: colors.muted }]}>
        <Feather name={icon as never} size={15} color={colors.mutedForeground} />
      </View>
      <Text style={[infoS.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          infoS.value,
          { color: valueColor ?? colors.foreground },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function Div({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 52 }} />
  );
}

const infoS = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  value: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 180,
    textAlign: "right",
  },
});

const styles = (
  colors: ReturnType<typeof useColors>,
  insets: ReturnType<typeof useSafeAreaInsets>
) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
      paddingBottom: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backIcon: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 17,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    scroll: {
      padding: 16,
      gap: 20,
      paddingBottom: insets.bottom + 40,
    },
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius * 1.5,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 16,
    },
    heroRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    heroLeft: {
      flex: 1,
      gap: 4,
    },
    heroRight: {
      gap: 8,
      alignItems: "flex-end",
    },
    heroId: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    heroName: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    heroModel: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    meterSection: {
      gap: 8,
    },
    meterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    meterLabel: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    meterVal: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
    },
    meterBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: "hidden",
    },
    meterFill: {
      height: 8,
      borderRadius: 4,
    },
    meterPct: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1,
      paddingHorizontal: 4,
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    center: {
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    centerText: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    backBtn: {
      padding: 12,
    },
  });
