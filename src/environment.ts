import { version } from '../package.json';

export const environment = {
  appVersion: version,
  // Admin pubkeys for Nostr deny list management
  // Add hex format pubkeys of administrators who can manage deny lists
  adminPubkeys: [
    '5f432a9f39b58ff132fc0a4c8af10d42efd917d8076f68bb7f2f91ed7d4f6a41', // npub1tapj48eekk8lzvhupfxg4ugdgthaj97cqahk3wml97g76l20dfqspmpjyp
  ] as string[],
};
