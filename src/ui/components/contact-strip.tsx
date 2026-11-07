import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Avatar } from '@/ui/kit/avatar';
import { Card } from '@/ui/kit/card';
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
    <Card clip>
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
    </Card>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    row: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
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
