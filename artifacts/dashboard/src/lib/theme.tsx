import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Theme = "dark-navy" | "dark-amber" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark-navy",
  setTheme: () => {},
});

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "theme-amber", "theme-light");
  if (theme === "dark-navy") {
    root.classList.add("dark");
  } else if (theme === "dark-amber") {
    root.classList.add("dark", "theme-amber");
  } else {
    root.classList.add("theme-light");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("mm_theme");
    if (stored === "dark-navy" || stored === "dark-amber" || stored === "light") {
      return stored;
    }
    return "dark-navy";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyTheme(theme);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("mm_theme", t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
