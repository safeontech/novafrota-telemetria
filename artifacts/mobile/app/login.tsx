import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setToken } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Insira e-mail e senha.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const base = process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "";
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = (await res.json()) as { token?: string; message?: string };
      if (!res.ok || !data.token) {
        setError(data.message ?? "E-mail ou senha incorretos.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      await setToken(data.token);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors, insets);

  return (
    <View style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.kav}
      >
        <View style={s.inner}>
          {/* Brand */}
          <View style={s.brand}>
            <View style={s.logoRow}>
              <View style={s.logoDot} />
              <Text style={s.logoText}>NOVA</Text>
              <Text style={[s.logoText, s.logoTextBlue]}>FROTA</Text>
            </View>
            <Text style={s.tagline}>Plataforma de Telemetria de Frota</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Entrar</Text>
            <Text style={s.cardSub}>
              Acesse a plataforma com suas credenciais
            </Text>

            {/* Email */}
            <View style={s.fieldWrap}>
              <Feather
                name="mail"
                size={16}
                color={colors.mutedForeground}
                style={s.fieldIcon}
              />
              <TextInput
                style={s.input}
                placeholder="seu@email.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError("");
                }}
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View style={s.fieldWrap}>
              <Feather
                name="lock"
                size={16}
                color={colors.mutedForeground}
                style={s.fieldIcon}
              />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Senha"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError("");
                }}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                onPress={() => setShowPassword((p) => !p)}
                hitSlop={8}
                style={s.eyeBtn}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            {!!error && (
              <View style={s.errorRow}>
                <Feather name="alert-circle" size={14} color={colors.danger} />
                <Text style={[s.errorText, { color: colors.danger }]}>
                  {error}
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnText}>Entrar</Text>
              )}
            </Pressable>
          </View>

          <Text style={s.footer}>
            Acesso restrito — NOVAFROTA © {new Date().getFullYear()}
          </Text>
        </View>
      </KeyboardAvoidingView>
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
    kav: {
      flex: 1,
    },
    inner: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingTop: insets.top + 20,
      paddingBottom: insets.bottom + 20,
      gap: 32,
    },
    brand: {
      alignItems: "center",
      gap: 8,
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    logoDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    logoText: {
      fontSize: 34,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: 3,
    },
    logoTextBlue: {
      color: colors.primary,
    },
    tagline: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius * 1.5,
      padding: 24,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    cardSub: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 4,
    },
    fieldWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.muted,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 48,
    },
    fieldIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    eyeBtn: {
      padding: 4,
    },
    errorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    errorText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    btn: {
      height: 50,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    btnPressed: {
      opacity: 0.85,
    },
    btnText: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: "#ffffff",
      letterSpacing: 0.3,
    },
    footer: {
      textAlign: "center",
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
  });
