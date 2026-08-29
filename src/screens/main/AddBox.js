import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { addDoc, collection, Timestamp } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useWarehouse } from '../../contexts/WarehouseContext';
import { useUser } from '../../contexts/UserContext';
import { useCommodities, useTemplates } from '../../contexts/CommoditiesContext';
import { logAction } from '../../services/audit';
import { useLanguage } from '../../contexts/LanguageContext';
import { snackbar } from '../../hooks/useSnackbar';
import { needsBatch, needsExpiry, safeIcon } from '../../services/commodities';
import { isFlatLine, normalizeLine, validateContents } from '../../services/boxLines';
import { applyUnitConversion, listConversions } from '../../services/unitConversion';
import { logger } from '../../services/logger';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import ThemedTextInput from '../../components/ThemedTextInput';
import ChipGroup from '../../components/ChipGroup';
import FadeInUp from '../../components/FadeInUp';
import AmbientGlow from '../../components/AmbientGlow';
import EmptyState from '../../components/EmptyState';
import { layout, radius, spacing, type } from '../../theme/tokens';

// Per-commodity row. Manages its own qty / batch / expiry fields so the
// parent AddBox screen only deals with a flat `contents` map. When the
// commodity has neither expiryTracking nor batchTracking we render a
// single numeric input; otherwise we render the extras inline.
function CommodityLineRow({ commodity, value, onChange }) {
  const { theme } = useAppTheme();
  const { t: tAll, tf } = useLanguage();
  const tBox = tAll('addBox');
  const line = normalizeLine(value);
  const showBatch = needsBatch(commodity);
  const showExpiry = needsExpiry(commodity);

  // P22: unit conversion. If the commodity advertises a
  // `unitConversion` table (e.g. { pack: 24 } for a tablet commodity),
  // show a chip selector that lets the user enter qty in either
  // the canonical unit or a derived unit. The form stores the
  // raw input under `inputUnit` and the qty as-typed; the
  // conversion to canonical units happens at save time in
  // `cleanedContents`.
  const conversions = useMemo(() => listConversions(commodity), [commodity]);
  const hasConversions = conversions.length > 0;
  const inputUnit = line.inputUnit || commodity.unit;
  const setInputUnit = (next) => onChange({ ...line, inputUnit: next });

  const setQty = (qty) => onChange({ ...line, qty: Number(qty) || 0 });
  const setBatch = (batchNumber) => onChange({ ...line, batchNumber: batchNumber || null });
  const setExpiry = (expiryDate) => onChange({ ...line, expiryDate: expiryDate || null });
  const setManufacturing = (manufacturingDate) =>
    onChange({ ...line, manufacturingDate: manufacturingDate || null });

  // Chip options: canonical unit first, then any conversions
  // advertised on the commodity. The hint text below the chips
  // shows the conversion factor so the user can sanity-check.
  const unitOptions = useMemo(() => {
    const opts = [{ key: commodity.unit, label: commodity.unit }];
    for (const { unit } of conversions) {
      opts.push({ key: unit, label: unit });
    }
    return opts;
  }, [conversions, commodity.unit]);

  // Build a small "1 pack = 24 tablets" hint for whichever
  // conversion matches the currently selected unit. This shows
  // only when the user picks a non-canonical unit, so the
  // canonical-unit case stays uncluttered.
  const activeConversion = useMemo(
    () => conversions.find((c) => c.unit === inputUnit && c.unit !== commodity.unit),
    [conversions, inputUnit, commodity.unit]
  );
  const unitHint = activeConversion
    ? tf('addBox.unitHint', { unit: activeConversion.unit, qty: activeConversion.factor, base: commodity.unit })
    : null;

  return (
    <View style={lineStyles.wrap}>
      <View style={lineStyles.headerRow}>
        <View style={[lineStyles.iconDot, { backgroundColor: commodity.color || theme.muted }]}>
          <MaterialCommunityIcons
            name={safeIcon(commodity.icon)}
            size={16}
            color={theme.primaryText}
          />
        </View>
        <Text style={[lineStyles.name, { color: theme.text }]}>
          {commodity.name}
          {commodity.required ? <Text style={{ color: theme.danger }}> *</Text> : null}
        </Text>
        <Text style={[lineStyles.unit, { color: theme.muted }]}>{commodity.unit}</Text>
      </View>
      <View style={lineStyles.fieldsRow}>
        <View style={lineStyles.qtyCol}>
          <ThemedTextInput
            label={tBox.qty || 'Qty'}
            value={line.qty ? String(line.qty) : ''}
            onChangeText={setQty}
            keyboardType="numeric"
            accessibilityLabel={`${commodity.name} quantity in ${inputUnit}`}
          />
        </View>
        {hasConversions ? (
          <View style={lineStyles.metaCol}>
            <ChipGroup
              options={unitOptions}
              value={inputUnit}
              onChange={setInputUnit}
              scrollable={false}
              accessibilityLabel={`${commodity.name} unit selector`}
            />
          </View>
        ) : null}
        {showBatch ? (
          <View style={lineStyles.metaCol}>
            <ThemedTextInput
              label={tBox.batchNumber}
              value={line.batchNumber || ''}
              onChangeText={setBatch}
            />
          </View>
        ) : null}
      </View>
      {unitHint ? (
        <Text style={[lineStyles.hint, { color: theme.muted }]}>{unitHint}</Text>
      ) : null}
      {showExpiry ? (
        <View style={lineStyles.fieldsRow}>
          <View style={lineStyles.metaCol}>
            <ThemedTextInput
              label={tBox.expiryDate}
              value={line.expiryDate || ''}
              onChangeText={setExpiry}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </View>
          <View style={lineStyles.metaCol}>
            <ThemedTextInput
              label={tBox.manufacturingDate}
              value={line.manufacturingDate || ''}
              onChangeText={setManufacturing}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const lineStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  iconDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...type.bodyStrong, flex: 1 },
  unit: { ...type.caption },
  fieldsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  qtyCol: { flex: 1 },
  metaCol: { flex: 1 },
  hint: { ...type.caption, marginTop: spacing.xs },
});

export default function AddBox({ navigation }) {
  const { theme } = useAppTheme();
  const { warehouses, currentWarehouse } = useWarehouse();
  const { userData } = useUser();
  const { commodities, loading: commoditiesLoading } = useCommodities();
  const { templates } = useTemplates();
  const { t: tAll } = useLanguage();
  const t = tAll('addBox');

  const [contents, setContents] = useState({});
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorContact, setDonorContact] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState(currentWarehouse?.id || '');
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Default the warehouse selector to the active warehouse whenever it
  // changes. Falls back to the first warehouse if the active one is
  // missing (e.g. user navigated here before context hydrated).
  useEffect(() => {
    if (!selectedWarehouse && (currentWarehouse?.id || warehouses[0]?.id)) {
      // Intentional synchronous setState for initial sync with props.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedWarehouse(currentWarehouse?.id || warehouses[0].id);
    }
  }, [currentWarehouse, warehouses, selectedWarehouse]);

  const warehouseOptions = useMemo(
    () => warehouses.map((wh) => ({ key: wh.id, label: wh.name })),
    [warehouses]
  );

  const templateOptions = useMemo(() => {
    const opts = [{ key: '', label: t.templateNone }];
    for (const tmpl of templates) {
      opts.push({ key: tmpl.id, label: tmpl.name });
    }
    return opts;
  }, [templates, t.templateNone]);

  // Apply a template by writing its commodity map into the form state.
  // The map is `{ commodityId: qty }` — flat shape is fine because the
  // form state stores each line as a normalized object that can carry
  // batch/expiry once the user fills them in.
  const applyTemplate = (id) => {
    setTemplateId(id);
    if (!id) return;
    const tmpl = templates.find((x) => x.id === id);
    if (!tmpl) return;
    setContents((prev) => {
      const next = { ...prev };
      for (const [cid, qty] of Object.entries(tmpl.commodities || {})) {
        const existing = normalizeLine(prev[cid]);
        // Don't clobber a line the user has already started editing
        // unless the qty is still 0.
        if (!existing.qty) {
          next[cid] = { qty: Number(qty) || 0, batchNumber: null, expiryDate: null, manufacturingDate: null };
        }
      }
      return next;
    });
  };

  const handleLineChange = (commodityId, line) => {
    setContents((prev) => {
      const next = { ...prev };
      if (isFlatLine(line) ? line <= 0 : !line || Number(line.qty) <= 0) {
        delete next[commodityId];
      } else {
        next[commodityId] = line;
      }
      return next;
    });
  };

  const handleAddBox = async () => {
    if (busy) return;
    // P22: when the user entered a line in a non-canonical unit
    // (e.g. "2 packs" for a tablet commodity where 1 pack = 24),
    // convert the qty to the canonical unit before saving. The
    // stored line keeps batch/expiry metadata but drops the
    // inputUnit field — it's a form-only signal.
    const commoditiesById = Object.fromEntries(commodities.map((c) => [c.id, c]));
    const cleanedContents = {};
    for (const [k, v] of Object.entries(contents)) {
      const line = normalizeLine(v);
      // `inputUnit` is form-only and not part of normalizeLine's
      // output, so read it off the raw `v` shape.
      const inputUnit = v && typeof v === 'object' ? v.inputUnit : null;
      if (line.qty > 0) {
        const commodity = commoditiesById[k];
        const fromUnit = inputUnit || commodity?.unit;
        const canonicalQty = commodity && fromUnit && fromUnit !== commodity.unit
          ? applyUnitConversion(line.qty, fromUnit, commodity)
          : line.qty;
        cleanedContents[k] = { ...line, qty: canonicalQty };
      }
    }
    if (Object.keys(cleanedContents).length === 0) {
      snackbar.error(t.addAtLeastOne);
      return;
    }
    const errors = validateContents(cleanedContents, commodities, { strict: true });
    if (errors.length > 0) {
      snackbar.error(`${t.validationFailed}: ${errors[0]}`);
      return;
    }
    setBusy(true);
    try {
      const tagsArray = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
      await addDoc(collection(db, 'boxes'), {
        contents: cleanedContents,
        templateId: templateId || null,
        status: 'stored',
        category: category.trim() || null,
        tags: tagsArray,
        donorName: donorName.trim() || null,
        donorContact: donorContact.trim() || null,
        warehouseId: selectedWarehouse || null,
        createdAt: Timestamp.now(),
        createdBy: userData?.id || null,
      });
      await logAction('box_created', { boxId: 'new', lineCount: Object.keys(cleanedContents).length }, userData?.id);
      snackbar.success(t.success);
      navigation.goBack();
    } catch (err) {
      logger.logError('AddBox/save', err);
      snackbar.error(t.failed);
    } finally {
      setBusy(false);
    }
  };

  if (!commoditiesLoading && commodities.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <EmptyState
          icon="package-variant-closed"
          title="No commodities configured"
          message="An admin must set up the commodity catalog before boxes can be created."
          actionLabel="Back"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AmbientGlow variant="topLeft" opacity={0.5} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrap}>
          <FadeInUp delay={0}>
            <ScreenHeader eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />
          </FadeInUp>

          <FadeInUp delay={80}>
            <SurfaceCard>
              {warehouses.length > 1 ? (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.muted }]}>Warehouse</Text>
                  <ChipGroup
                    options={warehouseOptions}
                    value={selectedWarehouse}
                    onChange={setSelectedWarehouse}
                    scrollable={false}
                  />
                </View>
              ) : null}

              {templateOptions.length > 1 ? (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.muted }]}>{t.template}</Text>
                  <ChipGroup
                    options={templateOptions}
                    value={templateId}
                    onChange={applyTemplate}
                    scrollable={false}
                  />
                </View>
              ) : null}

              <Text style={[styles.sectionTitle, { color: theme.muted }]}>{t.contents}</Text>
              {commodities.map((c) => (
                <CommodityLineRow
                  key={c.id}
                  commodity={c}
                  value={contents[c.id]}
                  onChange={(line) => handleLineChange(c.id, line)}
                />
              ))}

              <View style={styles.divider} />

              <ThemedTextInput
                label={t.category}
                value={category}
                onChangeText={setCategory}
              />
              <ThemedTextInput
                label={t.tags}
                value={tags}
                onChangeText={setTags}
              />
              <ThemedTextInput
                label={t.donorName}
                value={donorName}
                onChangeText={setDonorName}
              />
              <ThemedTextInput
                label={t.donorContact}
                value={donorContact}
                onChangeText={setDonorContact}
                keyboardType="phone-pad"
              />

              <Pressable
                onPress={handleAddBox}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t.create}
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: theme.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="plus" size={18} color={theme.primaryText} />
                <Text style={[styles.ctaText, { color: theme.primaryText }]}>{t.create}</Text>
              </Pressable>
            </SurfaceCard>
          </FadeInUp>
        </View>
      </ScrollView>
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
      gap: spacing.lg,
    },
    field: { marginBottom: spacing.md },
    label: { ...type.eyebrow, marginBottom: spacing.sm },
    sectionTitle: {
      ...type.eyebrow,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: spacing.md,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      minHeight: 52,
      marginTop: spacing.md,
    },
    ctaText: { ...type.bodyStrong, textTransform: 'uppercase', letterSpacing: 1.5 },
  });
}
