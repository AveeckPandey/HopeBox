import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './logger';

// /commodities/{commodityId}
//
//   name:           "Rice"
//   unit:           "kg" | "tablet" | "vial" | "pack" | "L" | "unit"
//   icon:           "grain"               // MaterialCommunityIcons name
//   color:          "#FF6B35"             // hex
//   category:       "food" | "therapeutic" | "hygiene" | "medical" | "agriculture" | "other"
//   defaultPerBox:  20                    // default qty used in a standard box template
//   required:       true                  // must be entered when creating a box
//   sortOrder:      1
//   expiryTracking: false                 // when true, every box line must carry batchNumber + expiryDate
//   batchTracking:  false                 // when true, every box line must carry a batchNumber
//   createdAt, updatedAt                   // server timestamps
//
// The `unit` field is the *display* unit. Cross-unit math (1 bottle = 100 tablets)
// is NOT handled in v2.0 — admins should create one commodity per presentation
// (e.g. "Amoxicillin 250mg (bottle of 100)") if the inner unit matters.
//
// `category` is a free-form string; the suggested enum is above. The UI filters
// by it on the Admin screen.

const COLLECTION = 'commodities';

// Default commodity set seeded for new organizations. The IDs are stable
// so existing box templates can keep referring to them across deploys.
export const DEFAULT_COMMODITY_IDS = {
  rice: 'commodity_rice',
  dal: 'commodity_dal',
  sachets: 'commodity_sachets',
  // Four medical samples so the org can see the model supports pharma
  // before customizing their own list. None of these are required.
  amoxicillin: 'commodity_amoxicillin',
  rutf: 'commodity_rutf',
  ors: 'commodity_ors',
  hygieneKit: 'commodity_hygiene_kit',
};

export const DEFAULT_COMMODITIES = [
  {
    id: DEFAULT_COMMODITY_IDS.rice,
    name: 'Rice',
    unit: 'kg',
    icon: 'grain',
    color: '#E0A458',
    category: 'food',
    defaultPerBox: 20,
    required: true,
    sortOrder: 1,
    expiryTracking: false,
    batchTracking: false,
  },
  {
    id: DEFAULT_COMMODITY_IDS.dal,
    name: 'Dal',
    unit: 'kg',
    icon: 'seed',
    color: '#C97A4A',
    category: 'food',
    defaultPerBox: 20,
    required: true,
    sortOrder: 2,
    expiryTracking: false,
    batchTracking: false,
  },
  {
    id: DEFAULT_COMMODITY_IDS.sachets,
    name: 'Sachets',
    unit: 'pack',
    icon: 'package-variant',
    color: '#5BA8A0',
    category: 'food',
    defaultPerBox: 50,
    required: true,
    sortOrder: 3,
    expiryTracking: true,
    batchTracking: false,
  },
  {
    id: DEFAULT_COMMODITY_IDS.amoxicillin,
    name: 'Amoxicillin 250mg',
    unit: 'pack',
    icon: 'pill',
    color: '#C25450',
    category: 'medical',
    defaultPerBox: 1,
    required: false,
    sortOrder: 10,
    expiryTracking: true,
    batchTracking: true,
  },
  {
    id: DEFAULT_COMMODITY_IDS.rutf,
    name: 'RUTF (Plumpy\'nut)',
    unit: 'pack',
    icon: 'food-apple',
    color: '#F0A35E',
    category: 'therapeutic',
    defaultPerBox: 0,
    required: false,
    sortOrder: 11,
    expiryTracking: true,
    batchTracking: true,
  },
  {
    id: DEFAULT_COMMODITY_IDS.ors,
    name: 'ORS sachets',
    unit: 'pack',
    icon: 'water',
    color: '#4A8FB8',
    category: 'medical',
    defaultPerBox: 0,
    required: false,
    sortOrder: 12,
    expiryTracking: true,
    batchTracking: true,
  },
  {
    id: DEFAULT_COMMODITY_IDS.hygieneKit,
    name: 'Hygiene kit',
    unit: 'unit',
    icon: 'hand-wash',
    color: '#8A6FB0',
    category: 'hygiene',
    defaultPerBox: 0,
    required: false,
    sortOrder: 20,
    expiryTracking: false,
    batchTracking: false,
  },
];

// Subscribe to the full commodity list. Sorted by sortOrder then name.
export function subscribeCommodities(callback) {
  const q = query(collection(db, COLLECTION), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (err) => {
      logger.logWarning('commodities/subscribe', err.message);
      callback([]);
    }
  );
}

// One-shot fetch — used by the admin screen when checking
// "is this commodity referenced by any box?" before delete.
export async function fetchCommodities() {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Create or update a commodity. `id` is optional — if missing, a new
// document is created with a Firestore-generated id.
export async function saveCommodity(commodity, id = null) {
  const payload = sanitizeCommodity(commodity);
  if (id) {
    const ref = doc(db, COLLECTION, id);
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    return id;
  }
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// Delete a commodity. Returns true on success. Caller is responsible
// for the "is it referenced?" check (FR-COMM-4) — this service layer
// doesn't reach into boxes to verify.
export async function deleteCommodity(id) {
  await setDoc(doc(db, COLLECTION, id), { _deleted: true, updatedAt: serverTimestamp() }, { merge: true });
  // Hard-delete is left to admin tools; soft-delete keeps audit history.
}

// Seed the default commodity set for a fresh org. Idempotent: only
// creates documents that don't already exist (matches by id).
export async function seedDefaultCommoditiesIfEmpty() {
  const existing = await fetchCommodities();
  const existingIds = new Set(existing.map((c) => c.id));
  for (const c of DEFAULT_COMMODITIES) {
    if (existingIds.has(c.id)) continue;
    const ref = doc(db, COLLECTION, c.id);
    await setDoc(ref, {
      name: c.name,
      unit: c.unit,
      icon: c.icon,
      color: c.color,
      category: c.category,
      defaultPerBox: c.defaultPerBox,
      required: c.required,
      sortOrder: c.sortOrder,
      expiryTracking: c.expiryTracking,
      batchTracking: c.batchTracking,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

// Strip unknown fields, apply defaults, coerce numbers. Keeps the
// service boundary tight: callers can pass UI-shaped data and we
// return a Firestore-shaped record.
function sanitizeCommodity(input) {
  return {
    name: String(input.name || '').trim(),
    unit: String(input.unit || 'unit').trim(),
    icon: String(input.icon || 'package-variant').trim(),
    color: typeof input.color === 'string' ? input.color : '#888888',
    category: String(input.category || 'other').trim(),
    defaultPerBox: Number(input.defaultPerBox) || 0,
    required: Boolean(input.required),
    sortOrder: Number(input.sortOrder) || 100,
    expiryTracking: Boolean(input.expiryTracking),
    batchTracking: Boolean(input.batchTracking),
  };
}

// Convenience: is this commodity a medical/pharma one?
export function isMedical(commodity) {
  return commodity && (commodity.category === 'medical' || commodity.category === 'therapeutic');
}

// Convenience: does this commodity require expiry date when filling
// a box line? Used by AddBox/EditBox for per-line validation.
export function needsExpiry(commodity) {
  return Boolean(commodity && commodity.expiryTracking);
}
export function needsBatch(commodity) {
  return Boolean(commodity && commodity.batchTracking);
}

// Resolve a safe MaterialCommunityIcons name for a commodity.
// `@expo/vector-icons` logs `"X" is not a valid icon name` and
// silently falls back to a blank box when the name isn't in the
// shipped glyphmap. That makes a typo (e.g. 'soap') invisible in
// the UI but very loud in the console. We cache the glyphmap at
// module load and route unknown names to a neutral fallback.
let mciGlyphs = null;
let mciLoading = null;

async function loadGlyphMap() {
  if (mciGlyphs) return mciGlyphs;
  if (mciLoading) return mciLoading;
  try {
    // The glyphmap ships with @expo/vector-icons. Resolved at runtime
    // so we don't need to add the dep directly to package.json.
    mciLoading = import(
      '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json'
    )
      .then((mod) => {
        mciGlyphs = mod.default || mod;
        return mciGlyphs;
      })
      .catch(() => {
        mciGlyphs = {}; // empty → always fall back
        return mciGlyphs;
      });
    return await mciLoading;
  } catch {
    mciGlyphs = {};
    return mciGlyphs;
  }
}

export const FALLBACK_ICON = 'package-variant';

// Returns `icon` if it is a known MaterialCommunityIcons name, else
// FALLBACK_ICON. Synchronous fast-path: if the map is already loaded
// (e.g. after the first render), this is a single object lookup.
export function safeIcon(icon) {
  if (!icon) return FALLBACK_ICON;
  if (!mciGlyphs) {
    // Kick off the load; meanwhile be permissive. Subsequent renders
    // after the map resolves will correct any wrong name silently.
    loadGlyphMap();
    return icon;
  }
  return Object.prototype.hasOwnProperty.call(mciGlyphs, icon) ? icon : FALLBACK_ICON;
}
