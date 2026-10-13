/* eslint-disable @typescript-eslint/require-await -- Async platform/metadata fixture methods intentionally implement provider contracts. */
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ShellyNgDeviceEntity } from '../../../plugins/devices-shelly-ng/entities/devices-shelly-ng.entity';
import { WledDeviceEntity } from '../../../plugins/devices-wled/entities/devices-wled.entity';
import { DataTypeType, PermissionType } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePropertyData } from '../platforms/device.platform';

import {
	CompositeCommandChild,
	CompositePropertyCommandRegistryService,
} from './composite-property-command.registry.service';
import { PropertyCommandDispatchService } from './property-command-dispatch.service';
import { PropertyCommandWindowService } from './property-command-window.service';

const update = (id: string, value = true, deviceEntity = new DeviceEntity()): IDevicePropertyData => {
	const device = Object.assign(deviceEntity, { id: `device-${id}`, enabled: true });
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
		const events = new EventEmitter2();
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
		const platforms = new Map(
			physical.map((target) => [
				target.device.type,
				(() => {
					const batch = jest.fn((targets: IDevicePropertyData[]) => processBatch(targets));
					return {
						processBatch: batch,
						prepareCompositeBatch: (targets: IDevicePropertyData[]) =>
							Promise.resolve({
								updates: targets,
								isCurrent: () => true,
								dispatch: (isAdmitted: () => boolean) => (isAdmitted() ? batch(targets) : Promise.resolve(false)),
							}),
					};
				})(),
			]),
		);
		const platform = {
			get: (device: DeviceEntity) => platforms.get(device.type) ?? null,
			usesAuthoritativePropertyReadback: () => false,
		};
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
			events,
		);
		return {
			dispatch,
			windows,
			events,
			processBatch,
			platforms,
			invalidate: () => {
				current = false;
			},
		};
	};
	it('confirms different physical platforms/channels independently and deduplicates equal leaves', async () => {
		const a = update('a', true, new WledDeviceEntity());
		const b = update('b', true, new ShellyNgDeviceEntity());
		const { dispatch, processBatch, platforms } = setup([
			{ memberId: 'a', update: a },
			{ memberId: 'alias-a', update: a },
			{ memberId: 'b', update: b },
		]);
		const result = await dispatch.dispatchBatch([update('group')]);
		expect(result.success).toBe(true);
		expect(result.composite.children).toHaveLength(3);
		expect(result.composite.children.every((child) => child.status === 'confirmed')).toBe(true);
		expect(processBatch).toHaveBeenCalledTimes(2);
		expect(platforms.size).toBe(2);
		for (const platform of platforms.values()) expect(platform.processBatch).toHaveBeenCalledTimes(1);
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
	it('preserves one compound physical channel batch rather than racing individual RGB writes', async () => {
		const red = update('red');
		const green = update('green');
		const blue = update('blue');
		for (const component of [green, blue]) {
			component.device = red.device;
			component.channel = red.channel;
			component.property.channel = red.channel;
		}
		const fixture = setup([
			{ memberId: 'light', update: red },
			{ memberId: 'light', update: green },
			{ memberId: 'light', update: blue },
		]);
		fixture.processBatch.mockImplementationOnce(async (targets) => {
			for (const target of targets) {
				const window = fixture.windows.get(target.property.id);
				fixture.windows.confirm(
					{ canonicalPropertyId: target.property.id, generation: window.generation },
					{ value: target.value, receivedAt: Date.now() },
				);
			}
			return true;
		});
		const result = await fixture.dispatch.dispatchBatch([update('group')]);
		expect(result.composite.status).toBe('confirmed');
		expect(fixture.processBatch).toHaveBeenCalledTimes(1);
		expect(fixture.processBatch.mock.calls[0][0]).toHaveLength(3);
	});
	it('supersedes an early confirmed child when a newer direct command arrives before parent completion', async () => {
		const fixture = setup([
			{ memberId: 'a', update: update('a') },
			{ memberId: 'b', update: update('b') },
		]);
		fixture.processBatch.mockImplementation(async (targets) => {
			if (targets[0].property.id === 'a') {
				const window = fixture.windows.get('a');
				fixture.windows.confirm(
					{ canonicalPropertyId: 'a', generation: window.generation },
					{ value: targets[0].value, receivedAt: Date.now() },
				);
			}
			return true;
		});
		const pending = fixture.dispatch.dispatchBatch([update('group')], { ttlMs: 500 });
		while (fixture.processBatch.mock.calls.length < 2) await new Promise<void>((resolve) => setImmediate(resolve));
		await new Promise<void>((resolve) => setImmediate(resolve));
		await fixture.dispatch.dispatchBatch([update('a', false)]);
		const b = fixture.windows.get('b');
		fixture.windows.confirm(
			{ canonicalPropertyId: 'b', generation: b.generation },
			{ value: true, receivedAt: Date.now() },
		);
		const result = await pending;
		expect(result.composite.status).toBe('partial');
		expect(result.composite.children.map((child) => child.status)).toEqual(['superseded', 'confirmed']);
	});
	it('consults the same internal ownership admission hook for every expanded leaf', async () => {
		const fixture = setup([
			{ memberId: 'a', update: update('a') },
			{ memberId: 'b', update: update('b') },
		]);
		const guard = {
			assertAllowed: jest.fn(async (target: IDevicePropertyData) => {
				if (target.property.id === 'a') throw new Error('Controller owns leaf');
			}),
		};
		Object.assign(fixture.dispatch, { admissionGuards: guard });
		const result = await fixture.dispatch.dispatchBatch([update('group')]);
		expect(result.composite.status).toBe('partial');
		expect(result.composite.children.map((child) => child.status)).toEqual(['failed', 'confirmed']);
		expect(fixture.processBatch).toHaveBeenCalledTimes(1);
	});
	it('releases parent observers after terminal completion and preserves its immutable child snapshot', async () => {
		const fixture = setup([{ memberId: 'a', update: update('a') }]);
		const progress = jest.fn();
		fixture.events.on('DevicesModule.CompositeCommand.Progress', progress);
		const result = await fixture.dispatch.dispatchBatch([update('group')]);
		const count = progress.mock.calls.length;
		await fixture.dispatch.dispatchBatch([update('a', false)]);
		expect(progress).toHaveBeenCalledTimes(count);
		expect(result.composite.children[0].status).toBe('confirmed');
	});
	it('disposes active parent generations on module shutdown and refuses new parents', async () => {
		const fixture = setup([{ memberId: 'a', update: update('a') }]);
		let entered: () => void = () => undefined;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		fixture.processBatch.mockImplementationOnce(() => {
			entered();
			return Promise.resolve(true);
		});
		const pending = fixture.dispatch.dispatchBatch([update('group')], { ttlMs: 10_000 });
		await started;
		fixture.dispatch.onModuleDestroy();
		const result = await pending;
		expect(result.composite.children[0].status).toBe('superseded');
		expect(fixture.windows.get('a')).toBeNull();
		expect((await fixture.dispatch.dispatchBatch([update('group')])).success).toBe(false);
	});
	it('budgets multiple worker waves from expanded physical channels and caps the total deadline', async () => {
		const registry = new CompositePropertyCommandRegistryService();
		let count = 9;
		registry.register({
			canHandle: (property) => property.id === 'group',
			plan: () =>
				Promise.resolve({
					revision: 1,
					children: Array.from({ length: count }, (_, index) => ({
						memberId: String(index),
						update: update(String(index)),
					})),
					isCurrent: () => Promise.resolve(true),
				}),
		});
		expect(await registry.estimateTimeoutMs([update('group')])).toBe(9_000);
		count = 256;
		expect(await registry.estimateTimeoutMs([update('group')])).toBe(30_000);
		expect(await registry.estimateTimeoutMs([update('ordinary')])).toBeNull();
	});
	it('admits exact prepared target values and dispatches through the captured provider lease', async () => {
		const target = update('a');
		target.property.dataType = DataTypeType.FLOAT;
		target.property.step = null;
		target.value = 0.46;
		const fixture = setup([{ memberId: 'a', update: target }]);
		const preparedDispatch = jest.fn((targets: IDevicePropertyData[]) => fixture.processBatch(targets));
		Object.assign(fixture.platforms.get(target.device.type), {
			prepareCompositeBatch: (targets: IDevicePropertyData[]) => {
				const prepared = targets.map((target) => ({ ...target, value: 0.5 }));
				return Promise.resolve({
					updates: prepared,
					isCurrent: () => true,
					dispatch: () => preparedDispatch(prepared),
				});
			},
		});
		const result = await fixture.dispatch.dispatchBatch([update('group')]);
		expect(result.composite.children[0]).toMatchObject({ value: 0.5, status: 'confirmed' });
		expect(preparedDispatch).toHaveBeenCalledTimes(1);
		expect(fixture.processBatch.mock.calls[0][0][0].value).toBe(0.5);
	});
	it('refuses a changed prepared provider identity before physical I/O', async () => {
		const target = update('a');
		const fixture = setup([{ memberId: 'a', update: target }]);
		const isCurrent = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false);
		Object.assign(fixture.platforms.get(target.device.type), {
			prepareCompositeBatch: (targets: IDevicePropertyData[]) =>
				Promise.resolve({ updates: targets, isCurrent, dispatch: () => fixture.processBatch(targets) }),
		});
		const result = await fixture.dispatch.dispatchBatch([update('group')]);
		expect(result.composite.children[0].status).toBe('superseded');
		expect(fixture.processBatch).not.toHaveBeenCalled();
	});
	it('retains an unqualified provider as unavailable while dispatching an independent prepared platform', async () => {
		const a = update('a', true, new WledDeviceEntity());
		const b = update('b', true, new ShellyNgDeviceEntity());
		const fixture = setup([
			{ memberId: 'a', update: a },
			{ memberId: 'b', update: b },
		]);
		Object.assign(fixture.platforms.get(a.device.type), { prepareCompositeBatch: () => Promise.resolve(null) });
		const result = await fixture.dispatch.dispatchBatch([update('group')]);
		expect(result.composite.status).toBe('partial');
		expect(result.composite.children.map((child) => child.status)).toEqual(['unavailable', 'confirmed']);
		expect(fixture.processBatch).toHaveBeenCalledTimes(1);
	});
	it('passes an exact admission guard to a delayed provider queue so a superseded command cannot publish', async () => {
		const target = update('a');
		const fixture = setup([{ memberId: 'a', update: target }]);
		let release: () => void = () => undefined;
		let queued: () => void = () => undefined;
		const waiting = new Promise<void>((resolve) => {
			release = resolve;
		});
		const entered = new Promise<void>((resolve) => {
			queued = resolve;
		});
		Object.assign(fixture.platforms.get(target.device.type), {
			prepareCompositeBatch: (targets: IDevicePropertyData[]) =>
				Promise.resolve({
					updates: targets,
					isCurrent: () => true,
					dispatch: async (isAdmitted: () => boolean) => {
						queued();
						await waiting;
						return isAdmitted() ? fixture.processBatch(targets) : false;
					},
				}),
		});
		const pending = fixture.dispatch.dispatchBatch([update('group')], { ttlMs: 500 });
		await entered;
		const replacement = fixture.windows.open({
			canonicalTarget: { deviceId: target.device.id, channelId: target.channel.id, propertyId: target.property.id },
			requestedTargets: [],
			commandedValue: false,
			previousValue: true,
			ttlMs: 500,
		});
		release();
		const result = await pending;
		expect(result.composite.children[0].status).toBe('superseded');
		expect(fixture.processBatch).not.toHaveBeenCalled();
		expect(fixture.windows.get('a')?.generation).toBe(replacement.generation);
	});
	it('cleans earlier compound windows when a later canonical admission guard rejects', async () => {
		const a = update('a');
		const b = update('b');
		b.device = a.device;
		b.channel = a.channel;
		b.property.channel = a.channel;
		const fixture = setup([
			{ memberId: 'light', update: a },
			{ memberId: 'light', update: b },
		]);
		Object.assign(fixture.dispatch, {
			admissionGuards: {
				assertAllowed: (target: IDevicePropertyData) =>
					target.property.id === 'b' ? Promise.reject(new Error('Controller owns leaf')) : Promise.resolve(),
			},
		});
		const result = await fixture.dispatch.dispatchBatch([update('group')]);
		expect(result.composite.status).toBe('failed');
		expect(fixture.windows.get('a')).toBeNull();
		expect(fixture.windows.get('b')).toBeNull();
		expect(fixture.processBatch).not.toHaveBeenCalled();
	});
	it('retains actual confirmation when the provider acknowledgement never arrives', async () => {
		const fixture = setup([{ memberId: 'a', update: update('a') }]);
		fixture.processBatch.mockImplementationOnce((targets) => {
			const window = fixture.windows.get('a');
			fixture.windows.confirm(
				{ canonicalPropertyId: 'a', generation: window.generation },
				{ value: targets[0].value, receivedAt: Date.now() },
			);
			return new Promise<boolean>(() => {});
		});
		const result = await fixture.dispatch.dispatchBatch([update('group')], { ttlMs: 100 });
		expect(result.composite.status).toBe('confirmed');
		expect(result.composite.children[0].status).toBe('confirmed');
	});
	it('refuses a legacy queued provider without a guarded publish lease before any I/O', async () => {
		const target = update('a');
		const fixture = setup([{ memberId: 'legacy', update: target }]);
		Object.assign(fixture.platforms.get(target.device.type), { prepareCompositeBatch: undefined });
		const result = await fixture.dispatch.dispatchBatch([update('group')]);
		expect(result.composite.children[0]).toMatchObject({
			status: 'unavailable',
			reason: 'Provider does not support the strict composite dispatch profile',
		});
		expect(fixture.processBatch).not.toHaveBeenCalled();
		expect(fixture.windows.get('a')).toBeNull();
	});
	it('checks a preserved power snapshot immediately before window admission and refuses changed targets without I/O', async () => {
		const fixture = setup([{ memberId: 'a', update: update('a'), admissionCheck: () => false }]);
		const result = await fixture.dispatch.dispatchBatch([update('group')]);
		expect(result.composite.children[0]).toMatchObject({
			status: 'superseded',
			reason: 'Preserved power snapshot changed before admission',
		});
		expect(fixture.processBatch).not.toHaveBeenCalled();
		expect(fixture.windows.get('a')).toBeNull();
	});
});
