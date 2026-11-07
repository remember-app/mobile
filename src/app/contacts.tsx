import { useRouter } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ArrowField } from '@/ui/components/arrow-field';
import { Person } from '@/ui/components/person';
import { MemberRowsSkeleton } from '@/ui/components/skeletons';
import { SwipeRow } from '@/ui/components/swipe-row';
import { AppBar, Board, pageBody } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { BackButton } from '@/ui/kit/button';
import { Card } from '@/ui/kit/card';
import { Text } from '@/ui/kit/text';
import {
  acceptSuggestion,
  addContact,
  contactsState,
  removeContact,
  subscribeContacts,
  subscribeSuggestions,
  suggestionsState,
} from '@/ui/mocks/contacts';
import { loadingState, subscribeLoading } from '@/ui/mocks/loading';
import { space, themed } from '@/ui/theme';

export default function ContactsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useStyles();
  const contacts = useSyncExternalStore(subscribeContacts, contactsState);
  const suggestions = useSyncExternalStore(subscribeSuggestions, suggestionsState);
  const loading = useSyncExternalStore(subscribeLoading, loadingState);
  const [username, setUsername] = useState('');
  const clean = username.trim();

  const add = () => {
    addContact(username);
    setUsername('');
  };

  return (
    <Board
      body={pageBody}
      bar={
        <AppBar
          title={t('contacts.title')}
          left={<BackButton label={t('action.back')} onPress={() => router.back()} />}
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
        onSubmit={add}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading ? (
        <MemberRowsSkeleton rows={4} />
      ) : (
        <Card clip>
          {contacts.map((contact, index) => (
            <View key={contact.id}>
              {index > 0 ? <Divider /> : null}
              <SwipeRow tone="danger" icon={Trash2} onAction={() => removeContact(contact.id)}>
                <Person name={contact.name} username={contact.username} style={styles.contact} />
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
            {suggestions.map((contact, index) => (
              <View key={contact.id}>
                {index > 0 ? <Divider /> : null}
                <SwipeRow tone="accent" icon={Plus} onAction={() => acceptSuggestion(contact.id)}>
                  <Person name={contact.name} username={contact.username} style={styles.contact} />
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
