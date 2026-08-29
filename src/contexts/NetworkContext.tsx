// P25: network status. Surfaces online/offline state to the rest
// of the app via a tiny context. We try to load `@react-native-
// community/netinfo` at runtime; if it isn't installed, the
// provider quietly reports "online" (the optimistic default —
// failing closed would block the user from doing anything the
// first time they install the app without the optional dep).
//
// The OfflineBanner reads `isOffline` from this context.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

let NetInfo = null;
try {
  // Optional dependency. If the host app hasn't installed
  // @react-native-community/netinfo we degrade to "always online"
  // rather than throwing at import time.
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  NetInfo = null;
}

const NetworkContext = createContext({
  isOffline: false,
  isReady: false,
});

export function NetworkProvider({ children }) {
  const [isOffline, setIsOffline] = useState(false);
  const [isReady, setIsReady] = useState(NetInfo == null);

  useEffect(() => {
    if (NetInfo == null) return undefined;
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
      setIsReady(true);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(() => ({ isOffline, isReady }), [isOffline, isReady]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}

export default NetworkContext;
