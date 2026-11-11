import { CheckCircle2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { networkState, refreshNetwork } from '@/functionality';
import { health } from '@/integrations/api';
import { useNetwork } from '@/ui/hooks';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Text } from '@/ui/kit/text';
import { radius, space, useTheme } from '@/ui/theme';

const NO_NETWORK = 0;
const NO_SERVER = 1;
const CONNECTING = 2;
const CONNECTED = 3;

const SHOWN_MS = 2400;
const NETWORK_POLL_MS = 2000;
const PLATEAU_MS = 20000;
const DELAYS = [100, 200, 500, 1000, 2000, 4000, 8000, 16000];

type Phase = 'hidden' | 'no-network' | 'waiting' | 'checking' | 'connected';

export function NetworkBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { color } = useTheme();
  const network = useNetwork();
  const labels = [
    t('network.noNetwork'),
    t('network.noServer'),
    t('network.connecting'),
    t('network.connected'),
  ];
  const [phase, setPhase] = useState<Phase>('hidden');
  const [widths, setWidths] = useState([0, 0, 0, 0]);
  const phaseRef = useRef<Phase>(phase);
  const running = useRef(false);
  phaseRef.current = phase;
  const widest = Math.max(...widths);

  const check = useCallback(async (progress: boolean): Promise<boolean> => {
    if (running.current) return false;
    running.current = true;
    if (progress) setPhase('checking');
    try {
      await refreshNetwork();
      if (networkState().status !== 'online') {
        setPhase('no-network');
        return false;
      }
      const reachable = await health().then(
        () => true,
        () => false,
      );
      if (reachable) {
        setPhase(phaseRef.current === 'hidden' ? 'hidden' : 'connected');
        return true;
      }
      setPhase('waiting');
      return false;
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (network.status === 'unknown') return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    if (network.status === 'offline') {
      setPhase('no-network');
      const poll = () => {
        timer = setTimeout(async () => {
          if (!live) return;
          await refreshNetwork();
          if (live) poll();
        }, NETWORK_POLL_MS);
      };
      poll();
      return () => {
        live = false;
        if (timer) clearTimeout(timer);
      };
    }

    const run = async () => {
      const reachable = await check(attempt > 0);
      if (!live || reachable) return;
      const delay = attempt < DELAYS.length ? DELAYS[attempt] : PLATEAU_MS;
      attempt += 1;
      timer = setTimeout(() => void run(), delay);
    };
    void run();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [check, network.status]);

  useEffect(() => {
    if (phase !== 'connected') return;
    const timer = setTimeout(() => setPhase('hidden'), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const connected = phase === 'connected';
  const checking = phase === 'checking';
  const noNetwork = phase === 'no-network';
  const label = connected
    ? labels[CONNECTED]
    : checking
      ? labels[CONNECTING]
      : noNetwork
        ? labels[NO_NETWORK]
        : labels[NO_SERVER];
  const showsIcon = !noNetwork;

  return (
    <>
      <View
        style={styles.measure}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {labels.map((text, index) => (
          <Text
            key={index}
            role="noteSm"
            numberOfLines={1}
            onLayout={(event) => {
              const width = Math.ceil(event.nativeEvent.layout.width);
              setWidths((was) =>
                was[index] === width ? was : Object.assign([...was], { [index]: width }),
              );
            }}
          >
            {text}
          </Text>
        ))}
      </View>
      {phase !== 'hidden' && widest > 0 ? (
        <View style={[styles.wrap, { top: insets.top + space.s2 }]} pointerEvents="none">
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(180)}
            style={[
              styles.pill,
              {
                width: widest + (showsIcon ? 16 + space.s2 : 0) + space.s4 * 2 + space.s1 * 2,
                backgroundColor: color.surface,
                borderColor: color.line,
              },
            ]}
          >
            {showsIcon ? (
              connected ? (
                <CheckCircle2 size={16} color={color.accent} />
              ) : (
                <CircularSpinner size={16} />
              )
            ) : null}
            <Text role="noteSm" tone="paper" numberOfLines={1} style={styles.label}>
              {label}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
  },
  pill: {
    height: 36,
    paddingHorizontal: space.s4,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
  },
  label: {
    flex: 1,
    textAlign: 'center',
  },
});
