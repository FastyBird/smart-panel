export const toEnergy = (v: unknown): number => {
	if (typeof v === 'number') {
		return v;
	}

	if (typeof v === 'object' && v !== null) {
		const rec = v as Record<string, unknown>;

		const t = rec.total;

		if (typeof t === 'number') {
			return t;
		}

		if (typeof t === 'string') {
			const n = Number(t);

			return Number.isFinite(n) ? n : 0;
		}
	}

	return 0;
};

export const rssiToQuality = (rssi: number): number => {
	if (rssi <= -100) {
		return 0;
	}

	if (rssi >= -50) {
		return 100;
	}

	return Math.round(2 * (rssi + 100));
};

export const clampNumber = (number: number, min: number, max: number): number => {
	return Math.max(min, Math.min(max, Number(number)));
};
