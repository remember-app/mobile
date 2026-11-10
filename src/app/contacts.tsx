import { useRouter } from 'expo-router';
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
import { goBack } from '@/ui/back';
import { ArrowField } from '@/ui/components/arrow-field';
import { InviteCode } from '@/ui/components/invite-code';
import { Person } from '@/ui/components/person';
import { MemberRowsSkeleton } from '@/ui/components/skeletons';
import { SwipeRow } from '@/ui/components/swipe-row';
import { useContacts, useSuggestions } from '@/ui/hooks';
import { AppBar, Board, pageBody } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { BackButton } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { Text } from '@/ui/kit/text';
import { space, themed } from '@/ui/theme';

export default function ContactsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useStyles();
  const contactsState = useContacts();
  const suggestionsState = useSuggestions();
  const contacts = contactsState.contacts;
  const loading = contactsState.status === 'loading';
  const [username, setUsername] = useState('');
  const [invite, setInvite] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const clean = username.trim();

  useEffect(() => {
    void loadContacts();
    void loadSuggestions();
    void createAppInvite()
      .then((app) => setInvite(app.token))
      .catch(() => setInviteError(t('contacts.inviteError')));
  }, [t]);

  const add = async () => {
    if (!clean) return;
    await addContact(clean);
    setUsername('');
    void loadSuggestions(true);
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
        <AppBar
          title={t('contacts.title')}
          left={<BackButton label={t('action.back')} onPress={() => goBack(router)} />}
        />
      }
    >
      <ArrowField
        label={t('contacts.nick')}
        value={username}
        onChangeText={setUsername}
        placeholder={t('contacts.nick')}
        prefix="@"
        valid={Boolean(clean)}
        onSubmit={() => void add()}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Card>
        {invite ? (
          <InviteCode token={invite} />
        ) : (
          <Text role="noteSm" tone={inviteError ? 'danger' : 'muted'}>
            {inviteError ?? t('state.loading')}
          </Text>
        )}
      </Card>

      {loading ? (
        <MemberRowsSkeleton rows={4} />
      ) : (
        <Card clip>
          {contacts.map((contact, index) => (
            <View key={contact.userId}>
              {index > 0 ? <Divider /> : null}
              <SwipeRow
                tone="danger"
                icon={Trash2}
                onAction={() => void removeContact(contact.userId)}
              >
                <Person
                  name={contact.name ?? ''}
                  username={contact.username ?? ''}
                  style={styles.contact}
                />
              </SwipeRow>
            </View>
          ))}
          {contacts.length === 0 ? (
            <Text role="note" tone="muted" style={styles.empty}>
              {t('contacts.empty')}
            </Text>
          ) : null}
        </Card>
      )}

      {!loading && suggestions.length > 0 ? (
        <>
          <Text role="eyebrow" tone="muted">
            {t('contacts.suggestions')}
          </Text>
          <Card clip>
            {suggestions.map((suggestion, index) => (
              <View key={suggestion.id}>
                {index > 0 ? <Divider /> : null}
                <SwipeRow
                  tone="accent"
                  icon={Plus}
                  onAction={() => void addSuggestion(suggestion.username)}
                >
                  <Person
                    name={suggestion.name ?? ''}
                    username={suggestion.username ?? ''}
                    style={styles.contact}
                  />
                </SwipeRow>
              </View>
            ))}
          </Card>
        </>
      ) : null}
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
    empty: {
      paddingVertical: space.s5,
      paddingHorizontal: space.s4,
      textAlign: 'center',
    },
  }),
);
