import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import * as secp from '@noble/secp256k1';
import { bech32 } from '@scure/base';
import { Subscription } from 'rxjs';
 import { hexToBytes ,bytesToHex } from '@noble/hashes/utils';

export function sleep(durationInMillisecond: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationInMillisecond));
}

export function now() {
  return Math.floor(Date.now() / 1000);
}

@Injectable({
  providedIn: 'root',
})
export class Utilities {
  constructor(private snackBar: MatSnackBar, private sanitizer: DomSanitizer) {}

  unsubscribe(subscriptions: Subscription[]) {
    if (!subscriptions) {
      return;
    }

    for (let i = 0; i < subscriptions.length; i++) {
      subscriptions[i].unsubscribe();
    }
  }

  now() {
    return Math.floor(Date.now() / 1000);
  }



  defaultBackground = 'url(/assets/gradient.jpg)';

  getBannerBackgroundStyle(banner?: string) {
    if (!banner) {
      return this.defaultBackground;
    }

    if (typeof banner === 'string') {
      const url = this.sanitizeImageUrl(banner);

      if (!url) {
        return this.defaultBackground;
      }

      return `url(${url})`;
    } else {
      return `url(${this.bypassStyle(banner)})`;
    }
  }




  millisatoshisToSatoshis(millisatoshis: number) {
    return Math.floor(millisatoshis / 1000);
  }


  getRelayUrls(relays: any) {
    let preparedRelays = relays;

    if (Array.isArray(preparedRelays)) {
      preparedRelays = {};

      for (let i = 0; i < relays.length; i++) {
        preparedRelays[relays[i]] = {};
      }
    }

    const entries = Object.keys(preparedRelays);
    return entries;
  }

  getNostrIdentifier(pubkey: string) {
    try {
      const key = this.hexToArray(pubkey);
      const converted = this.convertToBech32(key, 'npub');
      return converted;
    } catch (err) {
      return pubkey;
    }
  }

  copy(text: string) {
    this.copyToClipboard(text);

    this.snackBar.open('Copied to clipboard', 'Hide', {
      duration: 2500,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
  copyToClipboard(content: string) {
    var textArea = document.createElement('textarea') as any;

    // Place in the top-left corner of screen regardless of scroll position.
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;

    // Ensure it has a small width and height. Setting to 1px / 1em
    // doesn't work as this gives a negative w/h on some browsers.
    textArea.style.width = '2em';
    textArea.style.height = '2em';

    // We don't need padding, reducing the size if it does flash render.
    textArea.style.padding = 0;

    // Clean up any borders.
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';

    // Avoid flash of the white box if rendered for any reason.
    textArea.style.background = 'transparent';
    textArea.value = content;

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      var successful = document.execCommand('copy');
      var msg = successful ? 'successful' : 'unsuccessful';
    } catch (err) {
      console.error('Oops, unable to copy');
    }

    document.body.removeChild(textArea);
  }
  getHexIdentifier(pubkey: string) {
    const key = this.hexToArray(pubkey);
    const converted = this.convertToBech32(key, 'npub');
    return converted;
  }

  getShortenedIdentifier(pubkey: string) {
    const fullId = this.getNostrIdentifier(pubkey);
    return `${fullId.substring(5, 13)}:${fullId.substring(fullId.length - 8)}`;
  }

  private convertToBech32(key: Uint8Array, prefix: string) {
    const words = bech32.toWords(key);
    const value = bech32.encode(prefix, words);

    return value;
  }

  private hexToArray(value: string) {
    return  hexToBytes(value);
  }

  arrayToHex(value: Uint8Array) {
    return bytesToHex(value);
  }

  keyToHex(publicKey: Uint8Array) {
    return bytesToHex(publicKey);
  }

  sanitizeLUD06(url?: string) {
    // Do not allow http prefix.
    if (!url) {
      return undefined;
    }

    if (url.startsWith('http')) {
      return undefined;
    }

    return this.bypassUrl(url);
  }

  sanitizeUrlAndBypass(url?: string) {
    const cleanedUrl = this.sanitizeUrl(url);
    return this.bypassUrl(cleanedUrl);
  }

  sanitizeUrlAndBypassFrame(url?: string) {
    const cleanedUrl = this.sanitizeUrl(url);
    return this.bypassFrameUrl(cleanedUrl);
  }

  sanitizeUrl(url?: string, appendHttpsIfMissing?: boolean) {
    if (!url) {
      return '';
    }

    if (!url?.startsWith('http')) {
      if (appendHttpsIfMissing) {
        url = 'https://' + url;
      } else {
        // Local file, maybe attempt at loading local scripts/etc?
        // Verify that the URL must start with /assets.
        if (url.startsWith('/assets')) {
          return url;
        } else {
          return '';
        }
      }
    }

    return url;
  }

  sanitizeImageUrl(url?: string) {
    url = this.sanitizeUrl(url);

    if (!url) {
      return undefined;
    }

    let urlLower = url.toLowerCase();
    urlLower = urlLower.split('?')[0]; // Remove the query part.

    if (urlLower.endsWith('jpg') || urlLower.endsWith('jpeg') || urlLower.endsWith('png') || urlLower.endsWith('webp') || urlLower.endsWith('gif')) {
      return url;
    }

    return undefined;
  }

  bypassUrl(url: string) {
    const clean = this.sanitizer.bypassSecurityTrustUrl(url);
    return clean;
  }

  bypassStyle(url: string) {
    const clean = this.sanitizer.bypassSecurityTrustStyle(url);
    return clean;
  }

  bypassFrameUrl(url: string) {
    const clean = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    return clean;
  }
}
