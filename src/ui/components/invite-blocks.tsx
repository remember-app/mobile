import { Copy, Share2 } from 'lucide-react-native';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { copyInviteLink, shareInviteLink } from '@/functionality';
import { CONTACT_STRIP_HEIGHT, ContactStrip } from '@/ui/components/contact-strip';
import { IconButton } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { contactsState, subscribeContacts } from '@/ui/mocks/contacts';
import { addMember, membersOf, subscribeMembers } from '@/ui/mocks/members';
import { radius, space, themed } from '@/ui/theme';

const NONE: ReadonlySet<string> = new Set();

export function InviteBlocks({
  projectId,
  projectTitle,
}: {
  projectId: string;
  projectTitle: string;
}) {
  const styles = useStyles();
  const contacts = useSyncExternalStore(subscribeContacts, contactsState);
  const getMembers = useCallback(() => membersOf(projectId), [projectId]);
  const members = useSyncExternalStore(subscribeMembers, getMembers);
  const [token] = useState('demo');

  const usernames = new Set(members.map((member) => member.username));
  const available = contacts.filter((contact) => !usernames.has(contact.username));

  const invite = (id: string) => {
    const contact = available.find((entry) => entry.id === id);
    if (contact) addMember(projectId, contact.username);
  };

  return (
    <View style={styles.blocks}>
      {available.length > 0 ? (
        <ContactStrip contacts={available} selected={NONE} onToggle={invite} />
      ) : (
        <View style={styles.emptyCard}>
          <Text role="noteSm" tone="muted">
            {contacts.length === 0
              ? 'У вас пока нет контактов'
              : 'Все ваши контакты уже приглашены'}
          </Text>
        </View>
      )}
      <View style={styles.linkBlock}>
        <View style={styles.codeBox}>
          <Text role="title" numberOfLines={1} style={styles.code}>
            {token}
          </Text>
        </View>
        <View style={styles.actions}>
          <IconButton
            icon={Copy}
            label="Скопировать"
            tone="ghost"
            size={44}
            onPress={() => void copyInviteLink(token)}
          />
          <IconButton
            icon={Share2}
            label="Поделиться"
            tone="ghost"
            size={44}
            onPress={() => void shareInviteLink(token, projectTitle)}
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    blocks: {
      gap: space.s3,
    },
    emptyCard: {
      minHeight: CONTACT_STRIP_HEIGHT,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      backgroundColor: color.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.s3,
    },
    linkBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      backgroundColor: color.raise,
      borderRadius: radius.field,
      padding: space.s2,
    },
    codeBox: {
      flex: 1,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color.surface,
      borderRadius: radius.field,
      borderWidth: 1,
      borderColor: color.line,
      paddingHorizontal: space.s3,
    },
    code: {
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s1,
    },
  }),
);
