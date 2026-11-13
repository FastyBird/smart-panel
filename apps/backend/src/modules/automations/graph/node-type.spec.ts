import { fakeAction, fakeCondition, fakeJoin, fakeStrictAction, fakeTrigger } from '../testing/fake-node-types';

import {
	AUTOMATION_NODE_DEFAULT_PORTS,
	AUTOMATION_NODE_TYPE_UNAVAILABLE_REASON,
	AutomationActionNodeType,
	AutomationNodeType,
	AutomationNodeTypeDefinitionError,
	normalizeAutomationNodeType,
} from './node-type';

describe('normalizeAutomationNodeType', () => {
	it('gives triggers, conditions and actions the ports of their kind', () => {
		expect(normalizeAutomationNodeType(fakeTrigger).ports).toEqual({ inputs: [], outputs: ['out'] });
		expect(normalizeAutomationNodeType(fakeCondition).ports).toEqual({ inputs: ['in'], outputs: ['yes', 'no'] });
		expect(normalizeAutomationNodeType(fakeAction).ports).toEqual({ inputs: ['in'], outputs: ['done', 'error'] });
	});

	it('keeps declared ports and copies them, so the defaults cannot be changed through a registered type', () => {
		expect(normalizeAutomationNodeType(fakeJoin).ports).toEqual({ inputs: ['a', 'b'], outputs: ['out'] });
		expect(normalizeAutomationNodeType({ ...fakeAction, ports: { inputs: ['in'], outputs: ['ok'] } }).ports).toEqual({
			inputs: ['in'],
			outputs: ['ok'],
		});

		normalizeAutomationNodeType(fakeTrigger).ports.outputs.push('extra');

		expect(AUTOMATION_NODE_DEFAULT_PORTS.trigger.outputs).toEqual(['out']);
	});

	it('carries the common part over and keeps the definition it was built from', () => {
		const registered = normalizeAutomationNodeType(fakeStrictAction);

		expect(registered).toMatchObject({
			type: 'test.strict-action',
			kind: 'action',
			name: 'Test strict action',
			description: 'Needs a level between 0 and 100.',
			configSchema: fakeStrictAction.configSchema,
		});
		expect(registered.definition).toBe(fakeStrictAction);
		expect(registered.references({ scene_id: 's-1' })).toEqual([{ kind: 'scene', id: 's-1' }]);
		expect(normalizeAutomationNodeType(fakeTrigger).references({})).toEqual([]);
		expect(normalizeAutomationNodeType(fakeTrigger)).not.toHaveProperty('configSchema');
	});

	it('works for a node type that is a class instance with its handlers on the prototype', async () => {
		class ClassAction {
			readonly type = 'test.class-action';
			readonly kind = 'action' as const;
			readonly name = 'Class action';
			readonly description = '';
			private readonly reason = 'From the instance.';

			validateConfig() {
				return [{ reason: this.reason }];
			}

			references() {
				return [{ kind: 'device' as const, id: this.type }];
			}
		}

		const registered = normalizeAutomationNodeType(new ClassAction());

		expect(await registered.validateConfig({})).toEqual([{ reason: 'From the instance.' }]);
		expect(registered.references({})).toEqual([{ kind: 'device', id: 'test.class-action' }]);
	});

	it('carries what an action does to the home; other kinds and silent actions do nothing', () => {
		const commands = () => [{ kind: 'scene_run' as const, sceneId: 's-1' }];
		const acting: AutomationActionNodeType = { ...fakeAction, commands };

		expect(normalizeAutomationNodeType(acting).commands({})).toEqual([{ kind: 'scene_run', sceneId: 's-1' }]);
		expect(normalizeAutomationNodeType(fakeAction).commands({})).toEqual([]);
		// Only an action acts: what another kind declares is not passed on
		expect(normalizeAutomationNodeType({ ...fakeTrigger, commands } as typeof fakeTrigger).commands({})).toEqual([]);
	});

	it('carries the owner of a node type, and has none when the definition names none', () => {
		const owner = { kind: 'plugin', type: 'spaces-home-control-plugin' } as const;
		const registered = normalizeAutomationNodeType({ ...fakeAction, owner });

		expect(registered.owner).toEqual(owner);
		expect(registered.owner).not.toBe(owner);
		expect(normalizeAutomationNodeType(fakeAction)).not.toHaveProperty('owner');
	});

	it.each([
		['something that is not an object', null],
		['a missing type', { ...fakeAction, type: undefined }],
		['an empty type', { ...fakeAction, type: '' }],
		['an upper-case type', { ...fakeAction, type: 'Device.Set' }],
		['a type with spaces', { ...fakeAction, type: 'device set' }],
		['an overlong type', { ...fakeAction, type: 'a'.repeat(101) }],
		['an unknown kind', { ...fakeAction, kind: 'effect' }],
		['a missing name', { ...fakeAction, name: ' ' }],
		['a missing description', { ...fakeAction, description: undefined }],
		['a missing config validation', { ...fakeAction, validateConfig: undefined }],
		['references that is not a function', { ...fakeAction, references: [] }],
		['commands that is not a function', { ...fakeAction, commands: [] }],
		['an unavailable reason that is not a function', { ...fakeAction, unavailableReason: 'Not set up.' }],
		['a config schema that is not an object', { ...fakeAction, configSchema: [] }],
		['an owner that is not an object', { ...fakeAction, owner: 'some-plugin' }],
		['an owner of an unknown kind', { ...fakeAction, owner: { kind: 'extension', type: 'some-plugin' } }],
		['an owner without a type', { ...fakeAction, owner: { kind: 'plugin', type: '' } }],
		['a flow type without ports', { ...fakeJoin, ports: undefined }],
		['ports that are not lists', { ...fakeJoin, ports: { inputs: 'in', outputs: ['out'] } }],
		['an empty port name', { ...fakeJoin, ports: { inputs: [''], outputs: ['out'] } }],
		['a repeated port name', { ...fakeJoin, ports: { inputs: ['a', 'a'], outputs: ['out'] } }],
		['an overlong port name', { ...fakeJoin, ports: { inputs: ['a'], outputs: ['o'.repeat(65)] } }],
		['a trigger with an input port', { ...fakeTrigger, ports: { inputs: ['in'], outputs: ['out'] } }],
	])('refuses %s', (_label, definition) => {
		expect(() => normalizeAutomationNodeType(definition as unknown as AutomationNodeType)).toThrow(
			AutomationNodeTypeDefinitionError,
		);
	});

	describe('unavailableReason', () => {
		it('is undefined for a node type that is always available', () => {
			expect(normalizeAutomationNodeType(fakeAction).unavailableReason()).toBeUndefined();
		});

		it('passes on the reason of the node type, and only a reason that says something', () => {
			let reason: unknown = 'The house location is not set.';
			const registered = normalizeAutomationNodeType({ ...fakeAction, unavailableReason: () => reason as string });

			expect(registered.unavailableReason()).toBe('The house location is not set.');

			reason = '';
			expect(registered.unavailableReason()).toBeUndefined();

			reason = 42;
			expect(registered.unavailableReason()).toBeUndefined();
		});

		it('reports a node type whose availability can not be told as unavailable', () => {
			const registered = normalizeAutomationNodeType({
				...fakeAction,
				unavailableReason: () => {
					throw new Error('secret detail');
				},
			});

			expect(registered.unavailableReason()).toBe(AUTOMATION_NODE_TYPE_UNAVAILABLE_REASON);
		});
	});
});
