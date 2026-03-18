import { version } from '../package.json';

/**
 * Runtime config injected by Docker via config.js (loaded before the app bundle).
 * See src/config.js for the template.
 */
interface AngorHubRuntimeConfig {
  adminPubkeys?: string[];
  hubMode?: 'whitelist' | 'blacklist';
}

declare global {
  interface Window {
    __ANGOR_HUB_CONFIG__?: AngorHubRuntimeConfig;
  }
}

const runtimeConfig: AngorHubRuntimeConfig = window.__ANGOR_HUB_CONFIG__ ?? {};

export const environment = {
  appVersion: version,

  // WHITE-LABEL HUB CONFIGURATION
  //
  // To deploy your own hub, either:
  //   A) Edit the defaults below and rebuild, OR
  //   B) Set window.__ANGOR_HUB_CONFIG__ in config.js for Docker deployments
  //      (no rebuild needed -- see src/config.js)
  //
  // 1. Replace adminPubkeys with your own Nostr npub
  // 2. Set hubMode to 'blacklist' (default) - shows all projects,
  //    you then blacklist ones you don't want
  //    Set hubMode to 'whitelist' - shows only featured/approved projects

  // Hub mode configuration
  // 'blacklist' = show all projects except denied ones (default for new hubs)
  // 'whitelist' = show only approved/whitelisted projects
  hubMode: (runtimeConfig.hubMode ?? 'blacklist') as 'whitelist' | 'blacklist',

  // Admin npubs for Nostr deny/whitelist management
  adminPubkeys: (runtimeConfig.adminPubkeys ?? [
    'npub1yedv5vlsnppc6ernqputw4ryf4388tydavca5u23dz47exy0k6ts4xc8md', // test key
  ]) as string[],

  denyListUrl: 'https://lists.blockcore.net/deny/angor.json',
};
