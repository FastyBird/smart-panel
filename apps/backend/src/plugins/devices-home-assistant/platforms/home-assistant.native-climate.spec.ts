import type { NativeClimateUnit } from '../../../modules/devices/platforms/native-climate.contract';
import { HomeAssistantDeviceEntity } from '../entities/devices-home-assistant.entity';

import { HomeAssistantDevicePlatform } from './home-assistant.device.platform';

describe('native HA ownership and original ordinary transport', () => {
	it('withholds native admission while original ordinary work awaits and never revives its previous capture', async () => {
		let release!: (value: never[]) => void;
		const mapper = {
			mapToHA: jest.fn(
				() =>
					new Promise<never[]>((resolve) => {
						release = resolve;
					}),
			),
		};
		const native: NativeClimateUnit = {
			contractVersion: 1,
			provider: 'home-assistant',
			deviceId: 'unit',
			physicalIdentity: 'ha:unit',
			fingerprint: 'v1',
			ownedPropertyIds: ['mode'],
			capabilities: {
				modes: ['off', 'heat'],
				heating: { minimum: 5, maximum: 30, step: 0.5 },
				cooling: null,
				supportsCompound: true,
			},
			isCurrent: () => true,
			observe: () => ({
				available: false,
				temperature: null,
				mode: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
				activity: null,
				observedAt: null,
				reasons: [],
			}),
			prepare: () => ({
				isCurrent: () => true,
				dispatch: (admitted) =>
					Promise.resolve([{ operation: 'mode', outcome: admitted() ? 'accepted' : 'refused', confirmed: false }]),
			}),
		};
		const platform = new HomeAssistantDevicePlatform(
			{} as never,
			mapper as never,
			{} as never,
			{ capture: () => Promise.resolve(native) } as never,
		);
		const device = Object.assign(new HomeAssistantDeviceEntity(), { id: 'unit', enabled: true });
		const old = await platform.captureNativeClimateUnit(device);
		const prepared = old.prepare({ mode: 'heat' });
		const ordinary = platform.processBatch([
			{ device, channel: {} as never, property: { id: 'mode' } as never, value: 'off' },
		]);
		expect(old.isCurrent()).toBe(false);
		expect(await platform.captureNativeClimateUnit(device)).toBeNull();
		expect(await prepared.dispatch(() => true)).toMatchObject([{ outcome: 'refused' }]);
		release([]);
		await ordinary;
		expect(old.isCurrent()).toBe(false);
		expect((await platform.captureNativeClimateUnit(device)).isCurrent()).toBe(true);
	});
});
