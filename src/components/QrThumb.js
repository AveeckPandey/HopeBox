import { useEffect, useState } from 'react';
import { InteractionManager, View } from 'react-native';

// Tiny QR thumbnail wrapper that defers mounting the heavy
// `react-native-qrcode-svg` module until the current interaction
// burst settles. Each row in Boxes.js is in a FlatList cell, so
// without this delay the QR library is imported and rendered
// inside the same commit that fires the scroll/list interactions,
// which is the main source of "scrolling jank on first load".
//
// Why a wrapper instead of a conditional import in Boxes.js:
//   - Boxes.js already imports dozens of Firebase + RN modules,
//     so splitting one more behind a dynamic import is a clean win.
//   - The placeholder keeps the row layout stable (no jump when
//     the QR appears), which matters more than saving the render
//     itself.
//   - If a future change moves the QR into an "expand" affordance,
//     this component is the right boundary — just hide the
//     placeholder instead.
//
// Mount semantics:
//   - On the first render we return a transparent placeholder the
//     same size as the QR.
//   - After `InteractionManager.runAfterInteractions` resolves, we
//     `require('react-native-qrcode-svg')` and re-render with the
//     real QR.
//   - On unmount we drop the import reference so the next mount
//     re-loads (rare; mostly a backstop for screens that re-mount
//     when their props change).
const QR_SIZE = 84;

export default function QrThumb({ value, size = QR_SIZE, backgroundColor = '#FFFFFF' }) {
  const [Component, setComponent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      // Dynamic require keeps the QR module out of the initial
      // module-evaluation graph for Boxes.js. The require is
      // idempotent — Metro caches it after the first call.
      const QR = require('react-native-qrcode-svg').default;
      setComponent(() => QR);
    });
    return () => {
      cancelled = true;
      if (handle && typeof handle.cancel === 'function') handle.cancel();
      setComponent(null);
    };
  }, [value]);

  if (!Component) {
    // Reserve the same footprint so the row doesn't reflow when
    // the QR pops in.
    return <View style={{ width: size, height: size, backgroundColor }} />;
  }
  return <Component value={value} size={size} color="#000000" backgroundColor={backgroundColor} />;
}
