import { StyleSheet, Switch, View } from 'react-native';

import { space, useTheme } from '@/theme';

import { Text } from './text';

export type ToggleProps = {
  /** The word beside it — and its own name, because a switch says nothing on its own. */
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/**
 * The one boolean the kit has no shape for. Section 15 answers a choice with the segment and says so
 * about the platform's `Switch` — «which is neither of the two lights nor any of the kit's shapes» —
 * but a thing that is simply on or off is not a choice between values, so the phone's own switch
 * stands, wearing the kit's colours: ember while it is on, hairline while it is off, paper for the
 * grip, and the label at the other end of the row.
 *
 * Here and not on the screens because it was on two of them, spelled out the same way twice
 * (TASK-56) — and one of those four colour props is the kind nobody notices missing: `switch.d.ts`
 * has the why, and it is the reason a second copy is worse than a component.
 */
export function Toggle({ label, value, onValueChange, disabled }: ToggleProps) {
  const { color } = useTheme();

  return (
    <View style={styles.toggle}>
      <Text role="label">{label}</Text>
      <Switch
        // The words beside it are a sibling, and React Native joins nothing up on its own —
        // without this the switch is announced with no name at all.
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: color.line, true: color.ember }}
        thumbColor={color.paper}
        // The same paper again, for the half of the web switch `thumbColor` does not reach:
        // switch.d.ts has the why.
        activeThumbColor={color.paper}
        ios_backgroundColor={color.line}
      />
    </View>
  );
}

// Shape only: every colour this draws is the switch's own prop, not a style.
const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
});
