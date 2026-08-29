import { initializeApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Resolve a Firebase value with two-stage fallback:
//   1. process.env.EXPO_PUBLIC_*  (inlined into the bundle at build
//      time — the supported path on Expo SDK 50+)
//   2. Constants.expoConfig.extra.*  (works only when app.json
//      is dynamic, e.g. app.config.js; the static `app.json` in
//      this repo leaves ${...} literals, so stage 1 is the
//      reliable one).
//
// Treat empty / whitespace / "undefined" / "null" / unresolved
// `${...}` placeholders as missing so the guard at the bottom
// fails loudly instead of letting garbage reach Firebase.
function clean(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s === "undefined" || s === "null") return null;
  if (s.startsWith("${") && s.endsWith("}")) return null; // unresolved placeholder
  return s;
}

function fromExtra(name) {
  return clean(Constants.expoConfig?.extra?.[name]);
}

const firebaseConfig = {
  apiKey: clean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY) || fromExtra("firebaseApiKey"),
  authDomain:
    clean(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN) || fromExtra("firebaseAuthDomain"),
  projectId:
    clean(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) || fromExtra("firebaseProjectId"),
  storageBucket:
    clean(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET) || fromExtra("firebaseStorageBucket"),
  messagingSenderId:
    clean(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) ||
    fromExtra("firebaseMessagingSenderId"),
  appId: clean(process.env.EXPO_PUBLIC_FIREBASE_APP_ID) || fromExtra("firebaseAppId"),
  measurementId:
    clean(process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID) || fromExtra("firebaseMeasurementId"),
};

if (!firebaseConfig.apiKey) {
  throw new Error(
    "Firebase configuration missing. Fill in .env with your project values, " +
      "then restart Metro with `npx expo start -c`. See .env.example for the expected keys."
  );
}

const app = initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (_e) {
  // initializeAuth can throw on re-initialization (e.g. on hot
  // reload). The fallback `getAuth` returns a working instance.
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
