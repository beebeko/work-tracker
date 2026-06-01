import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  caption: { fontSize: 11, lineHeight: 16 },
  label: { fontSize: 12, lineHeight: 18 },
  body: { fontSize: 14, lineHeight: 20 },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
};
