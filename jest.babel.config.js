// Jest-only Babel config. The top-level `babel.config.js` is the
// Metro/RN one (babel-preset-expo); Jest is configured to use this
// file via its `transform` option so that unit tests get a plain
// Node-targeted compile without the Expo preset.
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
};
