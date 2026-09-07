import type { ColorValue } from 'react-native';

/**
 * `thumbColor` alone does not colour a switch that is on. `react-native-web` reads the grip from
 * `activeThumbColor` whenever `value` is true and falls back to `thumbColor` only when it is false
 * (`react-native-web/dist/exports/Switch/index.js`, `thumbCurrentColor`), so a switch handed the
 * kit's colours draws paper while off and the library's own Material teal `#009688` the moment it
 * is turned on — a colour no theme here has. Whether that shows up is nothing to do with which
 * screen the switch is on; it is only whether it happens to start on.
 *
 * The prop is web's own and missing from React Native's types. On a phone it rides along with the
 * rest of the props to the native switch, which has no such thing and ignores it.
 *
 * Augments the module that declares `SwitchProps`; `'react-native'` only re-exports it.
 */
declare module 'react-native/Libraries/Components/Switch/Switch' {
  interface SwitchProps {
    /** Colour of the grip while the switch is on. Web only — set it wherever `thumbColor` is set. */
    activeThumbColor?: ColorValue | undefined;
  }
}
