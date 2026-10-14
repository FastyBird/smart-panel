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
