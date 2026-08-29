import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useCommodities } from '../../contexts/CommoditiesContext';
import { useUser } from '../../contexts/UserContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { deleteCommodity, saveCommodity, safeIcon, FALLBACK_ICON } from '../../services/commodities';
import { logAction } from '../../services/audit';
import { logger } from '../../services/logger';
import { snackbar } from '../../hooks/useSnackbar';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import ThemedTextInput from '../../components/ThemedTextInput';
import FadeInUp from '../../components/FadeInUp';
import AmbientGlow from '../../components/AmbientGlow';
import EmptyState from '../../components/EmptyState';
import { layout, radius, spacing, type } from '../../theme/tokens';

const CATEGORIES = ['food', 'medical', 'therapeutic', 'hygiene', 'agriculture', 'other'];
const UNITS = ['kg', 'g', 'L', 'ml', 'pack', 'tablet', 'vial', 'unit', 'box'];

// Composable commodity editor modal. We share one between create and
// edit so the field set stays in lock-step.
function CommodityEditor({ visible, initial, onClose, onSave, theme, styles, t, tCommon }) {
  const [name, setName] = useState(initial?.name || '');
  const [unit, setUnit] = useState(initial?.unit || 'kg');
  const [icon, setIcon] = useState(initial?.icon || 'package-variant');
  const [color, setColor] = useState(initial?.color || '#888888');
  const [category, setCategory] = useState(initial?.category || 'food');
  const [defaultPerBox, setDefaultPerBox] = useState(
    initial?.defaultPerBox != null ? String(initial.defaultPerBox) : '0'
  );
  const [required, setRequired] = useState(Boolean(initial?.required));
  const [expiryTracking, setExpiryTracking] = useState(Boolean(initial?.expiryTracking));
  const [batchTracking, setBatchTracking] = useState(Boolean(initial?.batchTracking));
  const [sortOrder, setSortOrder] = useState(
    initial?.sortOrder != null ? String(initial.sortOrder) : '50'
  );
  const [busy, setBusy] = useState(false);

  // Reset the form every time the editor opens with a new target.
  // The setState calls here are intentional — we want the editor
  // fields to mirror the incoming `initial` prop, and the only
  // way to do that for a controlled form is to re-seed the state
  // in an effect when the prop changes. (The `if (!visible) return`
  // guard prevents the reset from clobbering in-progress edits
  // while the modal is just animating closed.)
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(initial?.name || '');
    setUnit(initial?.unit || 'kg');
    setIcon(initial?.icon || 'package-variant');
    setColor(initial?.color || '#888888');
    setCategory(initial?.category || 'food');
    setDefaultPerBox(initial?.defaultPerBox != null ? String(initial.defaultPerBox) : '0');
    setRequired(Boolean(initial?.required));
    setExpiryTracking(Boolean(initial?.expiryTracking));
    setBatchTracking(Boolean(initial?.batchTracking));
    setSortOrder(initial?.sortOrder != null ? String(initial.sortOrder) : '50');
  }, [visible, initial]);

  const handleSave = async () => {
    if (busy) return;
    if (!name.trim()) {
      snackbar.error(t.nameRequired);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        unit,
        icon: icon.trim() || 'package-variant',
        color,
        category,
        defaultPerBox: Number(defaultPerBox) || 0,
        required,
        expiryTracking,
        batchTracking,
        sortOrder: Number(sortOrder) || 50,
      };
      await onSave(payload, initial?.id || null);
      onClose();
    } catch (err) {
      logger.logError('Commodities/save', err, { commodityId: initial?.id });
      snackbar.error(t.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {initial?.id ? t.editItemLiteral : t.newItem}
            </Text>
            <ThemedTextInput label={t.fieldName} value={name} onChangeText={setName} />
            <ThemedTextInput
              label={t.fieldIcon}
              value={icon}
              onChangeText={setIcon}
              autoCapitalize="none"
              error={icon.trim() !== '' && safeIcon(icon.trim()) === FALLBACK_ICON}
              helperText={
                icon.trim() !== '' && safeIcon(icon.trim()) === FALLBACK_ICON
                  ? t.unknownIconWarning
                  : undefined
              }
            />
            <ThemedTextInput
              label={t.fieldColor}
              value={color}
              onChangeText={setColor}
              autoCapitalize="none"
            />
            <ThemedTextInput
              label={t.fieldDefaultPerBox}
              value={defaultPerBox}
              onChangeText={(v) => setDefaultPerBox(v.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
            />
            <ThemedTextInput
              label={t.fieldSortOrder}
              value={sortOrder}
              onChangeText={(v) => setSortOrder(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
            <ChipPicker
              theme={theme}
              styles={styles}
              label={t.fieldCategory}
              value={category}
              options={CATEGORIES}
              onChange={setCategory}
            />
            <ChipPicker
              theme={theme}
              styles={styles}
              label={t.fieldUnit}
              value={unit}
              options={UNITS}
              onChange={setUnit}
            />
            <ToggleRow
              theme={theme}
              label={t.fieldRequired}
              value={required}
              onValueChange={setRequired}
            />
            <ToggleRow
              theme={theme}
              label={t.fieldBatchTracking}
              value={batchTracking}
              onValueChange={setBatchTracking}
            />
            <ToggleRow
              theme={theme}
              label={t.fieldExpiryTracking}
              value={expiryTracking}
              onValueChange={setExpiryTracking}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.modalBtn, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>{tCommon.cancel}</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={busy}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { backgroundColor: theme.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: theme.primaryText }]}>{tCommon.save}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ChipPicker({ theme, styles, label, value, options, onChange }) {
  return (
    <View style={styles.pickerBlock}>
      <Text style={[styles.pickerLabel, { color: theme.muted }]}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: selected ? theme.primarySoft : theme.surfaceRaised,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? theme.primary : theme.text },
                ]}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({ theme, label, value, onValueChange }) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        stylesLocal.toggleRow,
        { borderColor: theme.border, backgroundColor: theme.surfaceRaised, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[stylesLocal.toggleLabel, { color: theme.text }]}>{label}</Text>
      <MaterialCommunityIcons
        name={value ? 'toggle-switch' : 'toggle-switch-off-outline'}
        size={28}
        color={value ? theme.primary : theme.muted}
      />
    </Pressable>
  );
}

const stylesLocal = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  toggleLabel: { ...type.bodyStrong },
});

export default function Commodities({ navigation }) {
  const { theme } = useAppTheme();
  const { commodities, loading } = useCommodities();
  const { userData } = useUser();
  const { t: tAll, tf } = useLanguage();
  const t = tAll('commodities');
  const tCommon = tAll('common');
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (commodity) => {
    setEditing(commodity);
    setEditorOpen(true);
  };

  const handleSave = async (payload, id) => {
    if (id) {
      await saveCommodity(payload, id);
      await logAction('commodity_updated', { commodityId: id }, userData?.id);
    } else {
      const newId = await saveCommodity(payload);
      await logAction('commodity_created', { commodityId: newId }, userData?.id);
    }
    snackbar.success(t.success);
  };

  const handleDelete = (commodity) => {
    if (commodity.required) {
      Alert.alert(t.cannotDeleteTitle, t.cannotDeleteMessage);
      return;
    }
    Alert.alert(
      t.deleteConfirmTitle,
      tf('commodities.deleteConfirmMessage', { name: commodity.name }),
      [
        { text: tCommon.cancel, style: 'cancel' },
        {
          text: tCommon.delete,
          style: 'destructive',
          onPress: async () => {
            // FR-COMM-4: confirm it's not referenced by any box.
            // (Templates only carry ids; boxes are the source of truth.)
            try {
              const ref = query(collection(db, 'boxes'), where(`contents.${commodity.id}`, '>', 0));
              const snap = await getDocs(ref);
              if (snap.size > 0) {
                snackbar.error(tf('commodities.inUseMessage', { count: snap.size }));
                return;
              }
              await deleteCommodity(commodity.id);
              await logAction('commodity_deleted', { commodityId: commodity.id }, userData?.id);
              snackbar.success(t.removed);
            } catch (err) {
              logger.logError('Commodities/delete', err, { commodityId: commodity.id });
              snackbar.error(t.deleteFailed);
            }
          },
        },
      ]
    );
  };

  if (!loading && commodities.length === 0) {
    return (
      <View style={styles.screen}>
        <AmbientGlow variant="topLeft" opacity={0.5} />
        <EmptyState
          icon="package-variant-closed"
          title={t.emptyTitle}
          message={t.emptyMessage}
          actionLabel={t.addCommodity}
          onAction={openCreate}
        />
        <CommodityEditor
          visible={editorOpen}
          initial={editing}
          onClose={() => setEditorOpen(false)}
          onSave={handleSave}
          theme={theme}
          styles={styles}
          t={t}
          tCommon={tCommon}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AmbientGlow variant="topLeft" opacity={0.5} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.contentWrap}>
          <FadeInUp delay={0}>
            <ScreenHeader
              eyebrow={t.eyebrow}
              title={t.title}
              subtitle={t.subtitle}
            />
          </FadeInUp>

          <FadeInUp delay={60}>
            <Pressable
              onPress={openCreate}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.newBtn,
                { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="plus" size={18} color={theme.primaryText} />
              <Text style={[styles.newBtnText, { color: theme.primaryText }]}>{t.newCommodity}</Text>
            </Pressable>
          </FadeInUp>

          {commodities.map((c) => (
            <FadeInUp key={c.id} delay={100}>
              <SurfaceCard style={styles.row}>
                <View style={[styles.iconDot, { backgroundColor: c.color || theme.muted }]}>
                  <MaterialCommunityIcons
                    name={safeIcon(c.icon) as any}
                    size={20}
                    color={theme.primaryText}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>
                    {c.name}
                    {c.required ? <Text style={{ color: theme.danger }}> *</Text> : null}
                  </Text>
                  <Text style={[styles.rowMeta, { color: theme.muted }]}>
                    {c.category} · {c.unit} · {t.metadata.defaultPrefix} {c.defaultPerBox} {c.unit}
                    {c.expiryTracking ? ` · ${t.metadata.trackingExpiry}` : ''}
                    {c.batchTracking ? ` · ${t.metadata.trackingBatch}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => openEdit(c)}
                  style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                  accessibilityLabel={tf('commodities.editItem', { name: c.name })}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.primary} />
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(c)}
                  style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                  accessibilityLabel={tf('commodities.deleteItem', { name: c.name })}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.danger} />
                </Pressable>
              </SurfaceCard>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>

      <CommodityEditor
        visible={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        theme={theme}
        styles={styles}
        t={t}
        tCommon={tCommon}
      />
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingBottom: spacing.xxl, paddingTop: spacing.lg },
    contentWrap: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      minHeight: 52,
    },
    newBtnText: { ...type.bodyStrong, textTransform: 'uppercase', letterSpacing: 1.5 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    iconDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1 },
    rowTitle: { ...type.bodyStrong },
    rowMeta: { ...type.caption, marginTop: 2 },
    iconBtn: {
      padding: spacing.xs,
    },
    modalScrim: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      maxHeight: '90%',
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderWidth: 1,
    },
    modalContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
    modalTitle: { ...type.title, marginBottom: spacing.md },
    pickerBlock: { marginBottom: spacing.md },
    pickerLabel: { ...type.eyebrow, marginBottom: spacing.xs },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    chipText: { ...type.caption, fontWeight: '700' },
    modalActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
    },
    modalBtnPrimary: { borderWidth: 0 },
    modalBtnText: { ...type.bodyStrong, textTransform: 'uppercase', letterSpacing: 1.2 },
  });
}
