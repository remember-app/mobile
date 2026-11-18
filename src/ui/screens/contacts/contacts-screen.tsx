import { Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import {
  addContact,
  createAppInvite,
  loadContacts,
  loadSuggestions,
  removeContact,
} from '@/functionality';
import { SwipeRow } from '@/ui/components/common/swipe-row';
import { LoadError } from '@/ui/components/feedback/load-error';
import { MemberRowsSkeleton } from '@/ui/components/feedback/skeletons';
import { ArrowField } from '@/ui/components/forms/arrow-field';
import { Person } from '@/ui/components/people/person';
import { InviteCode } from '@/ui/components/project/invite-code';
import { confirmAction } from '@/ui/confirm';
import { useContacts, useSuggestions } from '@/ui/hooks';
import { Board, pageBody } from '@/ui/kit/chrome/bars';
import { BottomSheet } from '@/ui/kit/chrome/bottom-sheet';
import { IconButton } from '@/ui/kit/controls/button';
import { Rows } from '@/ui/kit/primitives/bits';
import { Card } from '@/ui/kit/primitives/card';
import { Text } from '@/ui/kit/primitives/text';
import { BackBar } from '@/ui/screens/chrome';
import { space, themed } from '@/ui/theme';

export default function ContactsScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const contactsState = useContacts();
  const suggestionsState = useSuggestions();
  const contacts = contactsState.contacts;
  const loading = contactsState.status === 'loading';
  const [username, setUsername] = useState('');
  const [invite, setInvite] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const clean = username.trim();

  useEffect(() => {
    void loadContacts();
    void loadSuggestions();
    void createAppInvite()
      .then((app) => setInvite(app.token))
      .catch(() => setInviteError(t('contacts.inviteError')));
  }, [t]);

  const add = async () => {
    if (!clean || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await addContact(clean);
      setUsername('');
      setOpen(false);
      void loadSuggestions(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const addSuggestion = async (handle: string | null) => {
    if (!handle) return;
    await addContact(handle);
    void loadSuggestions(true);
  };

  const known = new Set(contacts.map((contact) => contact.userId));
  const suggestions = suggestionsState.items.filter(
    (suggestion) => !known.has(suggestion.id) && suggestion.username !== null,
  );

  return (
    <Board
      body={pageBody}
      bar={
        <BackBar
          title={t('contacts.title')}
          right={
            <IconButton
              icon={Plus}
              label={t('contacts.add')}
              tone="surface"
              size={44}
              onPress={() => setOpen(true)}
            />
          }
        />
      }
    >
      {loading ? (
        <MemberRowsSkeleton rows={4} />
      ) : contactsState.status === 'error' && contacts.length === 0 ? (
        <LoadError onRetry={() => void loadContacts(true)} />
      ) : (
        <Card clip>
          <Rows items={contacts} keyOf={(contact) => contact.userId}>
            {(contact) => (
              <SwipeRow
                tone="danger"
                icon={Trash2}
                onAction={() =>
                  confirmAction({
                    confirm: t('action.delete'),
                    destructive: true,
                    onConfirm: () => void removeContact(contact.userId),
                  })
                }
              >
                <Person
                  name={contact.name ?? ''}
                  username={contact.username ?? ''}
                  uri={contact.avatarUrl}
                  style={styles.contact}
                />
              </SwipeRow>
            )}
          </Rows>
        </Card>
      )}

      {!loading && suggestions.length > 0 ? (
        <>
          <Text role="eyebrow" tone="muted">
            {t('contacts.suggestions')}
          </Text>
          <Card clip>
            <Rows items={suggestions} keyOf={(suggestion) => suggestion.id}>
              {(suggestion) => (
                <SwipeRow
                  tone="accent"
                  icon={Plus}
                  onAction={() => void addSuggestion(suggestion.username)}
                >
                  <Person
                    name={suggestion.name ?? ''}
                    username={suggestion.username ?? ''}
                    uri={suggestion.avatarUrl}
                    style={styles.contact}
                  />
                </SwipeRow>
              )}
            </Rows>
          </Card>
        </>
      ) : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <View style={styles.form}>
          <ArrowField
            label={t('contacts.nick')}
            value={username}
            onChangeText={setUsername}
            placeholder={t('contacts.nick')}
            prefix="@"
            valid={Boolean(clean)}
            busy={busy}
            onSubmit={() => void add()}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {failed ? (
            <Text role="hint" tone="danger">
              {t('common.saveFailed')}
            </Text>
          ) : null}
          <Card>
            {invite ? (
              <InviteCode token={invite} />
            ) : (
              <Text role="noteSm" tone={inviteError ? 'danger' : 'muted'}>
                {inviteError ?? t('state.loading')}
              </Text>
            )}
          </Card>
        </View>
      </BottomSheet>
    </Board>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    contact: {
      minHeight: 60,
      paddingHorizontal: space.s4,
      backgroundColor: color.surface,
    },
    form: {
      gap: space.s4,
    },
  }),
);
