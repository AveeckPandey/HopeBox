import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './logger';
import { DEFAULT_COMMODITY_IDS } from './commodities';

// /config/boxTemplates/{templateId}
//
//   name:        "Standard Food Box"
//   commodities: { commodityId: qty, ... }   // map of commodityId → default quantity
//   default:     true                         // one template should be flagged default
//   program:     "general" | "child_meal" | "medical_kit" | ...
//   createdAt, updatedAt
//
// Box templates are *defaults* — a user can override the per-line qty
// when creating a box. The template just gives the right starting point.

const COLLECTION = 'boxTemplates';

export const DEFAULT_TEMPLATE_ID = 'template_standard';

export const DEFAULT_TEMPLATE = {
  id: DEFAULT_TEMPLATE_ID,
  name: 'Standard Food Box',
  program: 'general',
  default: true,
  commodities: {
    [DEFAULT_COMMODITY_IDS.rice]: 20,
    [DEFAULT_COMMODITY_IDS.dal]: 20,
    [DEFAULT_COMMODITY_IDS.sachets]: 50,
  },
};

// Subscribe to all templates.
export function subscribeTemplates(callback) {
  const q = query(collection(db, COLLECTION), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      logger.logWarning('boxTemplates/subscribe', err.message);
      callback([]);
    }
  );
}

export async function fetchTemplates() {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveTemplate(template, id = null) {
  const payload = {
    name: String(template.name || 'Untitled template').trim(),
    program: String(template.program || 'general').trim(),
    default: Boolean(template.default),
    commodities: sanitizeCommodityMap(template.commodities || {}),
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await setDoc(doc(db, COLLECTION, id), payload, { merge: true });
    return id;
  }
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteTemplate(id) {
  // Same soft-delete approach as commodities — keeps history.
  await setDoc(doc(db, COLLECTION, id), { _deleted: true, updatedAt: serverTimestamp() }, { merge: true });
}

export async function seedDefaultTemplateIfEmpty() {
  const existing = await fetchTemplates();
  if (existing.length > 0) return;
  await setDoc(doc(db, COLLECTION, DEFAULT_TEMPLATE_ID), {
    name: DEFAULT_TEMPLATE.name,
    program: DEFAULT_TEMPLATE.program,
    default: true,
    commodities: DEFAULT_TEMPLATE.commodities,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function sanitizeCommodityMap(map) {
  const out = {};
  Object.entries(map || {}).forEach(([k, v]) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  });
  return out;
}
