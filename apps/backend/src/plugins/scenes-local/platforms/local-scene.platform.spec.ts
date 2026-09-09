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
		expect(results.map((result) => result.success)).toEqual([true, false]);
	});
});
