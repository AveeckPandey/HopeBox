import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useUser } from '../../contexts/UserContext';
import { useCommodities, useTemplates } from '../../contexts/CommoditiesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { deleteTemplate, saveTemplate } from '../../services/boxTemplates';
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

// The list of program tags shown in the editor's chip picker.
// Mirrors the `program` field on /boxTemplates.
const PROGRAMS = ['general', 'child_meal', 'medical_kit', 'hygiene', 'shelter'];

// P50: Templates admin screen. Soft-delete is the only delete
// path — the service writes `_deleted: true` and the live
// subscription filters those rows out (see
// CommoditiesContext.js:52,89). The default template cannot be
// deleted; an admin must first promote a different template to
// default.
export default function Templates({ navigation }) {
  const { theme } = useAppTheme();
  const { userData } = useUser();
  const { templates, loading } = useTemplates();
  const { t: tAll, tf } = useLanguage();
  const t = tAll('templates');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (template) => {
    setEditing(template);
    setEditorOpen(true);
  };

  const handleSave = async (payload, id) => {
    if (id) {
      await saveTemplate(payload, id);
      await logAction('template_updated', { templateId: id }, userData?.id);
    } else {
      const newId = await saveTemplate(payload);
      await logAction('template_created', { templateId: newId }, userData?.id);
    }
    snackbar.success(t.success);
  };

  // P50: soft-delete with a defensive "in use" check. We count
  // boxes whose `templateId` matches. If the count is zero we
  // proceed with the soft-delete; otherwise we surface a message
  // instead of deleting (the box's templateId would dangle,
  // which AddBox handles today by treating a missing template as
  // "no template", but it's cleaner to refuse the delete).
  //
  // The default template is treated as a special case: it can
  // never be deleted. The admin must promote another template
  // first.
  const handleDelete = (template) => {
    if (template.default) {
      snackbar.error(t.inUseMessage);
      return;
    }
    Alert.alert(
      t.confirmDeleteTitle,
      tf('templates.confirmDeleteMessage', { name: template.name }),
      [
        { text: tAll('common').cancel, style: 'cancel' },
        {
          text: tAll('common').delete,
          style: 'destructive',
          onPress: async () => {
            try {
              const inUse = await getDocs(
                query(collection(db, 'boxes'), where('templateId', '==', template.id))
              );
              if (inUse.size > 0) {
                snackbar.error(`In use by ${inUse.size} box(es). Cannot delete.`);
                return;
              }
              await deleteTemplate(template.id);
              await logAction('template_deleted', { templateId: template.id }, userData?.id);
              snackbar.success(t.deleted);
            } catch (err) {
              logger.logError('Templates/delete', err, { templateId: template.id });
              snackbar.error(t.deleteFailed);
            }
          },
        },
      ]
    );
  };

  if (!loading && templates.length === 0) {
    return (
      <View style={styles.screen}>
        <AmbientGlow variant="topLeft" opacity={0.5} />
        <EmptyState
          icon="file-document-outline"
          title={t.emptyTitle}
          message={t.emptyMessage}
          actionLabel={t.newTemplate}
          onAction={openCreate}
        />
        <TemplateEditor
          visible={editorOpen}
          initial={editing}
          onClose={() => setEditorOpen(false)}
          onSave={handleSave}
          theme={theme}
          styles={styles}
          t={t}
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
              accessibilityLabel={t.newTemplate}
              style={({ pressed }) => [
                styles.newBtn,
                { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="plus" size={18} color={theme.primaryText} />
              <Text style={[styles.newBtnText, { color: theme.primaryText }]}>{t.newTemplate}</Text>
            </Pressable>
          </FadeInUp>

          {templates.map((tmpl) => (
            <FadeInUp key={tmpl.id} delay={100}>
              <SurfaceCard style={styles.row}>
                <View style={styles.rowText}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>
                      {tmpl.name}
                    </Text>
                    {tmpl.default ? (
                      <View style={[styles.defaultBadge, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
                        <Text style={[styles.defaultBadgeText, { color: theme.primary }]}>
                          {t.defaultLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.rowMeta, { color: theme.muted }]}>
                    {t.programs[tmpl.program] || tmpl.program} · {Object.keys(tmpl.commodities || {}).length} {t.commoditiesLabel}
                  </Text>
                </View>
                <Pressable
                  onPress={() => openEdit(tmpl)}
                  style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                  accessibilityLabel={tf('templates.editItem', { name: tmpl.name })}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.primary} />
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(tmpl)}
                  style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                  accessibilityLabel={tf('templates.deleteItem', { name: tmpl.name })}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.danger} />
                </Pressable>
              </SurfaceCard>
            </FadeInUp>
          ))}

        </View>
      </ScrollView>

      <TemplateEditor
        visible={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        theme={theme}
        styles={styles}
        t={t}
      />
    </View>
  );
}

// Composable editor modal — shared between create and edit so the
// field set stays in lock-step.
function TemplateEditor({ visible, initial, onClose, onSave, theme, styles, t }) {
  const { commodities } = useCommodities();
  const [name, setName] = useState(initial?.name || '');
  const [program, setProgram] = useState(initial?.program || 'general');
  const [isDefault, setIsDefault] = useState(Boolean(initial?.default));
  const [commodityQtys, setCommodityQtys] = useState(() => {
    const out = {};
    for (const [k, v] of Object.entries(initial?.commodities || {})) {
      out[k] = String(v);
    }
    return out;
  });
  const [busy, setBusy] = useState(false);

  // Re-seed the form every time the editor opens with a new
  // target. The setState calls here are intentional — see
  // Commodities.js for the full rationale.
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(initial?.name || '');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgram(initial?.program || 'general');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDefault(Boolean(initial?.default));
    const next = {};
    for (const [k, v] of Object.entries(initial?.commodities || {})) {
      next[k] = String(v);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCommodityQtys(next);
  }, [visible, initial]);

  const handleQtyChange = (commodityId, raw) => {
    setCommodityQtys((prev) => {
      const next = { ...prev };
      if (raw === '' || raw == null) {
        delete next[commodityId];
      } else {
        next[commodityId] = raw;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (busy) return;
    if (!name.trim()) {
      snackbar.error(t.nameRequired);
      return;
    }
    const commoditiesMap = {};
    for (const [k, v] of Object.entries(commodityQtys)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) commoditiesMap[k] = n;
    }
    if (Object.keys(commoditiesMap).length === 0) {
      snackbar.error(t.atLeastOneCommodity);
      return;
    }
    setBusy(true);
    try {
      await onSave(
        {
          name: name.trim(),
          program,
          default: isDefault,
          commodities: commoditiesMap,
        },
        initial?.id || null
      );
      onClose();
    } catch (err) {
      logger.logError('Templates/save', err, { templateId: initial?.id });
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
              {initial?.id ? t.editItem.replace('{{name}}', name || initial.name) : t.newTemplate}
            </Text>

            <ThemedTextInput
              label={t.nameLabel}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={[styles.pickerLabel, { color: theme.muted }]}>{t.programLabel}</Text>
            <View style={styles.chipRow}>
              {PROGRAMS.map((p) => {
                const selected = p === program;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setProgram(p)}
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
                      style={[styles.chipText, { color: selected ? theme.primary : theme.text }]}
                    >
                      {t.programs[p] || p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setIsDefault(!isDefault)}
              style={({ pressed }) => [
                stylesLocal.toggleRow,
                { borderColor: theme.border, backgroundColor: theme.surfaceRaised, opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="switch"
              accessibilityState={{ checked: isDefault }}
              accessibilityLabel={t.defaultLabel}
            >
              <View style={stylesLocal.toggleText}>
                <Text style={[stylesLocal.toggleLabel, { color: theme.text }]}>{t.defaultLabel}</Text>
                <Text style={[stylesLocal.toggleHelper, { color: theme.muted }]}>{t.defaultHelper}</Text>
              </View>
              <MaterialCommunityIcons
                name={isDefault ? 'toggle-switch' : 'toggle-switch-off-outline'}
                size={28}
                color={isDefault ? theme.primary : theme.muted}
              />
            </Pressable>

            <Text style={[styles.pickerLabel, { color: theme.muted, marginTop: spacing.md }]}>
              {t.commoditiesLabel}
            </Text>
            {commodities.length === 0 ? (
              <Text style={[styles.empty, { color: theme.muted }]}>{t.empty}</Text>
            ) : (
              commodities.map((c) => (
                <View key={c.id} style={styles.qtyRow}>
                  <View style={[styles.iconDot, { backgroundColor: c.color || theme.muted }]}>
                    <MaterialCommunityIcons
                      name={(c.icon || 'package-variant') as any}
                      size={14}
                      color={theme.primaryText}
                    />
                  </View>
                  <Text style={[styles.qtyName, { color: theme.text }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <View style={styles.qtyInput}>
                    <ThemedTextInput
                      label={c.unit}
                      value={commodityQtys[c.id] || ''}
                      onChangeText={(v) => handleQtyChange(c.id, v.replace(/[^0-9.]/g, ''))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              ))
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.modalBtn, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>
                  {t.cancel}
                </Text>
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
                <Text style={[styles.modalBtnText, { color: theme.primaryText }]}>
                  {t.save}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    marginTop: spacing.sm,
  },
  toggleText: { flex: 1, paddingRight: spacing.md },
  toggleLabel: { ...type.bodyStrong },
  toggleHelper: { ...type.caption, marginTop: 2 },
});

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
    rowText: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
    rowTitle: { ...type.bodyStrong },
    rowMeta: { ...type.caption, marginTop: 2 },
    defaultBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    defaultBadgeText: { ...type.caption, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    iconBtn: { padding: spacing.xs },
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
    pickerLabel: { ...type.eyebrow, marginBottom: spacing.xs, marginTop: spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    chipText: { ...type.caption, fontWeight: '700' },
    qtyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    iconDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyName: { ...type.body, flex: 1 },
    qtyInput: { width: 90 },
    empty: { ...type.body, paddingVertical: spacing.md },
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
