// Built-in node types for the spike, plus pure time helpers.
import { NodeTypeRegistry } from './graph.ts';
import type { ConditionResult, NodeType } from './graph.ts';
import type { WatchSpec } from './tracker.ts';

export const MAX_DELAY_SECONDS = 24 * 3600;

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function parseHm(s: unknown): number | undefined {
	if (typeof s !== 'string') return undefined;
	const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
	return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

/** Local minute-of-day and weekday (0 = Sunday) of an instant in an IANA timezone. */
export function localTime(epochMs: number, timeZone: string): { minutes: number; weekday: number } {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		hour: '2-digit',
		minute: '2-digit',
		weekday: 'short',
	}).formatToParts(new Date(epochMs));
	const get = (t: string): string => parts.find((p) => p.type === t)!.value;
	return {
		minutes: Number(get('hour')) * 60 + Number(get('minute')),
		weekday: WEEKDAYS.indexOf(get('weekday').toLowerCase()),
	};
}

/**
 * Window is [from, to). from > to crosses midnight. `weekdays` refers to the day the window STARTED,
 * so "Fri 22:00–06:00" is still true on Saturday at 01:00.
 */
export function inTimeWindow(from: number, to: number, minutes: number, weekday: number, weekdays?: number[]): boolean {
	let inside: boolean;
	let startDay = weekday;
	if (from < to) {
		inside = minutes >= from && minutes < to;
	} else {
		inside = minutes >= from || minutes < to;
		if (minutes < to) startDay = (weekday + 6) % 7;
	}
	if (!inside) return false;
	return !weekdays || weekdays.length === 0 || weekdays.includes(startDay);
}

function watchSpec(c: Record<string, unknown>): WatchSpec {
	const spec: WatchSpec = { propertyId: c.property_id as string };
	if (c.to !== undefined) spec.to = c.to;
	if (c.from !== undefined) spec.from = c.from;
	if (c.above !== undefined) spec.above = c.above as number;
	if (c.below !== undefined) spec.below = c.below as number;
	if (c.for_seconds !== undefined) spec.forSeconds = c.for_seconds as number;
	return spec;
}

function compare(operator: string, observed: unknown, expected: unknown): ConditionResult {
	const numeric = ['gt', 'gte', 'lt', 'lte', 'between'].includes(operator);
	if (numeric && typeof observed !== 'number') return { result: false, observed, reason: 'value is not numeric' };
	const v = observed as number;
	switch (operator) {
		case 'eq':
			return { result: observed === expected, observed };
		case 'neq':
			return { result: observed !== expected, observed };
		case 'gt':
			return { result: v > (expected as number), observed };
		case 'gte':
			return { result: v >= (expected as number), observed };
		case 'lt':
			return { result: v < (expected as number), observed };
		case 'lte':
			return { result: v <= (expected as number), observed };
		case 'between': {
			const [lo, hi] = expected as [number, number];
			return { result: v >= lo && v <= hi, observed };
		}
		case 'in':
			return { result: (expected as unknown[]).includes(observed), observed };
		default:
			return { result: false, observed, reason: `unknown operator ${operator}` };
	}
}

export const builtinNodeTypes: NodeType[] = [
	{
		type: 'device.property.changed',
		kind: 'trigger',
		ports: { inputs: [], outputs: ['out'] },
		validateConfig: (c) => {
			const errs: string[] = [];
			if (typeof c.property_id !== 'string') errs.push('property_id is required');
			if (c.above !== undefined && c.below !== undefined) errs.push('above and below are exclusive');
			if (c.for_seconds !== undefined) {
				if (typeof c.for_seconds !== 'number' || c.for_seconds <= 0 || c.for_seconds > MAX_DELAY_SECONDS) {
					errs.push(`for_seconds must be within 1..${MAX_DELAY_SECONDS}`);
				}
				if (c.to === undefined && c.above === undefined && c.below === undefined) {
					errs.push('for_seconds needs a target state (to / above / below)');
				}
			}
			return errs;
		},
		reads: (c) => [c.property_id as string],
		subscribe: (c, ctx, fire) => ctx.tracker.watch(watchSpec(c), fire),
	},
	{
		type: 'manual',
		kind: 'trigger',
		ports: { inputs: [], outputs: ['out'] },
		subscribe: () => () => undefined,
	},
	{
		type: 'device.property.compare',
		kind: 'condition',
		ports: { inputs: ['in'], outputs: ['yes', 'no'] },
		validateConfig: (c) => (typeof c.property_id === 'string' ? [] : ['property_id is required']),
		reads: (c) => [c.property_id as string],
		evaluate: (c, ctx) => {
			const r = ctx.tracker.read(c.property_id);
			// Unknown is not true.
			if (r.status !== 'ok') return { result: false, observed: r.value, reason: `property is ${r.status}` };
			return compare(c.operator, r.value, c.value);
		},
	},
	{
		type: 'time.window',
		kind: 'condition',
		ports: { inputs: ['in'], outputs: ['yes', 'no'] },
		validateConfig: (c) => {
			const from = parseHm(c.from);
			const to = parseHm(c.to);
			if (from === undefined || to === undefined) return ['from and to must be HH:MM'];
			if (from === to) return ['from and to must differ (an empty or a full-day window is ambiguous)'];
			return [];
		},
		evaluate: (c, ctx) => {
			const t = localTime(ctx.clock.wallNow(), ctx.timezone);
			const hh = String(Math.floor(t.minutes / 60)).padStart(2, '0');
			const mm = String(t.minutes % 60).padStart(2, '0');
			return {
				result: inTimeWindow(parseHm(c.from)!, parseHm(c.to)!, t.minutes, t.weekday, c.weekdays),
				observed: `${WEEKDAYS[t.weekday]} ${hh}:${mm} ${ctx.timezone}`,
			};
		},
	},
	{
		type: 'device.property.set',
		kind: 'action',
		ports: { inputs: ['in'], outputs: ['done', 'error'] },
		validateConfig: (c) => (typeof c.property_id === 'string' ? [] : ['property_id is required']),
		writes: (c) => [c.property_id as string],
		execute: async (c, ctx) => {
			await ctx.services.writeProperty(c.property_id, c.value);
			return { success: true };
		},
	},
	{
		type: 'flow.delay',
		kind: 'flow',
		flow: 'delay',
		ports: { inputs: ['in'], outputs: ['out'] },
		validateConfig: (c) =>
			typeof c.seconds === 'number' && c.seconds > 0 && c.seconds <= MAX_DELAY_SECONDS
				? []
				: [`seconds must be within 1..${MAX_DELAY_SECONDS} (24 h cap)`],
	},
	{ type: 'flow.any', kind: 'flow', flow: 'any', ports: { inputs: ['in'], outputs: ['out'] } },
	{ type: 'flow.all', kind: 'flow', flow: 'all', ports: { inputs: ['in'], outputs: ['out'] } },
	{
		type: 'flow.wait_until',
		kind: 'flow',
		flow: 'wait',
		ports: { inputs: ['in'], outputs: ['out', 'timeout'] },
		validateConfig: (c) => {
			const errs: string[] = [];
			if (typeof c.property_id !== 'string') errs.push('property_id is required');
			if (c.to === undefined && c.above === undefined && c.below === undefined) errs.push('a target state is required');
			if (typeof c.timeout_seconds !== 'number' || c.timeout_seconds <= 0 || c.timeout_seconds > MAX_DELAY_SECONDS) {
				errs.push(`timeout_seconds is required, within 1..${MAX_DELAY_SECONDS}`);
			}
			return errs;
		},
		reads: (c) => [c.property_id as string],
	},
];

export function createRegistry(extra: NodeType[] = []): NodeTypeRegistry {
	const r = new NodeTypeRegistry();
	for (const t of [...builtinNodeTypes, ...extra]) r.register(t);
	return r;
}

export { watchSpec };
