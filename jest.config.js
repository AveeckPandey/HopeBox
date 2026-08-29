// Pure unit tests for services (boxLines, inventoryMath, unitConversion)
// run in Node — no React Native / Expo preset needed.
//
// The top-level babel.config.js is the Metro/RN one (babel-preset-expo);
// we point babel-jest at jest.babel.config.js so tests get a plain
// Node-targeted compile.
module.exports = {
  testMatch: ['**/__tests__/**/*.test.{js,ts}'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './jest.babel.config.js' }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?(react-native|@react-native|@react-navigation|expo|@expo/.*|@expo-google-fonts/.*|react-clone-referenced-element|@sentry/.*|native-base|react-native-svg|expo-constants|expo-modules-core|expo-file-system|expo-linking|expo-application|expo-asset))',
  ],
  moduleFileExtensions: ['js', 'ts', 'json'],
};
