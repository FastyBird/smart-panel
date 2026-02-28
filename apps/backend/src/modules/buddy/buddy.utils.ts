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
