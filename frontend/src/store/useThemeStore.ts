import { create } from 'zustand';

const THEME_STORAGE_KEY = 'pluto_theme';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const getInitialTheme = (): Theme => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch { /* storage unavailable */ }
  return 'light';
};

const applyThemeClass = (theme: Theme) => {
  if (typeof document !== 'undefined') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

// Apply on store creation / app load
const initialTheme = getInitialTheme();
applyThemeClass(initialTheme);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,

  toggleTheme: () => {
    set((state) => {
      const nextTheme: Theme = state.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch { /* storage unavailable */ }
      applyThemeClass(nextTheme);
      return { theme: nextTheme };
    });
  },

  setTheme: (newTheme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch { /* storage unavailable */ }
    applyThemeClass(newTheme);
    set({ theme: newTheme });
  }
}));

export default useThemeStore;
