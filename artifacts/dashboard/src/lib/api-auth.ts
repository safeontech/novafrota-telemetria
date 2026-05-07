import { useCallback, useEffect, useState } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const STORAGE_KEY = "navortech.api.token";
const TOKEN_CHANGED_EVENT = "navortech:api-token-changed";

export function getApiToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  } catch {
    return null;
  }
}

export function setApiToken(token: string): void {
  if (typeof window === "undefined") return;
  const trimmed = token.trim();
  if (trimmed === "") {
    clearApiToken();
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, trimmed);
  window.dispatchEvent(new Event(TOKEN_CHANGED_EVENT));
}

export function clearApiToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(TOKEN_CHANGED_EVENT));
}

let installed = false;

/**
 * Wire the generated API client's bearer-token getter to localStorage.
 * Idempotent — safe to call from React Strict Mode double-invocations.
 *
 * Must run before any React Query hook fires; call it from main.tsx.
 */
export function installApiAuth(): void {
  if (installed) return;
  installed = true;
  setAuthTokenGetter(() => getApiToken());
}

/**
 * React hook that exposes the current token (reactive across tabs and
 * across in-page set/clear calls).
 */
export function useApiToken(): {
  token: string | null;
  setToken: (next: string) => void;
  clearToken: () => void;
} {
  const [token, setTokenState] = useState<string | null>(() => getApiToken());

  useEffect(() => {
    function sync() {
      setTokenState(getApiToken());
    }
    window.addEventListener("storage", sync);
    window.addEventListener(TOKEN_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(TOKEN_CHANGED_EVENT, sync);
    };
  }, []);

  const setToken = useCallback((next: string) => {
    setApiToken(next);
  }, []);

  const clearToken = useCallback(() => {
    clearApiToken();
  }, []);

  return { token, setToken, clearToken };
}
