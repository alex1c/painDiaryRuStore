/**
 * Optional pain-details editor: side, locations, characters, symptoms, factors.
 * All fields optional; save replaces tag sets atomically via replaceEpisodeDetails.
 */

import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChipSelect } from '@/components/episode/ChipSelect';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import {
  FACTOR_UI_GROUPS,
  HEADACHE_SIDES,
  LOCATION_CODES,
  PAIN_CHARACTER_CODES,
  SYMPTOM_CODES,
  type FactorCode,
  type HeadacheSide,
  type LocationCode,
  type PainCharacterCode,
  type SymptomCode,
} from '@/src/domain/codes';
import {
  FACTOR_LABELS,
  LOCATION_LABELS,
  PAIN_CHARACTER_LABELS,
  SIDE_LABELS,
  SYMPTOM_LABELS,
} from '@/src/domain/labels';
import type { CustomFactor } from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type Snapshot = {
  side: HeadacheSide | null;
  locations: LocationCode[];
  characters: PainCharacterCode[];
  symptoms: SymptomCode[];
  builtInFactors: Exclude<FactorCode, 'custom'>[];
  customFactorIds: string[];
  otherLocation: string;
  otherCharacter: string;
  otherSymptom: string;
};

function emptySnapshot(): Snapshot {
  return {
    side: null,
    locations: [],
    characters: [],
    symptoms: [],
    builtInFactors: [],
    customFactorIds: [],
    otherLocation: '',
    otherCharacter: '',
    otherSymptom: '',
  };
}

export default function EditPainDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { headacheRepository, customFactorRepository } = useDatabase();

  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot());
  const [baseline, setBaseline] = useState<string>('');
  const [customFactors, setCustomFactors] = useState<CustomFactor[]>([]);
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);
  const dirtyRef = useRef(false);

  const serialized = useMemo(() => JSON.stringify(snapshot), [snapshot]);

  useEffect(() => {
    dirtyRef.current = baseline !== '' && serialized !== baseline;
  }, [serialized, baseline]);

  const reload = useCallback(() => {
    if (!headacheRepository || !customFactorRepository || !id) return;
    const details = headacheRepository.getEpisodeDetails(id);
    if (!details) {
      setMissing(true);
      return;
    }
    setMissing(false);
    const next: Snapshot = {
      side: details.episode.side,
      locations: details.locations.map((l) => l.code),
      characters: details.painCharacters.map((c) => c.code),
      symptoms: details.symptoms.map((s) => s.code),
      builtInFactors: details.factors
        .filter((f) => f.code !== 'custom')
        .map((f) => f.code as Exclude<FactorCode, 'custom'>),
      customFactorIds: details.factors
        .filter((f) => f.code === 'custom' && f.customFactorId)
        .map((f) => f.customFactorId as string),
      otherLocation:
        details.locations.find((l) => l.code === 'other')?.customLabel ?? '',
      otherCharacter:
        details.painCharacters.find((c) => c.code === 'other')?.customLabel ??
        '',
      otherSymptom:
        details.symptoms.find((s) => s.code === 'other')?.customLabel ?? '',
    };
    setSnapshot(next);
    setBaseline(JSON.stringify(next));
    setCustomFactors(customFactorRepository.listActive());
  }, [headacheRepository, customFactorRepository, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const persistRef = useRef<() => boolean>(() => false);

  useEffect(() => {
    persistRef.current = () => {
      if (!headacheRepository || !customFactorRepository || !id) {
        return false;
      }
      try {
        const locations = snapshot.locations.map((code) => ({
          code,
          customLabel:
            code === 'other' ? snapshot.otherLocation.trim() || null : null,
        }));
        const painCharacters = snapshot.characters.map((code) => ({
          code,
          customLabel:
            code === 'other' ? snapshot.otherCharacter.trim() || null : null,
        }));
        const symptoms = snapshot.symptoms.map((code) => ({
          code,
          customLabel:
            code === 'other' ? snapshot.otherSymptom.trim() || null : null,
        }));

        const factors: {
          code: FactorCode;
          customLabel?: string | null;
          customFactorId?: string | null;
        }[] = [
          ...snapshot.builtInFactors.map((code) => ({ code })),
          ...snapshot.customFactorIds.map((customFactorId) => {
            const cf =
              customFactors.find((c) => c.id === customFactorId) ??
              customFactorRepository.getById(customFactorId);
            return {
              code: 'custom' as const,
              customFactorId,
              customLabel: cf?.name ?? null,
            };
          }),
        ];

        headacheRepository.replaceEpisodeDetails(id, {
          side: snapshot.side,
          locations,
          painCharacters,
          symptoms,
          factors,
        });
        setBaseline(JSON.stringify(snapshot));
        dirtyRef.current = false;
        return true;
      } catch {
        Alert.alert('Ошибка', 'Не удалось сохранить подробности');
        return false;
      }
    };
  }, [
    headacheRepository,
    customFactorRepository,
    id,
    snapshot,
    customFactors,
  ]);

  // Prompt on Android back when there are unsaved edits.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      Alert.alert('Сохранить изменения?', undefined, [
        {
          text: 'Не сохранять',
          style: 'destructive',
          onPress: () => {
            dirtyRef.current = false;
            navigation.dispatch(e.data.action);
          },
        },
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сохранить',
          onPress: () => {
            if (persistRef.current()) {
              navigation.dispatch(e.data.action);
            }
          },
        },
      ]);
    });
    return unsub;
  }, [navigation]);

  const handleSave = () => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = persistRef.current();
      if (ok) {
        router.back();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustom = () => {
    if (!customFactorRepository) return;
    try {
      const created = customFactorRepository.getOrCreate(customName);
      setCustomFactors(customFactorRepository.listActive());
      setSnapshot((prev) => ({
        ...prev,
        customFactorIds: prev.customFactorIds.includes(created.id)
          ? prev.customFactorIds
          : [...prev.customFactorIds, created.id],
      }));
      setCustomName('');
    } catch {
      Alert.alert('Ошибка', 'Введите короткое название фактора');
    }
  };

  if (missing) {
    return (
      <Screen>
        <Text style={styles.title}>Приступ не найден</Text>
        <Button title="Назад" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={styles.title}>Подробности приступа</Text>
      <Text style={styles.hint}>Все поля необязательны</Text>

      <Text style={styles.section}>Где болит</Text>
      <Text style={styles.sub}>Сторона</Text>
      <ChipSelect
        single
        options={HEADACHE_SIDES.map((value) => ({
          value,
          label: SIDE_LABELS[value],
        }))}
        selected={snapshot.side ? [snapshot.side] : []}
        onChange={(next) =>
          setSnapshot((s) => ({ ...s, side: next[0] ?? null }))
        }
      />

      <Text style={[styles.sub, styles.subGap]}>Область</Text>
      <ChipSelect
        options={LOCATION_CODES.map((value) => ({
          value,
          label: LOCATION_LABELS[value],
        }))}
        selected={snapshot.locations}
        onChange={(locations) => setSnapshot((s) => ({ ...s, locations }))}
      />
      {snapshot.locations.includes('other') ? (
        <TextInput
          accessibilityLabel="Уточнить область"
          placeholder="Уточнить"
          placeholderTextColor={colors.textMuted}
          value={snapshot.otherLocation}
          onChangeText={(otherLocation) =>
            setSnapshot((s) => ({ ...s, otherLocation }))
          }
          style={styles.input}
        />
      ) : null}

      <Text style={styles.section}>Как болит</Text>
      <ChipSelect
        options={PAIN_CHARACTER_CODES.map((value) => ({
          value,
          label: PAIN_CHARACTER_LABELS[value],
        }))}
        selected={snapshot.characters}
        onChange={(characters) => setSnapshot((s) => ({ ...s, characters }))}
      />
      {snapshot.characters.includes('other') ? (
        <TextInput
          accessibilityLabel="Уточнить характер боли"
          placeholder="Уточнить"
          placeholderTextColor={colors.textMuted}
          value={snapshot.otherCharacter}
          onChangeText={(otherCharacter) =>
            setSnapshot((s) => ({ ...s, otherCharacter }))
          }
          style={styles.input}
        />
      ) : null}

      <Text style={styles.section}>Симптомы</Text>
      <ChipSelect
        options={SYMPTOM_CODES.map((value) => ({
          value,
          label: SYMPTOM_LABELS[value],
        }))}
        selected={snapshot.symptoms}
        onChange={(symptoms) => setSnapshot((s) => ({ ...s, symptoms }))}
      />
      {snapshot.symptoms.includes('other') ? (
        <TextInput
          accessibilityLabel="Уточнить симптом"
          placeholder="Уточнить"
          placeholderTextColor={colors.textMuted}
          value={snapshot.otherSymptom}
          onChangeText={(otherSymptom) =>
            setSnapshot((s) => ({ ...s, otherSymptom }))
          }
          style={styles.input}
        />
      ) : null}

      <Text style={styles.section}>Что могло повлиять</Text>
      <Text style={styles.hint}>
        Отметьте, если считаете это связанным с приступом
      </Text>
      {FACTOR_UI_GROUPS.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.sub}>{group.title}</Text>
          <ChipSelect
            options={group.codes.map((value) => ({
              value,
              label: FACTOR_LABELS[value],
            }))}
            selected={snapshot.builtInFactors.filter((c) =>
              (group.codes as readonly string[]).includes(c)
            )}
            onChange={(picked) => {
              const others = snapshot.builtInFactors.filter(
                (c) => !(group.codes as readonly string[]).includes(c)
              );
              setSnapshot((s) => ({
                ...s,
                builtInFactors: [...others, ...picked],
              }));
            }}
          />
        </View>
      ))}

      {customFactors.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.sub}>Ваши факторы</Text>
          <ChipSelect
            options={customFactors.map((cf) => ({
              value: cf.id,
              label: cf.name,
            }))}
            selected={snapshot.customFactorIds}
            onChange={(customFactorIds) =>
              setSnapshot((s) => ({ ...s, customFactorIds }))
            }
          />
        </View>
      ) : null}

      <Text style={styles.sub}>+ Свой фактор</Text>
      <View style={styles.customRow}>
        <TextInput
          accessibilityLabel="Название своего фактора"
          placeholder="Например: Баня"
          placeholderTextColor={colors.textMuted}
          value={customName}
          onChangeText={setCustomName}
          style={[styles.input, styles.customInput]}
        />
        <Button title="Добавить" variant="secondary" onPress={handleAddCustom} />
      </View>

      <Button
        title="Сохранить"
        onPress={handleSave}
        disabled={saving}
        style={styles.save}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  section: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  subGap: {
    marginTop: spacing.md,
  },
  group: {
    marginBottom: spacing.md,
  },
  input: {
    marginTop: spacing.sm,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...typography.body,
    color: colors.text,
  },
  customRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  customInput: {
    marginTop: 0,
  },
  save: {
    marginTop: spacing.xl,
  },
});
