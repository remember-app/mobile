import { useRouter } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { ArrowField } from '@/ui/components/arrow-field';
import { SwipeRow } from '@/ui/components/swipe-row';
import { Avatar } from '@/ui/kit/avatar';
import { AppBar, Board } from '@/ui/kit/bars';
import { Divider } from '@/ui/kit/bits';
import { BackButton } from '@/ui/kit/button';
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
import { radius, space, themed } from '@/ui/theme';

export default function ContactsScreen() {
  const router = useRouter();
  const styles = useStyles();
  const contacts = useSyncExternalStore(subscribeContacts, contactsState);
  const suggestions = useSyncExternalStore(subscribeSuggestions, suggestionsState);
  const [username, setUsername] = useState('');
  const clean = username.trim();

  const add = () => {
    addContact(username);
    setUsername('');
  };

  return (
    <Board
      body={styles.body}
      bar={
        <AppBar
          title="Контакты"
          left={<BackButton label="Назад" onPress={() => router.back()} />}
        />
      }
    >
      <ArrowField
        label="Ник"
        value={username}
        onChangeText={setUsername}
        placeholder="Ник"
        prefix="@"
        valid={Boolean(clean)}
        onSubmit={add}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.card}>
        {contacts.map((contact, index) => (
          <View key={contact.id}>
            {index > 0 ? <Divider /> : null}
            <SwipeRow tone="danger" icon={Trash2} onAction={() => removeContact(contact.id)}>
              <View style={styles.contact}>
                <Avatar name={contact.name} size={40} />
                <View style={styles.words}>
                  <View style={styles.nameRow}>
                    <Text role="row" numberOfLines={1} style={styles.name}>
                      {contact.name}
                    </Text>
                    <Text role="noteSm" tone="muted" numberOfLines={1} style={styles.nick}>
                      {`@${contact.username}`}
                    </Text>
                  </View>
                </View>
              </View>
            </SwipeRow>
          </View>
        ))}
        {contacts.length === 0 ? (
          <Text role="note" tone="muted" style={styles.empty}>
            Пока никого нет
          </Text>
        ) : null}
      </View>

      {suggestions.length > 0 ? (
        <>
          <Text role="eyebrow" tone="muted">
            Возможно, знакомы
          </Text>
          <View style={styles.card}>
            {suggestions.map((contact, index) => (
              <View key={contact.id}>
                {index > 0 ? <Divider /> : null}
                <SwipeRow tone="accent" icon={Plus} onAction={() => acceptSuggestion(contact.id)}>
                  <View style={styles.contact}>
                    <Avatar name={contact.name} size={40} />
                    <View style={styles.words}>
                      <View style={styles.nameRow}>
                        <Text role="row" numberOfLines={1} style={styles.name}>
                          {contact.name}
                        </Text>
                        <Text role="noteSm" tone="muted" numberOfLines={1} style={styles.nick}>
                          {`@${contact.username}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                </SwipeRow>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Board>
  );
}

const useStyles = themed(({ color }) =>
  StyleSheet.create({
    body: {
      paddingHorizontal: space.s5,
      paddingTop: space.s5,
      paddingBottom: space.s7,
      gap: space.s4,
    },
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: color.line,
      overflow: 'hidden',
    },
    contact: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
      backgroundColor: color.surface,
    },
    words: {
      flex: 1,
      gap: 2,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    name: {
      flexShrink: 1,
    },
    nick: {
      flexShrink: 1,
    },
    empty: {
      paddingVertical: space.s5,
      paddingHorizontal: space.s4,
      textAlign: 'center',
    },
  }),
);
