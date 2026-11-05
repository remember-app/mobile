export type Color = {
  ink: string;
  surface: string;
  raise: string;
  raiseSoft: string;
  line: string;
  lineStrong: string;
  lineQuiet: string;
  paper: string;
  muted: string;
  faint: string;
  quote: string;
  dayOff: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  accentNote: string;
  accentEdge: string;
  plateEdge: string;
  spark: string;
  sparkInk: string;
  danger: string;
  dangerText: string;
  dangerTextSoft: string;
  dangerFill: string;
  onFill: string;
  dashed: string;
  hollow: string;
  hollowSoft: string;
  handle: string;
  coverBase: string;
  stripEmpty: string;
  stripSign: string;
  dangerSoft: string;
  dangerEdge: string;
  bannerSoft: string;
  bannerEdge: string;
  failedSoft: string;
  pendingSoft: string;
  sparkSoft: string;
  sparkEdge: string;
};
const dark: Color = {
  ink: '#0B0B12',
  surface: '#16161F',
  raise: '#22222E',
  raiseSoft: '#1A1A24',
  line: '#2C2C3A',
  lineStrong: '#45424F',
  lineQuiet: '#3A3747',
  paper: '#F5F3EE',
  muted: '#A4A1B2',
  faint: '#6E6B7D',
  quote: '#D8D5E0',
  dayOff: '#4A4757',
  accent: '#4B5BFF',
  accentText: '#A7AEFF',
  accentSoft: '#1A1C33',
  accentNote: '#14152A',
  accentEdge: 'rgba(75,91,255,0.35)',
  plateEdge: 'rgba(75,91,255,0.50)',
  spark: '#E4FF4F',
  sparkInk: '#14160A',
  danger: '#FF5A5A',
  dangerText: '#FF8D8D',
  dangerTextSoft: 'rgba(255,141,141,0.12)',
  dangerFill: '#CE3028',
  onFill: '#FFFFFF',
  dashed: '#35333F',
  hollow: '#111119',
  hollowSoft: '#14141C',
  handle: '#3A3747',
  coverBase: '#16161F',
  stripEmpty: '#1D1D28',
  stripSign: '#6E6B7D',
  dangerSoft: 'rgba(206,48,40,0.14)',
  dangerEdge: 'rgba(206,48,40,0.45)',
  bannerSoft: 'rgba(206,48,40,0.12)',
  bannerEdge: 'rgba(206,48,40,0.40)',
  failedSoft: 'rgba(206,48,40,0.16)',
  pendingSoft: 'rgba(75,91,255,0.22)',
  sparkSoft: 'rgba(228,255,79,0.12)',
  sparkEdge: 'rgba(228,255,79,0.40)',
};
const light: Color = {
  ink: '#F2EFE7',
  surface: '#FFFFFF',
  raise: '#F7F4EC',
  raiseSoft: '#F7F4EC',
  line: '#E4DFD3',
  lineStrong: '#C4BCA8',
  lineQuiet: '#CFC8B8',
  paper: '#15151C',
  muted: '#6C6979',
  faint: '#7A7788',
  quote: '#15151C',
  dayOff: '#B8B7C0',
  accent: '#3B3FE0',
  accentText: '#3B3FE0',
  accentSoft: '#ECEDFB',
  accentNote: '#F3F3FC',
  accentEdge: 'rgba(59,63,224,0.35)',
  plateEdge: 'rgba(59,63,224,0.50)',
  spark: '#DCF531',
  sparkInk: '#16180A',
  danger: '#D93A3A',
  dangerText: '#A82C2C',
  dangerTextSoft: 'rgba(168,44,44,0.12)',
  dangerFill: '#CE3028',
  onFill: '#FFFFFF',
  dashed: '#D3CCBB',
  hollow: '#ECE8DE',
  hollowSoft: '#EFEBE2',
  handle: '#CFC8B8',
  coverBase: '#E8E3D8',
  stripEmpty: '#F7F4EC',
  stripSign: '#8B8778',
  dangerSoft: 'rgba(206,48,40,0.10)',
  dangerEdge: 'rgba(206,48,40,0.45)',
  bannerSoft: 'rgba(206,48,40,0.10)',
  bannerEdge: 'rgba(206,48,40,0.45)',
  failedSoft: 'rgba(206,48,40,0.12)',
  pendingSoft: 'rgba(59,63,224,0.14)',
  sparkSoft: 'rgba(220,245,49,0.28)',
  sparkEdge: 'rgba(200,225,40,0.60)',
};
export type Shadow = {
  card: string;
  cardLarge: string;
  primary: string;
  round: string;
};
const shadow: Record<'dark' | 'light', Shadow> = {
  dark: {
    card: 'none',
    cardLarge: 'none',
    primary: '0 12px 32px rgba(75,91,255,0.38)',
    round: '0 6px 18px rgba(75,91,255,0.40)',
  },
  light: {
    card: '0 2px 10px rgba(28,24,14,0.05)',
    cardLarge: '0 6px 20px rgba(28,24,14,0.10)',
    primary: '0 12px 28px rgba(59,63,224,0.28)',
    round: '0 6px 16px rgba(59,63,224,0.30)',
  },
};
export type ThemeName = 'dark' | 'light';
export type ThemeChoice = ThemeName | 'system';
export type Theme = {
  name: ThemeName;
  color: Color;
  shadow: Shadow;
};
export const themes: Record<ThemeName, Theme> = {
  dark: { name: 'dark', color: dark, shadow: shadow.dark },
  light: { name: 'light', color: light, shadow: shadow.light },
};
export const night: Color = dark;
export const faces = ['#5B4B8A', '#2F5E63', '#7A4B3A', '#3E5A2E', '#5A3E5E', '#3A4A6E'] as const;
export function faceOf(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum = (sum + name.charCodeAt(i)) % 4096;
  return faces[sum % faces.length];
}
export function labelColors({ color }: Theme): readonly string[] {
  return [
    '#FFB547',
    '#FF7A9C',
    '#FF5A5A',
    '#4BD6A0',
    '#4FB3FF',
    '#8A7CFF',
    color.spark,
    color.muted,
  ];
}
