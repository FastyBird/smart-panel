import {
	FAKE_ACTION_TYPE,
	FAKE_NODE_TYPES,
	FAKE_STRICT_ACTION_TYPE,
	FAKE_TRIGGER_TYPE,
} from '../testing/fake-node-types';

import { AutomationGraphIssue, AutomationGraphIssueCode } from './graph-validator';
import { AutomationNodeTypeLookup, normalizeAutomationNodeType } from './node-type';
import { applyGraphSavePolicy, checkGraphForSave, isBlockingGraphIssue } from './save-policy';

const registered = new Map(FAKE_NODE_TYPES.map((nodeType) => [nodeType.type, normalizeAutomationNodeType(nodeType)]));
const lookup: AutomationNodeTypeLookup = (type) => registered.get(type);

const issue = (code: string, severity: 'error' | 'warning' = 'error'): AutomationGraphIssue => ({
	severity,
	code: code as AutomationGraphIssueCode,
	message: code,
});

const node = (id: string, type: string, config: unknown = {}) => ({ id, type, position: { x: 0, y: 0 }, config });

const edge = (id: string, source: string, source_port: string, target: string, target_port: string) => ({
	id,
	source,
	source_port,
	target,
	target_port,
});

describe('graph save policy', () => {
	describe('isBlockingGraphIssue', () => {
		it.each([
			'unknown_node_type',
			'unknown_port',
			'edge_into_trigger',
			'cycle',
			'duplicate_edge',
			'safety_reducing_action',
		])('%s always stops a save', (code) => {
			expect(isBlockingGraphIssue(issue(code), { enabled: false })).toBe(true);
			expect(isBlockingGraphIssue(issue(code), { enabled: true })).toBe(true);
		});

		it.each(['invalid_config', 'no_trigger'])('%s stops a save only when the automation would be enabled', (code) => {
			expect(isBlockingGraphIssue(issue(code), { enabled: false })).toBe(false);
			expect(isBlockingGraphIssue(issue(code), { enabled: true })).toBe(true);
		});

		it('a warning never stops a save', () => {
			expect(isBlockingGraphIssue(issue('unreachable_node', 'warning'), { enabled: true })).toBe(false);
			expect(isBlockingGraphIssue(issue('cycle', 'warning'), { enabled: true })).toBe(false);
		});

		it('an error it does not know stops a save, as a structural one would', () => {
			expect(isBlockingGraphIssue(issue('rule_added_later'), { enabled: false })).toBe(true);
		});
	});

	describe('applyGraphSavePolicy', () => {
		it('marks every issue and is valid when none is blocking', () => {
			const issues = [issue('no_trigger'), issue('unreachable_node', 'warning')];

			expect(applyGraphSavePolicy(issues, { enabled: false })).toEqual({
				valid: true,
				issues: [
					{ ...issues[0], blocking: false },
					{ ...issues[1], blocking: false },
				],
			});
			expect(applyGraphSavePolicy(issues, { enabled: true })).toEqual({
				valid: false,
				issues: [
					{ ...issues[0], blocking: true },
					{ ...issues[1], blocking: false },
				],
			});
		});

		it('is valid without issues', () => {
			expect(applyGraphSavePolicy([], { enabled: true })).toEqual({ valid: true, issues: [] });
		});
	});

	describe('checkGraphForSave', () => {
		const empty = { version: 1, nodes: [], edges: [] };

		const halfConfigured = {
			version: 1,
			nodes: [
				node('t', FAKE_TRIGGER_TYPE),
				node('a', FAKE_STRICT_ACTION_TYPE, { level: 250 }),
				node('later', FAKE_ACTION_TYPE),
			],
			edges: [edge('e1', 't', 'out', 'a', 'in')],
		};

		const complete = {
			version: 1,
			nodes: [node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_STRICT_ACTION_TYPE, { level: 10 })],
			edges: [edge('e1', 't', 'out', 'a', 'in')],
		};

		const broken = {
			version: 1,
			nodes: [node('t', FAKE_TRIGGER_TYPE), node('a', FAKE_STRICT_ACTION_TYPE, { level: 10 })],
			edges: [edge('e1', 't', 'out', 'a', 'sideways')],
		};

		it('refuses an action the safety check finds unsafe, even as a draft, and keeps its warnings as advice', async () => {
			const unsafe = await checkGraphForSave(complete, lookup, {
				enabled: false,
				safety: () => [{ severity: 'error', message: 'An automation can not unlock a lock.', field: 'level' }],
			});

			expect(unsafe.valid).toBe(false);
			expect(unsafe.issues).toEqual([
				{
					severity: 'error',
					code: 'safety_reducing_action',
					message: 'An automation can not unlock a lock.',
					node_id: 'a',
					field: 'level',
					blocking: true,
				},
			]);

			const advised = await checkGraphForSave(complete, lookup, {
				enabled: true,
				safety: () => [{ severity: 'warning', message: 'The scene was not run.' }],
			});

			expect(advised.valid).toBe(true);
			expect(advised.issues).toEqual([expect.objectContaining({ severity: 'warning', blocking: false })]);
		});

		it('lets an empty graph be saved on a disabled automation, not on an enabled one', async () => {
			expect((await checkGraphForSave(empty, lookup, { enabled: false })).valid).toBe(true);
			expect((await checkGraphForSave(empty, lookup, { enabled: true })).valid).toBe(false);
		});

		it('lets a half-drawn, half-configured graph be saved as a disabled draft, and still lists what is missing', async () => {
			const check = await checkGraphForSave(halfConfigured, lookup, { enabled: false });

			expect(check.valid).toBe(true);
			expect(check.issues.map((item) => [item.code, item.node_id, item.blocking])).toEqual([
				['invalid_config', 'a', false],
				['unreachable_node', 'later', false],
			]);
		});

		it('refuses the same graph on an enabled automation because of its configuration, not its warning', async () => {
			const check = await checkGraphForSave(halfConfigured, lookup, { enabled: true });

			expect(check.valid).toBe(false);
			expect(check.issues.map((item) => [item.code, item.node_id, item.blocking])).toEqual([
				['invalid_config', 'a', true],
				['unreachable_node', 'later', false],
			]);
		});

		it('lets a complete graph be saved either way', async () => {
			expect(await checkGraphForSave(complete, lookup, { enabled: true })).toEqual({ valid: true, issues: [] });
			expect(await checkGraphForSave(complete, lookup, { enabled: false })).toEqual({ valid: true, issues: [] });
		});

		it('refuses a structurally broken graph either way', async () => {
			for (const enabled of [false, true]) {
				const check = await checkGraphForSave(broken, lookup, { enabled });

				expect(check.valid).toBe(false);
				expect(check.issues.map((item) => [item.code, item.blocking])).toEqual([['unknown_port', true]]);
			}
		});
	});
});
