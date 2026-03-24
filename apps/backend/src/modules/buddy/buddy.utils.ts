import {
	BuddyProviderTimeoutException,
	BuddySttProviderTimeoutException,
	BuddyTtsProviderTimeoutException,
} from './buddy.exceptions';

/**
 * Race a promise against a timeout. If the timeout fires first, abort the
 * controller (if provided) and throw the supplied exception.
 * The timer is always cleaned up (no leaked handles).
 *
 * @param controller Optional AbortController — aborted on timeout so the
 *   underlying provider can cancel in-flight HTTP requests / processing.
 */
export async function withServiceTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	exception: BuddyProviderTimeoutException | BuddySttProviderTimeoutException | BuddyTtsProviderTimeoutException,
	controller?: AbortController,
): Promise<T> {
	let timer: NodeJS.Timeout | undefined;

	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			controller?.abort();
			reject(exception);
		}, timeoutMs);
	});

	try {
		return await Promise.race([promise, timeout]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Interpolate a template string with variable values.
 * Replaces `${key}` placeholders with corresponding values from the vars map.
 * Unknown placeholders are left as-is.
 *
 * @example interpolateTemplate("Hello ${name}!", { name: "World" }) → "Hello World!"
 */
export function interpolateTemplate(template: string, vars: Record<string, unknown>): string {
	return template.replace(/\$\{(\w+)\}/g, (match, key: string) => {
		if (key in vars) {
			const val = vars[key];

			return val != null ? String(val as string | number | boolean) : '';
		}

		return match;
	});
}

/**
 * Convert an intent type enum value to a human-readable action label.
 */
export function formatIntentLabel(intentType: string): string {
	const labels: Record<string, string> = {
		// Device operations
		'light.toggle': 'toggle lights',
		'light.setBrightness': 'adjust brightness',
		'light.setColor': 'change light color',
		'light.setColorTemp': 'change color temperature',
		'light.setWhite': 'set white light',
		'device.setProperty': 'adjust a device',
		// Scene operations
		'scene.run': 'run a scene',
		// Space lighting
		'space.lighting.on': 'turn on lights',
		'space.lighting.off': 'turn off lights',
		'space.lighting.setMode': 'change lighting mode',
		'space.lighting.brightnessDelta': 'adjust brightness',
		'space.lighting.roleOn': 'turn on lights',
		'space.lighting.roleOff': 'turn off lights',
		'space.lighting.roleBrightness': 'adjust brightness',
		'space.lighting.roleColor': 'change light color',
		'space.lighting.roleColorTemp': 'change color temperature',
		'space.lighting.roleWhite': 'set white light',
		'space.lighting.roleSet': 'adjust lights',
		// Space climate
		'space.climate.setMode': 'change climate mode',
		'space.climate.setpointSet': 'adjust thermostat',
		'space.climate.setpointDelta': 'adjust thermostat',
		'space.climate.set': 'adjust climate',
		// Space covers
		'space.covers.open': 'open covers',
		'space.covers.close': 'close covers',
		'space.covers.stop': 'stop covers',
		'space.covers.setPosition': 'adjust cover position',
		'space.covers.positionDelta': 'adjust cover position',
		'space.covers.rolePosition': 'adjust cover position',
		'space.covers.setMode': 'change cover mode',
		// Space media
		'space.media.activate': 'start media',
		'space.media.deactivate': 'stop media',
	};

	// Fallback: convert dot notation to readable label (e.g. "space.covers.stop" → "stop covers")
	if (!(intentType in labels)) {
		const parts = intentType.split('.');
		const action = parts[parts.length - 1]
			.replace(/([A-Z])/g, ' $1')
			.trim()
			.toLowerCase();
		const domain = parts.length > 1 ? parts[parts.length - 2] : '';

		return domain ? `${action} ${domain}` : action;
	}

	return labels[intentType];
}

/**
 * Format a time-of-day into a readable string like "11 PM" or "2:30 PM".
 */
export function formatTimeLabel(hour: number, minute: number): string {
	const period = hour >= 12 ? 'PM' : 'AM';
	const displayHour = hour % 12 || 12;

	if (minute === 0) {
		return `${displayHour} ${period}`;
	}

	return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

export interface TimeClusterResult<T> {
	items: T[];
	avgHour: number;
	avgMinute: number;
}

/**
 * Cluster items by time-of-day within ±windowMinutes of each seed.
 * Generic over the item type — callers provide a minuteOfDay extractor.
 */
export function clusterByTimeOfDay<T>(
	items: T[],
	minuteOfDayFn: (item: T) => number,
	windowMinutes: number,
): TimeClusterResult<T>[] {
	if (items.length === 0) {
		return [];
	}

	const sorted = [...items].sort((a, b) => minuteOfDayFn(a) - minuteOfDayFn(b));
	const clusters: TimeClusterResult<T>[] = [];
	const used = new Set<number>();

	for (let i = 0; i < sorted.length; i++) {
		if (used.has(i)) {
			continue;
		}

		const cluster: T[] = [sorted[i]];
		used.add(i);

		const seedMinute = minuteOfDayFn(sorted[i]);

		for (let j = i + 1; j < sorted.length; j++) {
			if (used.has(j)) {
				continue;
			}

			const targetMinute = minuteOfDayFn(sorted[j]);
			const diff = Math.abs(targetMinute - seedMinute);
			const wrappedDiff = Math.min(diff, 1440 - diff);

			if (wrappedDiff <= windowMinutes) {
				cluster.push(sorted[j]);
				used.add(j);
			}
		}

		const { hour, minute } = circularMeanTime(cluster, minuteOfDayFn);

		clusters.push({ items: cluster, avgHour: hour, avgMinute: minute });
	}

	return clusters;
}

/**
 * Compute the circular mean of time-of-day values.
 * Uses circular statistics (atan2 of mean sin/cos) to correctly average
 * times that span midnight (e.g. 23:50 and 00:10 → ~00:00, not 12:00).
 */
export function circularMeanTime<T>(items: T[], minuteOfDayFn: (item: T) => number): { hour: number; minute: number } {
	const TWO_PI = 2 * Math.PI;
	const MINUTES_IN_DAY = 1440;

	let sinSum = 0;
	let cosSum = 0;

	for (const item of items) {
		const minutes = minuteOfDayFn(item);
		const angle = (minutes / MINUTES_IN_DAY) * TWO_PI;
		sinSum += Math.sin(angle);
		cosSum += Math.cos(angle);
	}

	const meanAngle = Math.atan2(sinSum / items.length, cosSum / items.length);
	let meanMinutes = Math.round(((meanAngle < 0 ? meanAngle + TWO_PI : meanAngle) / TWO_PI) * MINUTES_IN_DAY);

	if (meanMinutes >= MINUTES_IN_DAY) {
		meanMinutes = 0;
	}

	return {
		hour: Math.floor(meanMinutes / 60),
		minute: meanMinutes % 60,
	};
}
