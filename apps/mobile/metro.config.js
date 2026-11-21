// Expo's default Metro config detects the npm-workspaces monorepo automatically (SDK 52+),
// so @outrank/shared and @outrank/i18n resolve from the repo root.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
