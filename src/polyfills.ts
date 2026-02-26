import { Buffer } from 'buffer';

// Make Buffer available globally in the browser
(window as any)['Buffer'] = Buffer;
(globalThis as any)['Buffer'] = Buffer;
