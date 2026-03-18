/**
 * Angor Hub Runtime Configuration
 *
 * This file is loaded before the Angular app bundle and allows
 * Docker deployments to override hub settings without rebuilding.
 *
 * Usage (Docker):
 *   Mount this file at /app/host/dist/browser/config.js
 *   with your own values (see docker-compose.yml volumes example).
 *
 * Example:
 *   window.__ANGOR_HUB_CONFIG__ = {
 *     adminPubkeys: ['npub1...your_admin_npub'],
 *     hubMode: 'whitelist',
 *   };
 *
 * If this file is left as-is (no config set), the defaults in
 * environment.ts are used.
 */

// Uncomment and edit to override defaults:
// window.__ANGOR_HUB_CONFIG__ = {
//   adminPubkeys: ['npub1...'],
//   hubMode: 'blacklist',
// };
