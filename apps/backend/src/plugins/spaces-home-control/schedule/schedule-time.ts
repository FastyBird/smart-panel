import { CronTime } from 'cron';

import { ScheduleEntry, ScheduleOccurrence } from './space-mode-schedule.types';

export const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Accept named zones understood by both Intl and recurrence evaluation, excluding fixed numeric offsets. */
export function isScheduleTimezone(timezone: string): boolean {
	try {
		new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
		return timezone.length > 0 && !/^[+-]/.test(timezone);
	} catch {
		return false;
	}
}

/** Missing wall times are skipped; an ambiguous wall time belongs only to its first UTC instant. */
export function nextScheduleOccurrence(
	entry: ScheduleEntry,
	timezone: string,
	after: number,
): ScheduleOccurrence | null {
	return resolveEntry(entry, timezone)(after);
}

/** Reuse one cron resolver per entry and reject DST-adjusted wall times before choosing the first fold instant. */
function resolveEntry(entry: ScheduleEntry, timezone: string): (after: number) => ScheduleOccurrence | null {
	if (!isScheduleTimezone(timezone)) throw new Error('Invalid schedule timezone');
	if (!entry.enabled) return () => null;
	const [hour, minute] = entry.time.split(':').map(Number);
	const cron = new CronTime(`0 ${minute} ${hour} * * ${entry.days_of_week.join(',')}`, timezone);
	return (after) => {
		if (!Number.isFinite(after)) throw new Error('Invalid schedule clock');
		let cursor = after;
		for (let attempt = 0; attempt < 16; attempt++) {
			const candidate = cron.getNextDateFrom(new Date(cursor), timezone);
			const first = candidate.getPossibleOffsets().reduce((a, b) => (a.toMillis() < b.toMillis() ? a : b));
			// Cron advances missing spring times to the transition. That is not this entry's authored time.
			if (candidate.hour === hour && candidate.minute === minute && first.toMillis() > after) {
				return {
					entry_id: entry.id,
					mode: entry.mode,
					time: entry.time,
					local_date: first.toFormat('yyyy-MM-dd'),
					timezone,
					occurs_at: first.toJSDate().toISOString(),
				};
			}
			cursor = Math.max(cursor + MINUTE_MS, candidate.toMillis());
		}
		throw new Error('Could not resolve a bounded weekly schedule occurrence');
	};
}

/** Read-only evaluation, including after restart. It never replays any of the traversed occurrences. */
export function evaluateSchedule(entries: ScheduleEntry[], timezone: string, now: number) {
	let current: ScheduleOccurrence | null = null;
	let next: ScheduleOccurrence | null = null;
	for (const entry of entries) {
		if (!entry.enabled) continue;
		const resolve = resolveEntry(entry, timezone);
		let occurrence = resolve(now - 8 * DAY_MS);
		// A weekly entry skipped in the DST gap can leave its preceding mode in effect for fourteen days.
		if (occurrence && Date.parse(occurrence.occurs_at) > now) occurrence = resolve(now - 16 * DAY_MS);
		for (let count = 0; occurrence && count < 12; count++) {
			const at = Date.parse(occurrence.occurs_at);
			if (at > now) {
				if (!next || at < Date.parse(next.occurs_at)) next = occurrence;
				break;
			}
			if (!current || at > Date.parse(current.occurs_at)) current = occurrence;
			occurrence = resolve(at);
		}
	}
	return { current, next };
}

/** Durable local occurrence identity deduplicates both UTC representations of an autumn fold. */
export function scheduleOccurrenceKey(occurrence: ScheduleOccurrence): string {
	return `${occurrence.timezone}|${occurrence.local_date}|${occurrence.time}`;
}
