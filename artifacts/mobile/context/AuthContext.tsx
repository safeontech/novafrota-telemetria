import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect, useState } from "react";

const AUTH_KEY = "nf_auth_token";

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  setToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY).then((t) => {
      setTokenState(t);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  const setToken = async (t: string) => {
    await AsyncStorage.setItem(AUTH_KEY, t);
    setTokenState(t);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    setTokenState(null);
  };

  return (
    <AuthContext.Provider value={{ token, isLoading, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
