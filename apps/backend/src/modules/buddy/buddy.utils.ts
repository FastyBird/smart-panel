/**
 * Convert an intent type enum value to a human-readable action label.
 */
export function formatIntentLabel(intentType: string): string {
	const labels: Record<string, string> = {
		'light.toggle': 'toggle lights',
		'light.setBrightness': 'adjust brightness',
		'light.setColor': 'change light color',
		'light.setColorTemp': 'change color temperature',
		'light.setWhite': 'set white light',
		'device.setProperty': 'adjust a device',
		'scene.run': 'run a scene',
		'space.lighting.on': 'turn on lights',
		'space.lighting.off': 'turn off lights',
		'space.lighting.setMode': 'change lighting mode',
		'space.climate.setMode': 'change climate mode',
		'space.climate.setpointSet': 'adjust thermostat',
		'space.covers.open': 'open covers',
		'space.covers.close': 'close covers',
	};

	return labels[intentType] ?? intentType;
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
