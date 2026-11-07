import { Alert } from 'react-native';

import { i18n } from '@/ui/i18n';

type Props = {
  confirm: string;
  onConfirm: () => void;
  cancel?: string;
  destructive?: boolean;
  title?: string;
};

export function confirmAction({
  confirm,
  onConfirm,
  cancel = i18n.t('action.cancel'),
  destructive,
  title = i18n.t('confirm.title'),
}: Props): void {
  Alert.alert(title, undefined, [
    { text: cancel, style: 'cancel' },
    { text: confirm, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
