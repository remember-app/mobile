import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  isUsernameShapeValid,
  loadAvatar,
  setName as saveName,
  setUsername as saveUsername,
  uploadAvatar,
} from '@/functionality';
import { StepDots } from '@/ui/components/onboarding/steps';
import { useAvatar, useSession } from '@/ui/hooks';
import { Avatar } from '@/ui/kit/avatar';
import { Button } from '@/ui/kit/button';
import { Field } from '@/ui/kit/field';
import { Text } from '@/ui/kit/text';
import { space, useTheme } from '@/ui/theme';

export default function UsernameScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const avatar = useAvatar();
  const session = useSession();
  const account = 'account' in session ? session.account : undefined;
  const [username, setUsername] = useState('');
  const [name, setName] = useState(account?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = isUsernameShapeValid(username);

  useEffect(() => {
    void loadAvatar();
  }, []);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
    await uploadAvatar(asset.uri, asset.fileName ?? `avatar.${extension}`).catch(() => undefined);
  };

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await saveUsername(username);
      await saveName(name.trim() || null);
      router.replace({ pathname: '/home', params: { celebrate: username } });
    } catch {
      setError(t('onboarding.username.taken'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: color.ink }]}>
      <Pressable style={styles.fill} onPress={Keyboard.dismiss}>
        <View style={[styles.top, { paddingTop: insets.top + space.s3 }]}>
          <StepDots step={3} total={3} />
        </View>
        <View style={styles.body}>
          <Text role="bodySm" tone="muted">
            {t('onboarding.username.prompt')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.username.avatar')}
            onPress={() => void pick()}
            style={styles.avatar}
          >
            <Avatar name={name.trim() || username} size={88} uri={avatar.url} />
            <View style={[styles.badge, { backgroundColor: color.accent, borderColor: color.ink }]}>
              <Camera size={16} color={color.onFill} />
            </View>
          </Pressable>
          <Field
            label={t('onboarding.username.label')}
            value={username}
            onChangeText={(next) => {
              setUsername(next);
              setError(null);
            }}
            placeholder="nickname"
            prefix="@"
            maxLength={30}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={false}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
          <Field
            label={t('onboarding.username.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('onboarding.username.name')}
            autoCapitalize="words"
            maxLength={200}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
          {error ? (
            <Text role="hint" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
        <View style={styles.space} />
      </Pressable>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.s2 }]}>
        <Button
          label={t('onboarding.username.register')}
          variant="primary"
          disabled={!ready || busy}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  top: {
    paddingHorizontal: space.s5,
    gap: space.s4,
  },
  body: {
    paddingHorizontal: space.s5,
    paddingTop: space.s6,
    gap: space.s3,
  },
  avatar: {
    alignSelf: 'center',
    marginVertical: space.s3,
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  space: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: space.s5,
  },
});
