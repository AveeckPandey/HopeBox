import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';

import { db } from '../../services/firebase';
import { useAppTheme } from '../../theme/AppThemeContext';
import { useUser } from '../../contexts/UserContext';
import { useCommodities } from '../../contexts/CommoditiesContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { logAction } from '../../services/audit';
import { snackbar } from '../../hooks/useSnackbar';
import { needsBatch, needsExpiry, safeIcon } from '../../services/commodities';
import { isFlatLine, normalizeLine, validateContents } from '../../services/boxLines';
import { applyUnitConversion, listConversions } from '../../services/unitConversion';
import { logger } from '../../services/logger';

import ScreenHeader from '../../components/ScreenHeader';
import SurfaceCard from '../../components/SurfaceCard';
import ThemedTextInput from '../../components/ThemedTextInput';
import EmptyState from '../../components/EmptyState';
import FadeInUp from '../../components/FadeInUp';
import AmbientGlow from '../../components/AmbientGlow';
import ChipGroup from '../../components/ChipGroup';
import { layout, radius, spacing, type } from '../../theme/tokens';

// Same row as AddBox — duplicated rather than extracted to a shared
// file because the two screens evolve independently (AddBox owns the
// template-selector UX, EditBox will eventually own delete-history UX).
function CommodityLineRow({ commodity, value, onChange }) {
  const { theme } = useAppTheme();
  const { t: tAll, tf } = useLanguage();
  const tBox = tAll('addBox');
  const line = normalizeLine(value);
  const showBatch = needsBatch(commodity);
  const showExpiry = needsExpiry(commodity);

  // P22: unit conversion. Mirrors the AddBox row so the user can
  // edit an existing box using whatever unit they originally typed
  // in. The form-only `inputUnit` field carries the working unit;
  // we apply the conversion to canonical at save time.
  const conversions = useMemo(() => listConversions(commodity), [commodity]);
  const hasConversions = conversions.length > 0;
  const inputUnit = line.inputUnit || commodity.unit;
  const setInputUnit = (next) => onChange({ ...line, inputUnit: next });

  const setQty = (qty) => onChange({ ...line, qty: Number(qty) || 0 });
  const setBatch = (batchNumber) => onChange({ ...line, batchNumber: batchNumber || null });
  const setExpiry = (expiryDate) => onChange({ ...line, expiryDate: expiryDate || null });
  const setManufacturing = (manufacturingDate) =>
    onChange({ ...line, manufacturingDate: manufacturingDate || null });

  const unitOptions = useMemo(() => {
    const opts = [{ key: commodity.unit, label: commodity.unit }];
    for (const { unit } of conversions) {
      opts.push({ key: unit, label: unit });
    }
    return opts;
  }, [conversions, commodity.unit]);

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
            name={safeIcon(commodity.icon) as any}
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

// Pull the line state for a commodity out of either the new
// `box.contents` map or one of the legacy `box.rice`/`box.dal`/
// `box.sachets` fields. The fallback ensures boxes written by the
// pre-v2.0 form still render with their values intact.
function lineForRoute(commodity, item) {
  if (item.contents && item.contents[commodity.id] != null) {
    return item.contents[commodity.id];
  }
  const legacyKey = commodity.legacyKey; // optional, see below
  if (legacyKey && item[legacyKey] != null) {
    return item[legacyKey];
  }
  return null;
}

export default function EditBox({ route, navigation }) {
  const { theme } = useAppTheme();
  const { userData } = useUser();
  const { commodities, loading: commoditiesLoading } = useCommodities();
  const { t: tAll } = useLanguage();
  const t = tAll('editBox');
  const tAdd = tAll('addBox');

  // The early-return guard runs *after* every hook below, so React's
  // rules of hooks remain satisfied even if the user deep-linked here
  // without a `params.item`.
  const routeItem = route?.params?.item;
  const initialContents = useMemo(() => {
    if (!routeItem) return {};
    const out = {};
    for (const c of commodities) {
      const v = lineForRoute(c, routeItem);
      if (v != null) out[c.id] = normalizeLine(v);
    }
    return out;
  }, [routeItem, commodities]);

  const [contents, setContents] = useState(initialContents);
  const [category, setCategory] = useState(routeItem?.category || '');
  const [tags, setTags] = useState((routeItem?.tags || []).join(', '));
  const [donorName, setDonorName] = useState(routeItem?.donorName || '');
  const [donorContact, setDonorContact] = useState(routeItem?.donorContact || '');
  const [busy, setBusy] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!routeItem) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <EmptyState
          icon="cube-outline"
          title="No box selected"
          message="Pick a box from the registry to edit its contents."
          actionLabel="Back to boxes"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const item = routeItem;

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

  const handleUpdate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // P22: apply unit conversion (the AddBox flow's `inputUnit`
      // field can be carried into an edit session when the user
      // re-opens a box). Read the form-only `inputUnit` from the
      // raw `v` because `normalizeLine` drops it. The form state
      // is a wide `Record<string, any>` (commodity id → line), so
      // TS sees `v` as `any` here; we narrow with a runtime guard
      // and cast to a `string | null` for the conversion call.
      const commoditiesById = Object.fromEntries(commodities.map((c) => [c.id, c]));
      const cleanedContents = {};
      for (const [k, v] of Object.entries(contents)) {
        const line = normalizeLine(v);
        const inputUnit =
          v && typeof v === 'object' && 'inputUnit' in (v as object)
            ? ((v as { inputUnit?: string | null }).inputUnit ?? null)
            : null;
        if (line.qty > 0) {
          const commodity = commoditiesById[k];
          const fromUnit = inputUnit || commodity?.unit;
          const canonicalQty = commodity && fromUnit && fromUnit !== commodity.unit
            ? applyUnitConversion(line.qty, fromUnit, commodity)
            : line.qty;
          cleanedContents[k] = { ...line, qty: canonicalQty };
        }
      }
      const errors = validateContents(cleanedContents, commodities, { strict: false });
      if (errors.length > 0) {
        snackbar.error(`${tAdd.validationFailed}: ${errors[0]}`);
        setBusy(false);
        return;
      }
      const tagsArray = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
      await updateDoc(doc(db, 'boxes', item.id), {
        contents: cleanedContents,
        category: category.trim() || null,
        tags: tagsArray,
        donorName: donorName.trim() || null,
        donorContact: donorContact.trim() || null,
      });
      await logAction('box_updated', { boxId: item.id }, userData?.id);
      snackbar.success(t.success);
      navigation.goBack();
    } catch (err) {
      logger.logError('EditBox/save', err, { boxId: item.id });
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
          message="An admin must set up the commodity catalog before boxes can be edited."
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
            <ScreenHeader eyebrow={t.eyebrow} title={t.title} subtitle={`${t.subtitle} (${item.id})`} />
          </FadeInUp>
          <FadeInUp delay={80}>
            <SurfaceCard>
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

              <ThemedTextInput label={tAdd.category} value={category} onChangeText={setCategory} />
              <ThemedTextInput label={tAdd.tags} value={tags} onChangeText={setTags} />
              <ThemedTextInput label={tAdd.donorName} value={donorName} onChangeText={setDonorName} />
              <ThemedTextInput
                label={tAdd.donorContact}
                value={donorContact}
                onChangeText={setDonorContact}
                keyboardType="phone-pad"
              />

              <Pressable
                onPress={handleUpdate}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t.save}
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: theme.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="content-save-outline" size={18} color={theme.primaryText} />
                <Text style={[styles.ctaText, { color: theme.primaryText }]}>{t.save}</Text>
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
