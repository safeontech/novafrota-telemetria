import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  const handleLogout = () => {
    if (Platform.OS === "web") {
      logout().then(() => router.replace("/login"));
      return;
    }
    Alert.alert("Sair", "Deseja encerrar a sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => logout().then(() => router.replace("/login")),
      },
    ]);
  };

  const s = styles(colors, insets);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Configurações</Text>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Plataforma</Text>
        <View style={s.card}>
          <Row
            icon="cpu"
            label="NOVAFROTA Telemetria"
            value="v1.0"
            colors={colors}
          />
          <Divider colors={colors} />
          <Row
            icon="server"
            label="API"
            value={process.env.EXPO_PUBLIC_DOMAIN ?? "local"}
            colors={colors}
          />
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Sessão</Text>
        <View style={s.card}>
          <Pressable
            style={({ pressed }) => [s.rowBtn, pressed && { opacity: 0.7 }]}
            onPress={handleLogout}
          >
            <View style={[s.iconWrap, { backgroundColor: colors.danger + "22" }]}>
              <Feather name="log-out" size={18} color={colors.danger} />
            </View>
            <Text style={[s.rowLabel, { color: colors.danger }]}>
              Encerrar sessão
            </Text>
            <Feather name="chevron-right" size={16} color={colors.danger} />
          </Pressable>
        </View>
      </View>

      <Text style={s.footer}>
        NOVAFROTA Telemetria · {new Date().getFullYear()}
      </Text>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={rowS.wrap}>
      <View style={[rowS.iconWrap, { backgroundColor: colors.muted }]}>
        <Feather name={icon as never} size={16} color={colors.mutedForeground} />
      </View>
      <Text style={[rowS.label, { color: colors.foreground }]}>{label}</Text>
      <Text style={[rowS.value, { color: colors.mutedForeground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 52 }} />
  );
}

const rowS = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  value: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    maxWidth: 140,
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
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 12,
      paddingBottom: 12,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    section: {
      paddingHorizontal: 16,
      paddingTop: 24,
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
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    rowBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    rowLabel: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
    footer: {
      textAlign: "center",
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: "auto",
      paddingBottom: insets.bottom + 20,
    },
  });
