import { fakeAction, fakeCondition, fakeJoin, fakeStrictAction, fakeTrigger } from '../testing/fake-node-types';

import {
	AUTOMATION_NODE_DEFAULT_PORTS,
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
		['a config schema that is not an object', { ...fakeAction, configSchema: [] }],
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
});
