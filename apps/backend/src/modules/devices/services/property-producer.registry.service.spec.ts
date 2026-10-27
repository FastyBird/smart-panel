import { EventEmitter2 } from '@nestjs/event-emitter';

import { DataTypeType, EventType, PropertyCategory } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

import { PropertyProducerRegistryService } from './property-producer.registry.service';

const property = (id = 'property') =>
	Object.assign(new ChannelPropertyEntity(), {
		id,
		name: 'Original',
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
	});

describe('exact producer-state slot ownership', () => {
	it.each(['runtime', 'remove-recreate'] as const)(
		'refuses prepared absence after independent %s and leaves the exact successor unchanged',
		(kind) => {
			const events = new EventEmitter2(),
				registry = new PropertyProducerRegistryService(events),
				input = property();
			const owner = registry.createStateOwner('state');
			const batch = registry.beginStateBatch(
				owner,
				() => true,
				() => true,
			);
			const plan = registry.prepareStateBatch(batch, [{ property: input, revision: 1, reason: 'runtime_unavailable' }]);
			expect(registry.owns(input.id)).toBe(false);
			const first = registry.register(input, 2);
			if (kind === 'remove-recreate') registry.remove(input.id);
			const successor = kind === 'runtime' ? first : registry.register(input, 3);
			const before = registry.readDiagnosticState(input.id),
				epoch = registry.version(successor);
			expect(registry.validateStatePlan(plan)).toBe(false);
			expect(registry.installStatePlan(plan)).toBe(false);
			registry.disposeStateOwner(owner);
			expect(registry.isCurrent(successor)).toBe(true);
			expect(registry.version(successor)).toBe(epoch);
			expect(registry.readDiagnosticState(input.id)).toEqual(before);
			registry.onModuleDestroy();
		},
	);
	it('prepares without events or map writes and detaches original property bytes before caller mutation', async () => {
		const events = new EventEmitter2(),
			registry = new PropertyProducerRegistryService(events),
			input = property();
		const emit = jest.spyOn(events, 'emit');
		const owner = registry.createStateOwner('state'),
			batch = registry.beginStateBatch(
				owner,
				() => true,
				() => true,
			);
		const plan = registry.prepareStateBatch(batch, [{ property: input, revision: 1, reason: 'runtime_unavailable' }]);
		input.name = 'Later';
		expect(emit).not.toHaveBeenCalled();
		expect(registry.owns(input.id)).toBe(false);
		expect(JSON.stringify({ owner, batch, plan })).toBe('{"owner":{},"batch":{},"plan":{}}');
		expect(registry.installStatePlan(plan)).toBe(true);
		expect(emit).not.toHaveBeenCalled();
		await registry.publishStatePlan(plan);
		expect(emit).toHaveBeenCalledTimes(1);
		expect(emit.mock.calls[0][1]).toMatchObject({ name: 'Original' });
		expect(registry.readStatePlan(plan)).toMatchObject({
			attempted: 1,
			installed: 1,
			submitted: 1,
			settled: 1,
			failed: 0,
			terminal: 'complete',
		});
		registry.disposeStateOwner(owner);
		registry.onModuleDestroy();
	});
	it('retains actual partial delivery, attempts later original callbacks, and never disposes their independent runtime successor', async () => {
		const events = new EventEmitter2(),
			registry = new PropertyProducerRegistryService(events);
		const a = property('a'),
			b = property('b');
		const owner = registry.createStateOwner('state'),
			batch = registry.beginStateBatch(
				owner,
				() => true,
				() => true,
			);
		const plan = registry.prepareStateBatch(
			batch,
			[a, b].map((entry) => ({ property: entry, revision: 1, reason: 'runtime_unavailable' as const })),
		);
		const seen: string[] = [];
		let successor: ReturnType<PropertyProducerRegistryService['register']>;
		events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, (entry: ChannelPropertyEntity) => {
			seen.push(entry.id);
			if (entry.id === 'a') {
				successor = registry.register(property('runtime'), 2);
				throw JSON.parse('false') as unknown;
			}
		});
		expect(registry.installStatePlan(plan)).toBe(true);
		let rejection: { cause: unknown } | undefined;
		try {
			await registry.publishStatePlan(plan);
		} catch (cause: unknown) {
			rejection = { cause };
		}
		expect(rejection).toEqual({ cause: false });
		expect(seen).toEqual(['a', 'runtime', 'b']);
		expect(registry.readStatePlan(plan)).toMatchObject({
			installed: 2,
			submitted: 2,
			settled: 2,
			failed: 1,
			terminal: 'partial',
		});
		registry.disposeStateOwner(owner);
		expect(registry.isCurrent(successor)).toBe(true);
		registry.onModuleDestroy();
	});
	it('permits fresh same-family replacement only of the retained exact retired fallback', async () => {
		const registry = new PropertyProducerRegistryService(),
			input = property();
		const first = registry.createStateOwner('state');
		const a = registry.prepareStateBatch(
			registry.beginStateBatch(
				first,
				() => true,
				() => true,
			),
			[{ property: input, revision: 1, reason: 'runtime_unavailable' }],
		);
		expect(registry.installStatePlan(a)).toBe(true);
		await registry.publishStatePlan(a);
		registry.disposeStateOwner(first);
		const second = registry.createStateOwner('state');
		const b = registry.prepareStateBatch(
			registry.beginStateBatch(
				second,
				() => true,
				() => true,
			),
			[{ property: input, revision: 2, reason: 'runtime_unavailable' }],
		);
		expect(registry.installStatePlan(b)).toBe(true);
		await registry.publishStatePlan(b);
		registry.disposeStateOwner(first);
		expect(registry.read(input.id)?.producer.revision).toBe(2);
		expect(registry.read(input.id)?.producer.reasons).toEqual(['runtime_unavailable']);
		registry.disposeStateOwner(second);
		registry.onModuleDestroy();
	});
});
