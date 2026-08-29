// Pure unit tests for services (boxLines, inventoryMath, unitConversion)
// run in Node — no React Native / Expo preset needed.

module.exports = {
  testMatch: ['**/__tests__/**/*.test.js'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?(react-native|@react-native|@react-navigation|expo|@expo/.*|@expo-google-fonts/.*|react-clone-referenced-element|@sentry/.*|sentry-expo|native-base|react-native-svg|expo-constants|expo-modules-core|expo-file-system|expo-linking|expo-application|expo-asset))',
  ],
  moduleFileExtensions: ['js', 'ts', 'json'],
};