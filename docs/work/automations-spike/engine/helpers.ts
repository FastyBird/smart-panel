// Test helpers: fake devices, graph builder, fake-time stepping.
import { mock } from 'node:test';

import { AutomationEngine } from './engine.ts';
import type { EngineOptions } from './engine.ts';
import type { Graph, GraphNode, NodeType } from './graph.ts';
import { createRegistry } from './nodes.ts';
import { CH_VALUE_SET, FakeBus, StateTracker } from './tracker.ts';
import type { Snapshot } from './tracker.ts';

export function startFakeTime(isoUtc = '2026-11-10T12:00:00Z'): void {
	mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date(isoUtc).getTime() });
}

export function stopFakeTime(): void {
	mock.timers.reset();
}

/** Drain all pending microtasks (setImmediate is not mocked). */
export function flush(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

/** Advance fake time in steps, draining microtasks between steps so async continuations see the right time. */
export async function advance(ms: number, stepMs = 1000): Promise<void> {
	await flush();
	let left = ms;
	while (left > 0) {
		const d = Math.min(stepMs, left);
		mock.timers.tick(d);
		left -= d;
		await flush();
	}
}

/** nodes: [id, type, config?]; edges: 'source:port>target' (target port is always "in"), ids e1..eN */
export function graph(nodes: [string, string, Record<string, unknown>?][], edges: string[]): Graph {
	return {
		version: 1,
		nodes: nodes.map(([id, type, config]): GraphNode => ({ id, type, config: config ?? {} })),
		edges: edges.map((s, i) => {
			const [, source, source_port, target] = /^([^:]+):([^>]+)>(.+)$/.exec(s)!;
			return { id: `e${i + 1}`, source, source_port, target, target_port: 'in' };
		}),
	};
}

export interface Write {
	propertyId: string;
	value: unknown;
	at: number;
}

export interface Harness {
	bus: FakeBus;
	tracker: StateTracker;
	engine: AutomationEngine;
	writes: Write[];
	log: string[];
	notifications: { automationId: string; kind: string; message: string }[];
	report(propertyId: string, value: unknown, extra?: { valid?: boolean; online?: boolean }): void;
}

export function harness(opts: Partial<EngineOptions> & { seed?: Snapshot; echoWrites?: boolean; echoDelayMs?: number; failWrites?: string[] } = {}): Harness {
	const bus = new FakeBus();
	const tracker = new StateTracker(bus, undefined, (id) => opts.seed?.[id]);
	const writes: Write[] = [];
	const log: string[] = [];
	const notifications: Harness['notifications'] = [];
	const testAction: NodeType = {
		type: 'test.action',
		kind: 'action',
		ports: { inputs: ['in'], outputs: ['done', 'error'] },
		execute: async (c: { name: string; fail?: boolean; throws?: boolean; takesMs?: number }) => {
			if (c.takesMs) await new Promise((r) => setTimeout(r, c.takesMs));
			if (c.throws) throw new Error(`${c.name} exploded`);
			log.push(c.name);
			return c.fail ? { success: false, reason: `${c.name} failed` } : { success: true };
		},
	};
	const engine = new AutomationEngine({
		registry: createRegistry([testAction]),
		tracker,
		timezone: 'Europe/Prague',
		notify: (n) => notifications.push(n),
		services: {
			writeProperty: async (propertyId: string, value: unknown) => {
				if (opts.failWrites?.includes(propertyId)) throw new Error('device rejected the command');
				writes.push({ propertyId, value, at: Date.now() });
				// The device confirms the new value: synchronously, or after a round-trip latency.
				const echo = (): void => bus.emit(CH_VALUE_SET, { propertyId, value, valid: true, online: true });
				if (opts.echoWrites && opts.echoDelayMs) setTimeout(echo, opts.echoDelayMs);
				else if (opts.echoWrites) echo();
			},
		},
		...opts,
	});
	return {
		bus,
		tracker,
		engine,
		writes,
		log,
		notifications,
		report: (propertyId, value, extra = {}) => bus.emit(CH_VALUE_SET, { propertyId, value, valid: true, online: true, ...extra }),
	};
}
