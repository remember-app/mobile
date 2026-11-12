import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';

import { goBack } from '@/ui/back';
import { AppBar, Board } from '@/ui/kit/bars';
import { BackButton } from '@/ui/kit/button';
import { Empty } from '@/ui/kit/empty';

export function BackBar({
  title,
  right,
  boxed,
  tight,
  style,
}: {
  title: string;
  right?: ReactNode;
  boxed?: boolean;
  tight?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <AppBar
      boxed={boxed}
      tight={tight}
      title={title}
      style={style}
      left={<BackButton label={t('action.back')} onPress={() => goBack(router)} />}
      right={right}
    />
  );
}

export function Missing({ title, message }: { title: string; message: string }) {
  return (
    <Board bar={<BackBar boxed title={title} />}>
      <Empty sign="dashed" title={message} />
    </Board>
  );
}
