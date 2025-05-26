import { Pipe, PipeTransform } from '@angular/core';
import { nip19 } from 'nostr-tools';

@Pipe({ name: 'npub', standalone: true })
export class NPubPipe implements PipeTransform {
    transform(value: string): string {
        if (!value) {
            return '';
        }

        return nip19.decode(value).data as string;
    }
}
