import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { router, Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    }
  }, [token, isLoading]);

  if (isLoading || !token) return null;
  return <>{children}</>;
}

function NativeTabLayout() {
  return (
    <AuthGuard>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <Icon sf={{ default: "antenna.radiowaves.left.and.right", selected: "antenna.radiowaves.left.and.right.circle.fill" }} />
          <Label>Frota</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
          <Label>Configs</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </AuthGuard>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            elevation: 0,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : isWeb ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: colors.background },
                ]}
              />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Frota",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView
                  name="antenna.radiowaves.left.and.right"
                  tintColor={color}
                  size={24}
                />
              ) : (
                <Feather name="radio" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Configs",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView
                  name="gearshape"
                  tintColor={color}
                  size={24}
                />
              ) : (
                <Feather name="settings" size={22} color={color} />
              ),
          }}
        />
      </Tabs>
    </AuthGuard>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
