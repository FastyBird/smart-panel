import { ClimateAutomationJson } from '../contracts/climate-automation.contract';

export class ClimateAutomationLedgerConflict extends Error {
	constructor(readonly reason: 'invalid' | 'stale' | 'unavailable' | 'overflow') {
		super(`Private climate ledger conflict: ${reason}`);
	}
}

export function increment(value: number): number {
	if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER)
		throw new ClimateAutomationLedgerConflict('overflow');
	return value + 1;
}

/** Deterministic, owned JSON; traverse caller getters once, reject non-JSON and cycles. */
export function canonical(value: unknown, ancestors = new Set<object>()): string {
	if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
	if (typeof value !== 'object' || ancestors.has(value)) throw new ClimateAutomationLedgerConflict('invalid');
	ancestors.add(value);
	try {
		if (Array.isArray(value))
			return '[' + Array.from(value, (item: unknown) => canonical(item, ancestors)).join(',') + ']';
		if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
			throw new ClimateAutomationLedgerConflict('invalid');
		return (
			'{' +
			Object.keys(value)
				.sort()
				.map((key) => JSON.stringify(key) + ':' + canonical(Reflect.get(value, key), ancestors))
				.join(',') +
			'}'
		);
	} finally {
		ancestors.delete(value);
	}
}
export function ownedJson(value: unknown): ClimateAutomationJson {
	const freeze = (item: ClimateAutomationJson): ClimateAutomationJson => {
		if (item && typeof item === 'object') {
			for (const child of Object.values(item)) freeze(child);
			Object.freeze(item);
		}
		return item;
	};
	return freeze(JSON.parse(canonical(value)) as ClimateAutomationJson);
}
