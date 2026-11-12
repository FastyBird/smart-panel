import { describe, expect, it } from 'vitest';

import type { IAutomationGraphNode } from '../store/automations.store.types';

import { findSelfTriggeringWrites } from './nodes.rules';

const node = (id: string, type: string, config: Record<string, unknown>): IAutomationGraphNode => ({ id, type, position: { x: 0, y: 0 }, config });

const target = (property: string): Record<string, unknown> => ({ device_id: 'd', channel_id: 'c', property_id: property });

describe('findSelfTriggeringWrites', (): void => {
	it('warns about a write to a property a trigger of the same automation watches, on both cards', (): void => {
		const issues = findSelfTriggeringWrites({
			nodes: [
				node('t1', 'device.property.changed', { ...target('light-on'), to: true }),
				node('a1', 'device.property.set', {
					writes: [
						{ ...target('other'), value: 1 },
						{ ...target('light-on'), value: false },
					],
				}),
			],
		});

		expect(issues).toEqual([
			expect.objectContaining({
				severity: 'warning',
				code: 'self_triggering_write',
				blocking: false,
				node_id: 'a1',
				node_ids: ['a1', 't1'],
				field: 'writes.1.property_id',
			}),
		]);
	});

	it('says nothing about writes no trigger watches, or a property only a condition reads', (): void => {
		expect(
			findSelfTriggeringWrites({
				nodes: [
					node('t1', 'device.property.changed', target('motion')),
					node('c1', 'device.property.compare', { ...target('light-on'), operator: 'eq', value: true }),
					node('a1', 'device.property.set', { writes: [{ ...target('light-on'), value: true }] }),
				],
			})
		).toEqual([]);
	});

	it('names the write by its place in the configuration, past entries that are not writes', (): void => {
		const issues = findSelfTriggeringWrites({
			nodes: [
				node('t1', 'device.property.changed', { ...target('light-on'), to: true }),
				node('a1', 'device.property.set', { writes: [null, { ...target('light-on'), value: false }] }),
			],
		});

		expect(issues.map((issue) => issue.field)).toEqual(['writes.1.property_id']);
	});

	it('reads a half-configured graph without failing', (): void => {
		expect(
			findSelfTriggeringWrites({
				nodes: [node('t1', 'device.property.changed', {}), node('a1', 'device.property.set', { writes: [null, 'x'] })],
			})
		).toEqual([]);
	});
});
