import { collection, addDoc, Timestamp, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { auth, db } from "./firebase";
import { logger } from "./logger";
import { firestoreOnError } from "../hooks/useFirestoreSubscription";

// Resolve the caller's userId. Order of preference:
//   1. The userId argument the caller passed (used by the audit-log
//      reader in AuditLog.js, which passes the *target* of the
//      action, not the actor — that screen knows what it's doing).
//   2. auth.currentUser.uid — the actor on whose behalf the action
//      is being logged. This is the path BoxDetails/ScanQR/etc. take
//      when they call logAction('box_dispatched', { boxId }, userData.id).
//   3. 'anonymous' — we never log as 'system' because the audit
//      rules require userId to match the caller, and a missing UID
//      would mean the call is happening from a code path with no
//      signed-in user. Better to surface that explicitly than to
//      silently attribute it to a fictitious 'system'.
//
// We require `action` to be a non-empty string. Empty actions were
// silently dropped in the previous version, but the schema was
// still letting them through.
export const logAction = async (action, details = {}, userId = null) => {
  if (!action || typeof action !== "string") {
    logger.logWarning("audit/logAction", "missing action string", { actionType: typeof action });
    return;
  }
  const actorId = userId || auth.currentUser?.uid || "anonymous";
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      details,
      userId: actorId,
      timestamp: Timestamp.now()
    });
  } catch (err) {
    logger.logError("audit/logAction", err, { action });
  }
};

export const subscribeToAuditLogs = (callback, maxLogs = 50) => {
  const q = query(
    collection(db, "auditLogs"),
    orderBy("timestamp", "desc"),
    limit(maxLogs)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(logs);
    },
    (err) => firestoreOnError("services/audit/subscribe", err)
  );
};
