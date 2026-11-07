import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { addMember, loadContacts, loadInvite } from '@/functionality';
import type { ProjectId } from '@/types/id';
import { CONTACT_STRIP_HEIGHT, ContactStrip } from '@/ui/components/contact-strip';
import { InviteCode } from '@/ui/components/invite-code';
import { useContacts, useInvite, useMembers } from '@/ui/hooks';
import { Card } from '@/ui/kit/card';
import { Text } from '@/ui/kit/text';
import { space, themed } from '@/ui/theme';

const NONE: ReadonlySet<string> = new Set();

export function InviteBlocks({
  projectId,
  projectTitle,
}: {
  projectId: ProjectId;
  projectTitle: string;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  const contacts = useContacts();
  const members = useMembers(projectId);
  const invite = useInvite(projectId);
  const token = invite.invite?.token ?? '';

  useEffect(() => {
    void loadContacts();
    void loadInvite(projectId).catch(() => undefined);
  }, [projectId]);

  const taken = new Set(members.members.map((member) => member.userId));
  const available = contacts.contacts.filter((contact) => !taken.has(contact.userId));

  const inviteContact = (userId: string) => {
    const contact = available.find((entry) => entry.userId === userId);
    if (contact?.username) void addMember(projectId, contact.username, 'contributor');
  };

  return (
    <View style={styles.blocks}>
      {available.length > 0 ? (
        <ContactStrip
          contacts={available.map((contact) => ({
            id: contact.userId,
            name: contact.name ?? contact.username ?? '',
          }))}
          selected={NONE}
          onToggle={inviteContact}
        />
      ) : (
        <Card style={styles.emptyCard}>
          <Text role="noteSm" tone="muted">
            {contacts.contacts.length === 0 ? t('invite.noContacts') : t('invite.allInvited')}
          </Text>
        </Card>
      )}
      <Card clip>
        <InviteCode token={token} title={projectTitle} height={CONTACT_STRIP_HEIGHT} />
      </Card>
    </View>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    blocks: {
      gap: space.s3,
    },
    emptyCard: {
      minHeight: CONTACT_STRIP_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.s3,
    },
  }),
);
