/**
 * Normalizes Home Assistant hardware event types into Smart Panel standard event strings.
 */
export function normalizeHaEventType(haEventType: string): string {
	const trimmed = haEventType.trim().toLowerCase();
	switch (trimmed) {
		case 'press':
		case 'single':
		case 'single_press':
		case 'click':
		case 'short_press':
		case 'button_press':
			return 'press';
		case 'double':
		case 'double_press':
		case 'double_click':
			return 'double_press';
		case 'triple':
		case 'triple_press':
		case 'triple_click':
			return 'triple_press';
		case 'hold':
		case 'long_press':
		case 'long_click':
		case 'press_hold':
			return 'long_press';
		case 'release':
		case 'release_hold':
			return 'release';
		case 'up':
		case 'arrow_up':
			return 'up';
		case 'down':
		case 'arrow_down':
			return 'down';
		default:
			return trimmed;
	}
}

/**
 * Maps and deduplicates advertised Home Assistant event_types into a normalized format enum array.
 */
export function mapHaEventTypesToFormat(eventTypes: string[]): string[] {
	const mapped = new Set<string>();
	for (const type of eventTypes) {
		if (typeof type === 'string' && type.trim().length > 0) {
			mapped.add(normalizeHaEventType(type));
		}
	}
	return Array.from(mapped);
}
