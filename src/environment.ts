import { version } from '../package.json';

export const environment = {
  appVersion: version,


  // WHITE-LABEL HUB CONFIGURATION
 
  // To deploy your own hub, change the settings below:
  //
  // 1. Replace adminPubkeys with your own Nostr hex pubkey(s)
  //    (you can convert npub to hex at https://nostrcheck.me/converter/)
  // 2. Set hubMode to 'blacklist' (default) - shows all projects,
  //    you then blacklist ones you don't want
  // 3. Set denyListUrl to '' to skip the default Angor deny list,
  //    or point it to your own deny list JSON URL
 

  // Hub mode configuration
  // 'blacklist' = show all projects except denied ones (default for new hubs)
  // 'whitelist' = show only approved/whitelisted projects
  hubMode: 'blacklist' as 'whitelist' | 'blacklist',

  // Admin pubkeys for Nostr deny/whitelist management
  adminPubkeys: [
    '5f432a9f39b58ff132fc0a4c8af10d42efd917d8076f68bb7f2f91ed7d4f6a41', // npub1tapj48eekk8lzvhupfxg4ugdgthaj97cqahk3wml97g76l20dfqspmpjyp
  ] as string[],

  denyListUrl: 'https://lists.blockcore.net/deny/angor.json',

  // Hub discovery settings
  hubDiscovery: {
    enabled: false,           // Whether to discover hub config from Nostr events
    subjectFilter: 'hub',     // Subject to filter events by
    eventLimit: 10000,        // Max events to fetch for discovery
  },
};
