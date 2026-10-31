/**
 * Convert HSV to hex color string.
 * H: 0-360 (degrees), S: 0-1, V: 0-1
 */
export function hsvToHex(h: number, s: number, v: number): string {
	const c = v * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = v - c;

	let r: number;
	let g: number;
	let b: number;

	if (h >= 0 && h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (h >= 60 && h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (h >= 120 && h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (h >= 180 && h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (h >= 240 && h < 300) {
		r = x;
		g = 0;
		b = c;
	} else {
		r = c;
		g = 0;
		b = x;
	}

	const red = Math.round((r + m) * 255);
	const green = Math.round((g + m) * 255);
	const blue = Math.round((b + m) * 255);

	return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

/**
 * Convert hex color string to HSV.
 * Returns H: 0-360 (degrees), S: 0-1, V: 0-1
 */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
	const value = hex.replace('#', '');
	const r = parseInt(value.slice(0, 2), 16) / 255;
	const g = parseInt(value.slice(2, 4), 16) / 255;
	const b = parseInt(value.slice(4, 6), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;

	let h: number;

	if (max === r) {
		h = 60 * (((g - b) / d) % 6);
	} else if (max === g) {
		h = 60 * ((b - r) / d + 2);
	} else {
		h = 60 * ((r - g) / d + 4);
	}

	return { h, s: max === 0 ? 0 : d / max, v: max };
}
