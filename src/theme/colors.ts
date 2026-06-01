export const Colors = {
  dark: {
    background: '#1e1e1e',
    surface: '#252526',
    surfaceHighlight: '#2d2d30',
    border: '#3e3e42',
    text: '#cccccc',
    textSecondary: '#858585',
    textDisabled: '#565656',
    accent: '#007acc',
    success: '#4ec9b0',
    warning: '#dcdcaa',
    danger: '#f44747',
    tabBar: '#1f1f1f',
    tabBarBorder: '#3e3e42',
    headerBackground: '#252526',
    headerBorder: '#3e3e42',
  },
  light: {
    background: '#f5f5f5',
    surface: '#ffffff',
    surfaceHighlight: '#ebebeb',
    border: '#e0e0e0',
    text: '#1e1e1e',
    textSecondary: '#6b6b6b',
    textDisabled: '#a0a0a0',
    accent: '#007acc',
    success: '#16825d',
    warning: '#7a6300',
    danger: '#d4000d',
    tabBar: '#f5f5f5',
    tabBarBorder: '#e0e0e0',
    headerBackground: '#ffffff',
    headerBorder: '#e0e0e0',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ColorToken = keyof typeof Colors.dark;
