import { version } from '../package.json';

export const environment = {
  appVersion: version,

  // Hub mode configuration
  // 'blacklist' = show all projects except denied ones 
  // 'whitelist' = show only approved/whitelisted projects
  hubMode: 'blacklist' as 'whitelist' | 'blacklist',

  // Admin pubkeys for Nostr deny list management
  // Add hex format pubkeys of administrators who can manage deny lists
  adminPubkeys: [
    '5f432a9f39b58ff132fc0a4c8af10d42efd917d8076f68bb7f2f91ed7d4f6a41', // npub1tapj48eekk8lzvhupfxg4ugdgthaj97cqahk3wml97g76l20dfqspmpjyp
  ] as string[],

  // Hub discovery settings
  // Enable to discover hub configuration from Nostr events
  hubDiscovery: {
    enabled: false,           // Whether to discover hub config from Nostr events
    subjectFilter: 'hub',     // Subject to filter events by
    eventLimit: 10000,        // Max events to fetch for discovery
  },
};
