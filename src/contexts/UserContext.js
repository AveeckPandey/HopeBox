import { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../services/firebase";
import { logger } from "../services/logger";
import { onAuthStateChanged } from "firebase/auth";

const UserContext = createContext({
  userRole: null,
  userData: null,
  loading: true,
  isAdmin: false,
  canEdit: false
});

export function UserProvider({ children }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!firebaseUser) {
        setUserData(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", firebaseUser.uid);

      try {
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // First-time login. SignUp.js wrote {name, email, createdAt}
          // but deliberately omitted `role` so security rules cannot
          // be tricked into self-promotion. If the doc truly doesn't
          // exist (e.g. older account pre-dating this code path),
          // create a minimal viewer doc.
          await setDoc(userRef, {
            email: firebaseUser.email,
            name: firebaseUser.displayName || "",
            createdAt: new Date().toISOString()
          }, { merge: true });

          setUserData({
            id: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || "",
            role: "viewer"
          });
        } else {
          // Existing doc. If `role` is missing (e.g. a fresh signup
          // before admin promotion), treat as `viewer` so the user
          // can still see data — read-only until an admin promotes
          // them.
          const data = userSnap.data();
          setUserData({
            id: firebaseUser.uid,
            ...data,
            role: data.role || "viewer"
          });
        }
      } catch (err) {
        logger.logError("UserContext/roleLookup", err, { uid: auth.currentUser?.uid });
        // Fail safe: a user with no resolvable role is a viewer.
        setUserData({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || "",
          role: "viewer"
        });
      }

      setLoading(false);

      unsubscribeDoc = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setUserData((prev) => {
            const newData = { id: firebaseUser.uid, ...snap.data() };
            if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
            return newData;
          });
        }
      });
    });

    return () => {
      if (unsubscribeDoc) unsubscribeDoc();
      unsubscribeAuth();
    };
  }, []);

  const role = userData?.role || "viewer";
  const value = {
    userRole: role,
    userData,
    loading,
    isAdmin: role === "admin",
    canEdit: role === "admin" || role === "staff"
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
