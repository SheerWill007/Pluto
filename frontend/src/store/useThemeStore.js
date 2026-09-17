import { create } from 'zustand';

const THEME_STORAGE_KEY = 'atlas_theme';

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {}
  return 'light';
};

const applyThemeClass = (theme) => {
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

export const useThemeStore = create((set) => ({
  theme: initialTheme,

  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {}
      applyThemeClass(nextTheme);
      return { theme: nextTheme };
    });
  },

  setTheme: (newTheme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {}
    applyThemeClass(newTheme);
    set({ theme: newTheme });
  }
}));

export default useThemeStore;
