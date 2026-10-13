import { EventEmitter2 } from '@nestjs/event-emitter';

import { PermissionType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePropertyData } from '../platforms/device.platform';

import {
	CompositeCommandChild,
	CompositePropertyCommandRegistryService,
} from './composite-property-command.registry.service';
import { PropertyCommandDispatchService } from './property-command-dispatch.service';
import { PropertyCommandWindowService } from './property-command-window.service';

const update = (id: string, value = true): IDevicePropertyData => {
	const device = Object.assign(new DeviceEntity(), { id: `device-${id}`, enabled: true });
	const channel = Object.assign(new ChannelEntity(), { id: `channel-${id}`, device });
	const property = Object.assign(new ChannelPropertyEntity(), {
		id,
		channel,
		dataType: 'bool',
		permissions: [PermissionType.READ_WRITE],
	});
	return { device, channel, property, value };
};

describe('core opt-in composite commands', () => {
	const setup = (children: CompositeCommandChild[]) => {
		const windows = new PropertyCommandWindowService();
		const registry = new CompositePropertyCommandRegistryService();
		let current = true;
		registry.register({
			canHandle: (property) => property.id === 'group',
			plan: async () => ({ revision: 1, children, isCurrent: async () => current }),
		});
		const physical = children.flatMap((child) => (child.update ? [child.update] : []));
		const metadata = {
			findOne: async (id: string) => physical.find((target) => target.property.id === id)?.property ?? null,
		};
		const processBatch = jest.fn(async (targets: IDevicePropertyData[]) => {
			const window = windows.get(targets[0].property.id);
			windows.confirm(
				{ canonicalPropertyId: window.canonicalTarget.propertyId, generation: window.generation },
				{ value: targets[0].value, receivedAt: Date.now() },
			);
			return true;
		});
		const platform = { get: () => ({ processBatch }), usesAuthoritativePropertyReadback: () => false };
		const dispatch = new PropertyCommandDispatchService(
			metadata as never,
			{ readLatest: async () => null } as never,
			{} as never,
			{} as never,
			platform as never,
			{ resolve: (property: ChannelPropertyEntity) => property.id } as never,
			{ runShared: async (operation: () => Promise<unknown>) => operation() } as never,
			{ run: async (_id: string, operation: () => Promise<unknown>) => operation() } as never,
			windows,
			undefined,
			registry,
			new EventEmitter2(),
		);
		return {
			dispatch,
			windows,
			processBatch,
			invalidate: () => {
				current = false;
			},
		};
	};
	it('confirms different physical platforms/channels independently and deduplicates equal leaves', async () => {
		const a = update('a');
		const b = update('b');
		const { dispatch, processBatch } = setup([
			{ memberId: 'a', update: a },
			{ memberId: 'alias-a', update: a },
			{ memberId: 'b', update: b },
		]);
		const result = await dispatch.dispatchBatch([update('group')]);
		expect(result.success).toBe(true);
		expect(result.composite.children).toHaveLength(3);
		expect(result.composite.children.every((child) => child.status === 'confirmed')).toBe(true);
		expect(processBatch).toHaveBeenCalledTimes(2);
	});
	it('rejects contradictory canonical values before any platform call', async () => {
		const { dispatch, processBatch } = setup([
			{ memberId: 'a', update: update('a') },
			{ memberId: 'alias-a', update: update('a', false) },
		]);
		expect((await dispatch.dispatchBatch([update('group')])).success).toBe(false);
		expect(processBatch).not.toHaveBeenCalled();
	});
	it('keeps unavailable and throwing members in partial outcomes and still attempts valid leaves', async () => {
		const { dispatch, processBatch } = setup([
			{ memberId: 'a', update: update('a') },
			{ memberId: 'b', update: update('b') },
			{ memberId: 'missing', update: null },
		]);
		processBatch.mockRejectedValueOnce(new Error('provider exception'));
		const result = await dispatch.dispatchBatch([update('group')]);
		expect(result.composite.status).toBe('partial');
		expect(result.composite.children.map((child) => child.status)).toEqual(['failed', 'confirmed', 'unavailable']);
		expect(processBatch).toHaveBeenCalledTimes(2);
	});
	it('fences remaps and late replacement generations', async () => {
		const fixture = setup([{ memberId: 'a', update: update('a') }]);
		fixture.processBatch.mockImplementationOnce(async () => {
			fixture.invalidate();
			return true;
		});
		const result = await fixture.dispatch.dispatchBatch([update('group')], { ttlMs: 100 });
		expect(result.composite.children[0].status).toBe('superseded');
		expect(fixture.windows.get('a')).toBeNull();
	});
	it('terminates a hung platform at the total deadline without accepting its late confirmation', async () => {
		const fixture = setup([{ memberId: 'a', update: update('a') }]);
		fixture.processBatch.mockImplementationOnce(() => new Promise<boolean>(() => {}));
		const result = await fixture.dispatch.dispatchBatch([update('group')], { ttlMs: 30 });
		expect(result.composite.status).toBe('failed');
		expect(result.composite.children[0].status).toBe('timed_out');
		expect(fixture.windows.get('a')).toBeNull();
	});
});
