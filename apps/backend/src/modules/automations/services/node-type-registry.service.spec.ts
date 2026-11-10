import { AutomationsException } from '../automations.exceptions';
import { AutomationNodeType } from '../graph/node-type';
import { fakeAction, fakeCondition, fakeJoin, fakeStrictAction, fakeTrigger } from '../testing/fake-node-types';

import { AutomationNodeTypeRegistryService } from './node-type-registry.service';

interface LoggerLike {
	warn: (message: string) => void;
}

describe('AutomationNodeTypeRegistryService', () => {
	let service: AutomationNodeTypeRegistryService;

	beforeEach(() => {
		service = new AutomationNodeTypeRegistryService();
	});

	it('starts empty', () => {
		expect(service.list()).toEqual([]);
		expect(service.has(fakeTrigger.type)).toBe(false);
		expect(service.get(fakeTrigger.type)).toBeUndefined();
		expect(service.lookup(fakeTrigger.type)).toBeUndefined();
	});

	it('registers a node type with its ports resolved and finds it by its exact type', () => {
		service.register(fakeTrigger);

		expect(service.has('test.trigger')).toBe(true);
		expect(service.has('TEST.TRIGGER')).toBe(false);
		expect(service.get('test.trigger')).toMatchObject({
			type: 'test.trigger',
			kind: 'trigger',
			name: 'Test trigger',
			ports: { inputs: [], outputs: ['out'] },
		});
		expect(service.get('test.trigger')?.definition).toBe(fakeTrigger);
		expect(service.lookup('test.trigger')).toBe(service.get('test.trigger'));
	});

	it('accepts a node type with a typed configuration', () => {
		service.register(fakeStrictAction);

		expect(service.get(fakeStrictAction.type)?.configSchema).toEqual(fakeStrictAction.configSchema);
	});

	it('lists the registered node types ordered by type', () => {
		for (const nodeType of [fakeTrigger, fakeJoin, fakeAction, fakeCondition]) {
			service.register(nodeType);
		}

		expect(service.list().map((nodeType) => nodeType.type)).toEqual([
			'test.action',
			'test.condition',
			'test.join',
			'test.trigger',
		]);
	});

	it('overwrites a node type registered twice and warns about it', () => {
		const warn = jest.spyOn((service as unknown as { logger: LoggerLike }).logger, 'warn').mockImplementation();

		service.register(fakeAction);

		expect(warn).not.toHaveBeenCalled();

		service.register({ ...fakeAction, name: 'Replacement', ports: { inputs: ['in'], outputs: ['ok'] } });

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('test.action'));
		expect(service.list()).toHaveLength(1);
		expect(service.get('test.action')).toMatchObject({
			name: 'Replacement',
			ports: { inputs: ['in'], outputs: ['ok'] },
		});
	});

	it('refuses a definition the validator could not use and registers nothing', () => {
		expect(() => service.register({ ...fakeJoin, ports: undefined } as unknown as AutomationNodeType)).toThrow(
			AutomationsException,
		);
		expect(() => service.register({ ...fakeAction, type: 'Not A Type' })).toThrow(/lower-case/);

		expect(service.list()).toEqual([]);
	});
});
