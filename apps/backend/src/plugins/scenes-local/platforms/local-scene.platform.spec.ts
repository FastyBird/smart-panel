/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { PropertyCommandDispatchService } from '../../../modules/devices/services/property-command-dispatch.service';
import { SCENES_LOCAL_TYPE } from '../scenes-local.constants';

import { LocalScenePlatform } from './local-scene.platform';

describe('LocalScenePlatform', () => {
	test('tracks each valid action through one dispatch while retaining partial failures', async () => {
		const dispatchBatch = jest.fn().mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
		const platform = new LocalScenePlatform(
			{} as any,
			{} as any,
			{} as any,
			{ get: jest.fn().mockReturnValue({}) } as any,
			{ dispatchBatch } as unknown as PropertyCommandDispatchService,
			{} as any,
		);
		const device = { id: 'device-1', type: 'test' } as any;
		const channel = { id: 'channel-1' } as any;
		const property = { id: 'property-1' } as any;
		jest.spyOn(platform, 'validateActionWithDetails').mockResolvedValue({ valid: true, device, channel, property });

		const actions = [
			{ id: 'action-1', type: SCENES_LOCAL_TYPE, deviceId: device.id, propertyId: property.id, value: true },
			{ id: 'action-2', type: SCENES_LOCAL_TYPE, deviceId: device.id, propertyId: property.id, value: false },
		] as any;

		const results = await platform.execute({} as any, actions);

		expect(dispatchBatch).toHaveBeenCalledTimes(2);
		expect(dispatchBatch).toHaveBeenNthCalledWith(1, [
			expect.objectContaining({ device, channel, property, value: true }),
		]);
		expect(dispatchBatch).toHaveBeenNthCalledWith(2, [
			expect.objectContaining({ device, channel, property, value: false }),
		]);
		expect(results.map((result) => result.success)).toEqual([true, false]);
	});

	test.each([
		['switcher', 'bool', true, null],
		['outlet', 'bool', false, null],
		['fan', 'enum', 'low', ['low', 'high']],
		['window_covering', 'enum', 'stop', ['open', 'close', 'stop']],
	])(
		'validates %s native group actions and retains composite children and deadline',
		async (category, dataType, value, format) => {
			const device = { id: 'group', type: 'virtual', mode: 'actuator_group', category };
			const channel = { id: 'group-channel', device };
			const property = {
				id: 'output',
				category: category === 'window_covering' ? 'command' : category === 'fan' ? 'speed' : 'on',
				dataType,
				format,
				permissions: ['ro'],
			};
			const composite = {
				id: 'parent',
				status: 'partial',
				children: [
					{ memberIdentity: 'a', status: 'confirmed' },
					{ memberIdentity: 'b', status: 'unavailable', reason: 'disconnected' },
				],
			};
			const dispatchBatch = jest.fn().mockResolvedValue({ success: false, composite });
			const platform = new LocalScenePlatform(
				{ findOne: () => Promise.resolve(device) } as any,
				{ findOne: () => Promise.resolve(channel) } as any,
				{ findOne: () => Promise.resolve(property) } as any,
				{ get: () => ({}), getCommandTtlMs: () => 5000 } as any,
				{ dispatchBatch } as any,
				{} as any,
				{ get: () => ({}), estimateTimeoutMs: () => Promise.resolve(30000) } as any,
			);
			const action = {
				id: 'scene-action',
				type: SCENES_LOCAL_TYPE,
				deviceId: device.id,
				channelId: channel.id,
				propertyId: property.id,
				value,
			};
			expect(await platform.validateAction(action as any)).toBe(true);
			expect(await platform.getCommandTtlMs([action as any])).toBe(30000);
			const context = { intentId: 'scene', deadlineAt: Date.now() + 1000 };
			const result = await platform.execute({} as any, [action as any], context);
			expect(result[0]).toMatchObject({ success: false, composite });
			expect(dispatchBatch).toHaveBeenCalledTimes(1);
			expect(dispatchBatch.mock.calls[0][1]).toMatchObject(context);
			expect(dispatchBatch.mock.calls[0][1].ttlMs).toBeLessThanOrEqual(1000);
		},
	);

	test('commits adjacent distinct thermostat settings in one command batch', async () => {
		const dispatchBatch = jest.fn().mockResolvedValue({ success: true });
		const platform = new LocalScenePlatform(
			{} as any,
			{} as any,
			{} as any,
			{ get: jest.fn().mockReturnValue({}) } as any,
			{ dispatchBatch } as unknown as PropertyCommandDispatchService,
			{} as any,
		);
		const device = { id: 'controller', type: 'virtual', mode: 'climate_controller' } as any;
		const channel = { id: 'heater' } as any;
		const on = { id: 'heater-on' } as any;
		const setpoint = { id: 'heater-setpoint' } as any;
		jest.spyOn(platform, 'validateActionWithDetails').mockImplementation((action) =>
			Promise.resolve({
				valid: true,
				device,
				channel,
				property: (action as { propertyId?: string }).propertyId === on.id ? on : setpoint,
			}),
		);
		const actions = [
			{ id: 'enable', type: SCENES_LOCAL_TYPE, deviceId: device.id, propertyId: on.id, value: true },
			{ id: 'bound', type: SCENES_LOCAL_TYPE, deviceId: device.id, propertyId: setpoint.id, value: 22 },
		] as any;

		const results = await platform.execute({} as any, actions);

		expect(dispatchBatch).toHaveBeenCalledTimes(1);
		expect(dispatchBatch).toHaveBeenCalledWith([
			expect.objectContaining({ property: on, value: true }),
			expect.objectContaining({ property: setpoint, value: 22 }),
		]);
		expect(results.map((result) => [result.actionId, result.success])).toEqual([
			['enable', true],
			['bound', true],
		]);
		const repeated = await platform.execute(
			{} as any,
			[
				{ id: 'first', type: SCENES_LOCAL_TYPE, deviceId: device.id, propertyId: on.id, value: true },
				{ id: 'second', type: SCENES_LOCAL_TYPE, deviceId: device.id, propertyId: on.id, value: false },
				{ id: 'third', type: SCENES_LOCAL_TYPE, deviceId: device.id, propertyId: setpoint.id, value: 23 },
			] as any,
		);
		expect(dispatchBatch).toHaveBeenCalledTimes(3);
		expect(dispatchBatch).toHaveBeenNthCalledWith(2, [expect.objectContaining({ property: on, value: true })]);
		expect(dispatchBatch).toHaveBeenNthCalledWith(3, [
			expect.objectContaining({ property: on, value: false }),
			expect.objectContaining({ property: setpoint, value: 23 }),
		]);
		expect(repeated.map((result) => result.actionId)).toEqual(['first', 'second', 'third']);
		const context = { intentId: 'scene-parent', deadlineAt: Date.now() + 250 };
		await platform.execute({} as any, actions, context);
		expect(dispatchBatch).toHaveBeenNthCalledWith(
			4,
			[expect.objectContaining({ property: on }), expect.objectContaining({ property: setpoint })],
			expect.objectContaining({ ...context, ttlMs: expect.any(Number) }),
		);
		const options = dispatchBatch.mock.calls[3][1] as { ttlMs: number };
		expect(options.ttlMs).toBeLessThanOrEqual(250);
		expect(options.ttlMs).toBeGreaterThan(0);
	});
});
