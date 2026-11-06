import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/ui/kit/avatar';
import { radius, space, themed, useTheme } from '@/ui/theme';

export type Contact = {
  id: string;
  name: string;
};

const AVATAR = 48;
export const CONTACT_STRIP_HEIGHT = AVATAR + space.s3 * 2 + 2;

export function ContactStrip({
  contacts,
  selected,
  onToggle,
}: {
  contacts: readonly Contact[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const { color } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.card}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {contacts.map((contact) => {
          const on = selected.has(contact.id);
          return (
            <Pressable
              key={contact.id}
              accessibilityRole="togglebutton"
              accessibilityLabel={contact.name}
              accessibilityState={{ checked: on }}
              onPress={() => onToggle(contact.id)}
              style={[styles.face, on ? { boxShadow: `0 0 0 2px ${color.accent}` } : null]}
            >
              <Avatar name={contact.name} size={AVATAR} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      overflow: 'hidden',
    },
    row: {
      alignItems: 'center',
      gap: space.s3,
      paddingVertical: space.s3,
      paddingHorizontal: space.s3,
    },
    face: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: radius.pill,
    },
  }),
);
