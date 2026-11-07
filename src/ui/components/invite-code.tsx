import { Copy, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { copyInviteLink, shareInviteLink } from '@/functionality';
import { IconButton } from '@/ui/kit/button';
import { Text } from '@/ui/kit/text';
import { space, themed } from '@/ui/theme';

export function InviteCode({
  token,
  title,
  height = 60,
}: {
  token: string;
  title?: string;
  height?: number;
}) {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={[styles.row, { minHeight: height }]}>
      <Text role="title" numberOfLines={1} style={styles.code}>
        {token}
      </Text>
      <View style={styles.actions}>
        <IconButton
          icon={Copy}
          label={t('invite.copy')}
          tone="ghost"
          size={44}
          disabled={!token}
          onPress={() => token && void copyInviteLink(token)}
        />
        <IconButton
          icon={Share2}
          label={t('invite.share')}
          tone="ghost"
          size={44}
          disabled={!token}
          onPress={() => token && void shareInviteLink(token, title)}
        />
      </View>
    </View>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      paddingHorizontal: space.s4,
    },
    code: {
      flex: 1,
      textAlign: 'center',
      letterSpacing: 8,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s1,
    },
  }),
);
