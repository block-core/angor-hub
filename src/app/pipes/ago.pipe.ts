import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'ago', standalone: true })
export class AgoPipe implements PipeTransform {
    transform(value: number): string {
        if (!value) return '';

        // Input is expected to be a unix timestamp in seconds.
        const nowMs = Date.now();
        const thenMs = value * 1000;
        const diffSeconds = Math.round((thenMs - nowMs) / 1000);

        const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

        const thresholds: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
            { unit: 'year', seconds: 60 * 60 * 24 * 365 },
            { unit: 'month', seconds: 60 * 60 * 24 * 30 },
            { unit: 'week', seconds: 60 * 60 * 24 * 7 },
            { unit: 'day', seconds: 60 * 60 * 24 },
            { unit: 'hour', seconds: 60 * 60 },
            { unit: 'minute', seconds: 60 },
            { unit: 'second', seconds: 1 },
        ];

        for (const { unit, seconds } of thresholds) {
            const valueInUnit = diffSeconds / seconds;
            if (Math.abs(valueInUnit) >= 1 || unit === 'second') {
                return rtf.format(Math.round(valueInUnit), unit);
            }
        }

        return '';
    }
}
