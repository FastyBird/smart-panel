import { Test } from '@nestjs/testing';

import { ClimateAutomationProducer, ClimateAutomationProvider } from '../contracts/climate-automation.contract';

import { ClimateAutomationRegistryService } from './climate-automation.registry.service';

const producer: ClimateAutomationProducer = { validateInManager: jest.fn(() => Promise.resolve(null)) };
const provider: ClimateAutomationProvider = {
	readControllerInManager: jest.fn(() => Promise.resolve(null)),
	validateSelectionInManager: jest.fn(() => Promise.resolve(false)),
};

const kinds = [
	{
		kind: 'producer',
		register: (registry: ClimateAutomationRegistryService, key: string, replacement = false) =>
			registry.registerProducerOwned(key, replacement ? { ...producer } : producer),
		capture: (registry: ClimateAutomationRegistryService, key: string) => registry.captureProducer(key),
	},
	{
		kind: 'provider',
		register: (registry: ClimateAutomationRegistryService, key: string, replacement = false) =>
			registry.registerProviderOwned(key, replacement ? { ...provider } : provider),
		capture: (registry: ClimateAutomationRegistryService, key: string) => registry.captureProvider(key),
	},
];

describe.each(kinds)('private climate $kind registration continuity', ({ register, capture }) => {
	it('keeps missing registrations closed and duplicate rejection preserves the original generation', () => {
		const registry = new ClimateAutomationRegistryService();
		expect(capture(registry, 'test:v1')).toBeNull();
		const owner = register(registry, 'test:v1');
		const original = capture(registry, 'test:v1');
		expect(owner).not.toBeNull();
		expect(original).not.toBeNull();
		expect(register(registry, 'test:v1')).toBeNull();
		expect(register(registry, 'test:v1', true)).toBeNull();
		for (let index = 0; index < 3; index++) expect(capture(registry, 'test:v1')?.isCurrent()).toBe(true);
		expect(original?.isCurrent()).toBe(true);
		expect(original).not.toHaveProperty('dispose');
		expect(Object.isFrozen(original)).toBe(true);
		expect(Object.isFrozen(owner)).toBe(true);
	});

	it('fences remove/re-register ABA with the same object and old disposers cannot remove successors', () => {
		const registry = new ClimateAutomationRegistryService();
		const ownerA = register(registry, 'test:v1');
		const original = capture(registry, 'test:v1');
		ownerA.dispose();
		expect(capture(registry, 'test:v1')).toBeNull();
		expect(original.isCurrent()).toBe(false);
		const ownerB = register(registry, 'test:v1');
		const second = capture(registry, 'test:v1');
		expect(second.implementation).toBe(original.implementation);
		ownerA.dispose();
		ownerA.dispose();
		expect(original.isCurrent()).toBe(false);
		expect(second.isCurrent()).toBe(true);
		ownerB.dispose();
		register(registry, 'test:v1', true);
		const third = capture(registry, 'test:v1');
		expect(third.implementation).not.toBe(second.implementation);
		expect(second.isCurrent()).toBe(false);
		ownerB.dispose();
		expect(third.isCurrent()).toBe(true);
	});

	it.each(['test', 'test:v0', 'test:v01', 'Test:v1', 'test:v-1', 'test:v1\n', ':v1'])(
		'rejects malformed or unversioned key %j',
		(key) => {
			const registry = new ClimateAutomationRegistryService();
			expect(() => register(registry, key)).toThrow('Invalid internal climate registration key');
			expect(capture(registry, key)).toBeNull();
		},
	);

	it('isolates registry instances and terminal destruction is idempotent', () => {
		const a = new ClimateAutomationRegistryService();
		const b = new ClimateAutomationRegistryService();
		const owner = register(a, 'test:v1');
		register(b, 'test:v1');
		const old = capture(a, 'test:v1');
		a.onModuleDestroy();
		a.onModuleDestroy();
		owner.dispose();
		expect(old.isCurrent()).toBe(false);
		expect(capture(b, 'test:v1')?.isCurrent()).toBe(true);
		expect(capture(a, 'test:v1')).toBeNull();
		expect(register(a, 'test:v1')).toBeNull();
		expect(register(a, 'new:v2')).toBeNull();
	});
});

describe('dormant Nest lifecycle', () => {
	it('separates producer/provider namespaces, invokes no implementations and closes captures on module teardown', async () => {
		const module = await Test.createTestingModule({ providers: [ClimateAutomationRegistryService] }).compile();
		await module.init();
		const registry = module.get(ClimateAutomationRegistryService);
		expect(registry.captureProvider('virtual-thermostat:v1')).toBeNull();
		expect(registry.captureProducer('activity:v1')).toBeNull();
		const sourceOwner = registry.registerProducerOwned('test:v1', producer);
		registry.registerProviderOwned('test:v1', provider);
		const source = registry.captureProducer('test:v1');
		const controller = registry.captureProvider('test:v1');
		expect(source.implementation).toBe(producer);
		expect(controller.implementation).toBe(provider);
		sourceOwner.dispose();
		expect(controller.isCurrent()).toBe(true);
		expect(producer.validateInManager).not.toHaveBeenCalled();
		expect(provider.readControllerInManager).not.toHaveBeenCalled();
		expect(provider.validateSelectionInManager).not.toHaveBeenCalled();
		await module.close();
		expect(controller.isCurrent()).toBe(false);
		expect(registry.captureProvider('test:v1')).toBeNull();
		expect(registry.registerProviderOwned('test:v1', provider)).toBeNull();
	});
});
