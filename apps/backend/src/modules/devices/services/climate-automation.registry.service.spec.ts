import { ClimateAutomationProducer, ClimateAutomationProvider } from '../contracts/climate-automation.contract';

import { ClimateAutomationRegistryService } from './climate-automation.registry.service';

const producer: ClimateAutomationProducer = { validateInManager: () => Promise.resolve(null) };
const provider: ClimateAutomationProvider = {
	readControllerInManager: () => Promise.resolve(null),
	validateSelectionInManager: () => Promise.resolve(false),
	createControllerInManager: () => Promise.reject(new Error('Not a creation fixture')),
};

describe('private climate registration continuity (not controller readiness)', () => {
	it('returns null for unknown captures and keeps pure captures stable through duplicate failures', () => {
		const registry = new ClimateAutomationRegistryService();
		expect(registry.captureProducer('test:v1')).toBeNull();
		expect(registry.captureProvider('test:v1')).toBeNull();
		const owner = registry.registerProducerOwned('test:v1', producer);
		const first = registry.captureProducer('test:v1');
		expect(owner).not.toBeNull();
		expect(first?.implementation).toBe(producer);
		expect(registry.registerProducerOwned('test:v1', producer)).toBeNull();
		for (let index = 0; index < 3; index++) expect(registry.captureProducer('test:v1')?.isCurrent()).toBe(true);
		expect(first?.isCurrent()).toBe(true);
		expect(first).not.toHaveProperty('dispose');
	});

	it.each(['producer', 'provider'])('isolates original %s owner disposal, same-object ABA and a new provider object', (kind) => {
		const registry = new ClimateAutomationRegistryService();
		const register = () => kind === 'producer' ? registry.registerProducerOwned('test:v1', producer) : registry.registerProviderOwned('test:v1', provider);
		const capture = () => kind === 'producer' ? registry.captureProducer('test:v1') : registry.captureProvider('test:v1');
		const ownerA = register(); const original = capture();
		if (!ownerA || !original) throw new Error('Missing original fixture registration');
		ownerA.dispose(); expect(original.isCurrent()).toBe(false);
		const ownerB = register(); const second = capture();
		if (!ownerB || !second) throw new Error('Missing replacement fixture registration');
		ownerA.dispose(); ownerA.dispose();
		expect(original.isCurrent()).toBe(false); expect(second.isCurrent()).toBe(true);
		ownerB.dispose(); expect(second.isCurrent()).toBe(false);
		const third = registry.registerProviderOwned('other:v1', { ...provider });
		expect(third).not.toBeNull();
		expect(registry.captureProvider('other:v1')?.isCurrent()).toBe(true);
	});

	it('separates registry instances and terminal destroy closes all captures without revival', () => {
		const a = new ClimateAutomationRegistryService(), b = new ClimateAutomationRegistryService();
		const owner = a.registerProviderOwned('test:v1', provider);
		b.registerProviderOwned('test:v1', provider); a.registerProducerOwned('test:v1', producer);
		const old = a.captureProvider('test:v1'), source = a.captureProducer('test:v1');
		a.onModuleDestroy(); a.onModuleDestroy(); owner?.dispose();
		expect(old?.isCurrent()).toBe(false); expect(source?.isCurrent()).toBe(false);
		expect(b.captureProvider('test:v1')?.isCurrent()).toBe(true);
		expect(a.captureProvider('test:v1')).toBeNull();
		expect(a.registerProviderOwned('test:v1', provider)).toBeNull();
	});
});
