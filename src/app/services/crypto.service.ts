import { Injectable } from '@angular/core';

// Lazy-loaded modules to avoid blocking app initialization
let bitcoinLib: typeof import('bitcoinjs-lib') | null = null;
let _secpLib: typeof import('@noble/secp256k1') | null = null;
let eccInstance: ReturnType<typeof createEcc> | null = null;
let initialized = false;

// Helper to convert Uint8Array to hex
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to convert hex to Uint8Array
function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function createEcc(secp: typeof import('@noble/secp256k1')) {
  // Get the curve order
  const CURVE_ORDER = secp.CURVE.n;

  return {
    isPoint: (p: Uint8Array): boolean => {
      try {
        // Handle different point formats
        if (p.length === 33) {
          // Compressed point
          if (p[0] !== 0x02 && p[0] !== 0x03) return false;
          secp.Point.fromHex(toHex(p));
          return true;
        } else if (p.length === 65) {
          // Uncompressed point
          if (p[0] !== 0x04) return false;
          secp.Point.fromHex(toHex(p));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },

    isPrivate: (d: Uint8Array): boolean => {
      try {
        if (d.length !== 32) return false;
        const n = BigInt('0x' + toHex(d));
        return n > 0n && n < CURVE_ORDER;
      } catch {
        return false;
      }
    },

    isXOnlyPoint: (p: Uint8Array): boolean => {
      try {
        if (p.length !== 32) return false;
        // Try to construct a point with even y-coordinate
        const fullPointHex = '02' + toHex(p);
        secp.Point.fromHex(fullPointHex);
        return true;
      } catch {
        try {
          // Try with odd y-coordinate
          const fullPointHex = '03' + toHex(p);
          secp.Point.fromHex(fullPointHex);
          return true;
        } catch {
          return false;
        }
      }
    },

    xOnlyPointAddTweak: (p: Uint8Array, tweak: Uint8Array): { parity: 0 | 1; xOnlyPubkey: Uint8Array } | null => {
      try {
        // Assume even y for x-only point
        const fullPointHex = '02' + toHex(p);
        const point = secp.Point.fromHex(fullPointHex);
        const tweakBigInt = BigInt('0x' + toHex(tweak));
        if (tweakBigInt >= CURVE_ORDER) return null;
        const tweakPoint = secp.Point.BASE.multiply(tweakBigInt);
        const result = point.add(tweakPoint);
        const compressed = result.toRawBytes(true);
        const parity = compressed[0] === 0x02 ? 0 : 1;
        return {
          parity: parity as 0 | 1,
          xOnlyPubkey: compressed.slice(1)
        };
      } catch {
        return null;
      }
    },

    pointFromScalar: (d: Uint8Array, compressed?: boolean): Uint8Array | null => {
      try {
        if (d.length !== 32) return null;
        const n = BigInt('0x' + toHex(d));
        if (n === 0n || n >= CURVE_ORDER) return null;
        const pubKey = secp.getPublicKey(d, compressed ?? true);
        return pubKey;
      } catch {
        return null;
      }
    },

    pointCompress: (p: Uint8Array, compressed?: boolean): Uint8Array => {
      try {
        const point = secp.Point.fromHex(toHex(p));
        return point.toRawBytes(compressed ?? true);
      } catch {
        throw new Error('Invalid point');
      }
    },

    pointAddScalar: (p: Uint8Array, tweak: Uint8Array, compressed?: boolean): Uint8Array | null => {
      try {
        const point = secp.Point.fromHex(toHex(p));
        const tweakBigInt = BigInt('0x' + toHex(tweak));
        if (tweakBigInt >= CURVE_ORDER) return null;
        if (tweakBigInt === 0n) {
          return point.toRawBytes(compressed ?? true);
        }
        const tweakPoint = secp.Point.BASE.multiply(tweakBigInt);
        const result = point.add(tweakPoint);
        return result.toRawBytes(compressed ?? true);
      } catch {
        return null;
      }
    },

    privateAdd: (d: Uint8Array, tweak: Uint8Array): Uint8Array | null => {
      try {
        if (d.length !== 32 || tweak.length !== 32) return null;
        const n1 = BigInt('0x' + toHex(d));
        const n2 = BigInt('0x' + toHex(tweak));
        let sum = (n1 + n2) % CURVE_ORDER;
        // Handle negative results 
        if (sum < 0n) sum += CURVE_ORDER;
        if (sum === 0n) return null;
        const hex = sum.toString(16).padStart(64, '0');
        return fromHex(hex);
      } catch {
        return null;
      }
    },

    sign: (h: Uint8Array, d: Uint8Array, _e?: Uint8Array): Uint8Array => {
      // Sign with lowS option and return compact format 
      const sig = secp.sign(h, d, { lowS: true });
      return sig.toCompactRawBytes();
    },

    verify: (h: Uint8Array, Q: Uint8Array, signature: Uint8Array, _strict?: boolean): boolean => {
      try {
        // Handle both 64-byte compact and other signature formats
        let sig: InstanceType<typeof secp.Signature>;
        if (signature.length === 64) {
          sig = secp.Signature.fromCompact(signature);
        } else {
          // Try to parse as bytes (which handles compact format)
          sig = secp.Signature.fromBytes(signature);
        }
        return secp.verify(sig, h, Q, { lowS: true });
      } catch {
        return false;
      }
    }
  };
}

export async function initCrypto(): Promise<void> {
  if (initialized) return;

  try {
    // Dynamic imports to avoid blocking app initialization
    const [bitcoin, secp] = await Promise.all([
      import('bitcoinjs-lib'),
      import('@noble/secp256k1')
    ]);

    bitcoinLib = bitcoin;
    _secpLib = secp;

    // Create ECC implementation
    eccInstance = createEcc(secp);

    // Validate ECC implementation before initializing bitcoinjs-lib
    const testPrivKey = new Uint8Array(32);
    testPrivKey[31] = 1;

    if (!eccInstance.isPrivate(testPrivKey)) {
      throw new Error('ECC isPrivate validation failed');
    }

    const testPubKey = eccInstance.pointFromScalar(testPrivKey, true);
    if (!testPubKey || !eccInstance.isPoint(testPubKey)) {
      throw new Error('ECC pointFromScalar/isPoint validation failed');
    }

    // Initialize bitcoinjs-lib with our ECC implementation
    bitcoin.initEccLib(eccInstance as Parameters<typeof bitcoin.initEccLib>[0]);
    initialized = true;
    console.log('Crypto library initialized successfully');
  } catch (err) {
    console.error('Failed to initialize crypto library:', err);
    throw err;
  }
}

export function getEcc() {
  if (!eccInstance) {
    throw new Error('Crypto not initialized. Call initCrypto() first.');
  }
  return eccInstance;
}

export function getBitcoin() {
  if (!bitcoinLib) {
    throw new Error('Crypto not initialized. Call initCrypto() first.');
  }
  return bitcoinLib;
}

export function isInitialized(): boolean {
  return initialized;
}

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private initPromise: Promise<void> | null = null;

  async ensureInitialized(): Promise<void> {
    if (initialized) return;

    if (!this.initPromise) {
      this.initPromise = initCrypto();
    }

    await this.initPromise;
  }

  sign(hash: Buffer, privateKey: Buffer): Buffer {
    const ecc = getEcc();
    return Buffer.from(ecc.sign(hash, privateKey));
  }

  verify(hash: Buffer, publicKey: Buffer, signature: Buffer): boolean {
    const ecc = getEcc();
    return ecc.verify(hash, publicKey, signature);
  }

  getPublicKey(privateKey: Buffer, compressed = true): Buffer {
    const ecc = getEcc();
    const result = ecc.pointFromScalar(privateKey, compressed);
    if (!result) throw new Error('Invalid private key');
    return Buffer.from(result);
  }
}
