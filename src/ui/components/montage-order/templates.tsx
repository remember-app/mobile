import { Clapperboard, RectangleHorizontal, RectangleVertical } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MontageTemplate } from '@/models';
import type { Language } from '@/types/language';
import { duration } from '@/ui/format';
import { BottomSheet } from '@/ui/kit/bottom-sheet';
import { Card } from '@/ui/kit/card';
import { CircularSpinner } from '@/ui/kit/circular-spinner';
import { Image } from '@/ui/kit/image';
import { Text } from '@/ui/kit/text';
import { radius, space, themed, useTheme } from '@/ui/theme';

import { OrderPage, OrderScroll, orientationOf } from './wizard';

const ON_PHOTO = '#ffffff';
const ON_PHOTO_QUIET = 'rgba(255,255,255,0.78)';

export function TemplatesPage({
  templates,
  language,
  chosenId,
  covers,
  group,
  onChoose,
  width,
  height,
  top,
  bottom,
}: {
  templates: MontageTemplate[] | null;
  language: Language;
  chosenId: string | null;
  covers: readonly string[];
  group?: string | null;
  onChoose: (template: MontageTemplate | null) => void;
  width: number;
  height: number;
  top: number;
  bottom: number;
}) {
  const { color } = useTheme();
  const styles = useStyles();
  const [described, setDescribed] = useState<MontageTemplate | null>(null);

  return (
    <>
      <OrderPage width={width} height={height}>
        <OrderScroll top={top} bottom={bottom}>
          {templates === null ? (
            <View style={styles.centre}>
              <CircularSpinner size={32} />
            </View>
          ) : (
            <View style={styles.templateGrid}>
              {templates.map((template) => {
                const text = template.about[language];
                const chosen = chosenId === template.id;
                const cover = template.coverUrl ?? thumbOf(covers, template.id);
                return (
                  <Card
                    key={template.id}
                    clip
                    onPress={() => onChoose(chosen ? null : template)}
                    label={text.name}
                    style={styles.template}
                  >
                    {cover ? (
                      <Image
                        source={cover}
                        group={group}
                        style={[StyleSheet.absoluteFill, styles.templatePhoto]}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.templateEmpty]}>
                        <Clapperboard size={28} color={color.muted} />
                      </View>
                    )}
                    <View
                      pointerEvents="none"
                      style={[StyleSheet.absoluteFill, styles.templateScrim]}
                    />
                    <View style={styles.templateTop}>
                      <View style={styles.templateSign}>
                        {orientationOf(template.settings.dimensions) === 'portrait' ? (
                          <RectangleVertical size={16} color={ON_PHOTO} />
                        ) : (
                          <RectangleHorizontal size={16} color={ON_PHOTO} />
                        )}
                      </View>
                      <View style={styles.templateSpec}>
                        <Text role="metaSm" style={styles.onPhoto}>
                          {duration(template.settings.targetSeconds)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.templateFoot}>
                      <Text role="row" numberOfLines={1} style={styles.onPhoto}>
                        {text.name}
                      </Text>
                      <TemplateDescription
                        text={text.description}
                        onOpen={() => setDescribed(template)}
                      />
                    </View>
                    {chosen ? (
                      <View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          styles.templateFrame,
                          { borderColor: color.accent },
                        ]}
                      />
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </OrderScroll>
      </OrderPage>
      <BottomSheet
        visible={described !== null}
        onClose={() => setDescribed(null)}
        title={described ? described.about[language].name : ''}
      >
        <Text role="body">{described ? described.about[language].description : ''}</Text>
      </BottomSheet>
    </>
  );
}

function thumbOf(covers: readonly string[], id: string): string | null {
  if (covers.length === 0) return null;
  let hash = 2166136261;
  for (const character of id) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return covers[(hash >>> 0) % covers.length] ?? null;
}

function TemplateDescription({ text, onOpen }: { text: string; onOpen: () => void }) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const [lines, setLines] = useState(0);
  const truncated = lines > 2;
  return (
    <View onLayout={(event) => setWidth(Math.ceil(event.nativeEvent.layout.width))}>
      <Pressable
        accessibilityRole={truncated ? 'button' : undefined}
        accessibilityLabel={truncated ? text : undefined}
        disabled={!truncated}
        onPress={truncated ? onOpen : undefined}
      >
        <Text role="metaSm" numberOfLines={2} style={styles.onPhotoQuiet}>
          {text}
        </Text>
      </Pressable>
      {width > 0 ? (
        <Text
          role="metaSm"
          pointerEvents="none"
          style={[styles.onPhotoQuiet, styles.measure, { width }]}
          onTextLayout={(event) => {
            const count = event.nativeEvent.lines.length;
            setLines((was) => (was === count ? was : count));
          }}
        >
          {text}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = themed(() =>
  StyleSheet.create({
    centre: {
      alignItems: 'center',
      paddingVertical: space.s5,
    },
    templateGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.s2,
    },
    template: {
      flexGrow: 1,
      flexBasis: '45%',
      height: 150,
      padding: 0,
    },
    templatePhoto: {
      opacity: 0.65,
    },
    templateEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    templateScrim: {
      experimental_backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.05))`,
    },
    templateTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.s2,
      padding: space.s2,
    },
    templateSign: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    templateSpec: {
      marginLeft: 'auto',
      paddingVertical: 3,
      paddingHorizontal: space.s2,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    templateFrame: {
      borderWidth: 2,
      borderRadius: radius.card,
    },
    measure: {
      position: 'absolute',
      left: 0,
      top: 0,
      opacity: 0,
    },
    templateFoot: {
      marginTop: 'auto',
      padding: space.s3,
      gap: space.s1,
    },
    onPhoto: {
      color: ON_PHOTO,
    },
    onPhotoQuiet: {
      color: ON_PHOTO_QUIET,
    },
  }),
);
