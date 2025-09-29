export type CoerceNumberOpts = {
	clamp?: { min: number; max: number };
	allowNull?: boolean;
	round?: boolean;
};

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

export const coerceNumberSafe = (input: unknown, opts: CoerceNumberOpts = {}): number | null => {
	if (input === null) {
		return opts.allowNull ? null : 0;
	}

	if (typeof input === 'number') {
		if (!Number.isFinite(input)) {
			return 0;
		}

		let n = input;

		if (opts.round) {
			n = Math.round(n);
		}

		if (opts.clamp) {
			n = Math.max(opts.clamp.min, Math.min(opts.clamp.max, n));
		}

		return n;
	}

	if (typeof input === 'string' && input.trim()) {
		const n = Number(input);

		if (!Number.isFinite(n)) {
			return 0;
		}

		let v = n;

		if (opts.round) {
			v = Math.round(v);
		}

		if (opts.clamp) {
			v = Math.max(opts.clamp.min, Math.min(opts.clamp.max, v));
		}

		return v;
	}

	if (typeof input === 'boolean') {
		return input ? 1 : 0;
	}

	return 0;
};

export const coerceBooleanSafe = (input: unknown): boolean => {
	if (typeof input === 'boolean') {
		return input;
	}

	if (typeof input === 'number') {
		return Number.isFinite(input) && input !== 0;
	}

	if (typeof input === 'string') {
		const s = input.trim().toLowerCase();

		return s === '1' || s === 'true' || s === 'on' || s === 'yes';
	}

	return false;
};
