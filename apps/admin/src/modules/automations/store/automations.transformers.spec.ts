import { describe, expect, it, vi } from 'vitest';

import { AutomationMode, AutomationStatus } from '../automations.constants';
import { AutomationsValidationException } from '../automations.exceptions';

import {
	transformAutomationCreateRequest,
	transformAutomationGraphIssues,
	transformAutomationResponse,
	transformAutomationUpdateRequest,
} from './automations.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
			debug: vi.fn(),
		},
	};
});

const automationId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a01';
const spaceId = 'b5f5f9a2-6a6c-4c0e-9d7f-1c1d3f1b2a03';

const graph = {
	version: 1,
	nodes: [{ id: 'n1', type: 'device.property.changed', position: { x: 10, y: 20 }, config: { property_id: spaceId, for_seconds: 5 } }],
	edges: [],
};

describe('Automations Transformers', () => {
	describe('transformAutomationResponse', () => {
		it('converts a list item and fills what the list leaves out', () => {
			const automation = transformAutomationResponse({
				id: automationId,
				name: 'Hallway motion light',
				enabled: true,
				space_id: spaceId,
				mode: AutomationMode.single,
				revision: 7,
				status: AutomationStatus.invalid,
				last_triggered_at: '2026-01-02T08:30:00.000Z',
				last_run_status: null,
				created_at: '2026-01-01T10:00:00.000Z',
				updated_at: '2026-01-01T11:00:00.000Z',
			});

			expect(automation).toEqual({
				id: automationId,
				name: 'Hallway motion light',
				description: null,
				icon: null,
				enabled: true,
				spaceId,
				mode: AutomationMode.single,
				graph: null,
				revision: 7,
				status: AutomationStatus.invalid,
				lastTriggeredAt: new Date('2026-01-02T08:30:00.000Z'),
				lastRunStatus: null,
				createdAt: new Date('2026-01-01T10:00:00.000Z'),
				updatedAt: new Date('2026-01-01T11:00:00.000Z'),
			});
		});

		it('keeps the graph exactly as received', () => {
			const automation = transformAutomationResponse({
				id: automationId,
				name: 'Hallway motion light',
				enabled: false,
				mode: AutomationMode.restart,
				revision: 1,
				status: AutomationStatus.ok,
				created_at: '2026-01-01T10:00:00.000Z',
				graph,
			});

			expect(automation.graph).toEqual(graph);
		});

		it('throws on data that is not an automation', () => {
			expect(() => transformAutomationResponse({ id: 'not-a-uuid', name: '' })).toThrow(AutomationsValidationException);
		});
	});

	describe('transformAutomationCreateRequest', () => {
		it('converts the keys and leaves the graph alone', () => {
			expect(transformAutomationCreateRequest({ id: automationId, name: ' Night mode ', description: ' ', spaceId, graph })).toEqual({
				id: automationId,
				name: 'Night mode',
				description: null,
				space_id: spaceId,
				graph,
			});
		});

		it('throws on an invalid request', () => {
			expect(() => transformAutomationCreateRequest({ name: '' })).toThrow(AutomationsValidationException);
		});
	});

	describe('transformAutomationUpdateRequest', () => {
		it('carries the revision and only the given fields', () => {
			expect(transformAutomationUpdateRequest({ revision: 4, enabled: true, spaceId: null })).toEqual({
				revision: 4,
				enabled: true,
				space_id: null,
			});
		});

		it('throws without a valid revision', () => {
			expect(() => transformAutomationUpdateRequest({ revision: 0, enabled: true })).toThrow(AutomationsValidationException);
		});
	});

	describe('transformAutomationGraphIssues', () => {
		it('reads the issues and drops what it cannot read', () => {
			expect(
				transformAutomationGraphIssues([
					{ severity: 'error', code: 'invalid_config', message: 'Property is required', blocking: true, node_id: 'n1', field: 'property_id' },
					{ severity: 'unknown' },
					'nonsense',
				])
			).toEqual([
				{ severity: 'error', code: 'invalid_config', message: 'Property is required', blocking: true, node_id: 'n1', field: 'property_id' },
			]);
		});

		it('answers an empty list for anything that is not a list', () => {
			expect(transformAutomationGraphIssues(undefined)).toEqual([]);
			expect(transformAutomationGraphIssues({ code: 'cycle' })).toEqual([]);
		});
	});
});
