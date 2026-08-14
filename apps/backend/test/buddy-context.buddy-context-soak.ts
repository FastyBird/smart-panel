import { ActionObserverService } from '../src/modules/buddy/services/action-observer.service';
import { BuddyContextService } from '../src/modules/buddy/services/buddy-context.service';
import {
	BUDDY_CONTEXT_SCALE_DEVICE_COUNTS,
	BUDDY_CONTEXT_SOAK_DEVICE_COUNT,
	createBuddyContextFixture,
	createBuddyDeviceEntityFixtures,
} from '../src/modules/buddy/testing/buddy-context-evaluation.fixtures';
import { ConfigService } from '../src/modules/config/services/config.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { EnergyDataService } from '../src/modules/energy/services/energy-data.service';
import { ScenesService } from '../src/modules/scenes/services/scenes.service';
import { SpacesService } from '../src/modules/spaces/services/spaces.service';
import { WeatherService } from '../src/modules/weather/services/weather.service';

const BUDDY_CONTEXT_SOAK_COUNTS = [...BUDDY_CONTEXT_SCALE_DEVICE_COUNTS, BUDDY_CONTEXT_SOAK_DEVICE_COUNT] as const;

describe('Buddy context scale soak', () => {
	it.each(BUDDY_CONTEXT_SOAK_COUNTS)(
		'records the eager $deviceCount-device snapshot query, result, latency, and heap footprint',
		async (deviceCount) => {
			const rawDevices = createBuddyDeviceEntityFixtures(deviceCount, { spaceCount: 20 });
			const expectedContext = createBuddyContextFixture(deviceCount, { spaceCount: 20 });
			const spaces = expectedContext.spaces.map((space) => ({
				id: space.id,
				name: space.name,
				category: space.category,
			}));
			const spacesService = {
				findAll: jest.fn().mockResolvedValue(spaces),
				findOne: jest.fn(),
				findDevicesBySpace: jest
					.fn()
					.mockImplementation((spaceId: string) =>
						Promise.resolve(rawDevices.filter((device) => device.roomId === spaceId)),
					),
			};
			const devicesService = { findAll: jest.fn().mockResolvedValue(rawDevices) };
			const scenesService = { findAll: jest.fn().mockResolvedValue([]), findBySpace: jest.fn().mockResolvedValue([]) };
			const weatherService = { getPrimaryWeather: jest.fn().mockResolvedValue(null) };
			const energyDataService = { getDeltas: jest.fn().mockResolvedValue([]) };
			const configService = { getModuleConfig: jest.fn().mockReturnValue({ timezone: 'UTC' }) };
			const service = new BuddyContextService(
				configService as unknown as ConfigService,
				spacesService as unknown as SpacesService,
				devicesService as unknown as DevicesService,
				scenesService as unknown as ScenesService,
				weatherService as unknown as WeatherService,
				energyDataService as unknown as EnergyDataService,
				new ActionObserverService(),
			);
			const heapBefore = process.memoryUsage().heapUsed;
			const startedAt = performance.now();
			const context = await service.buildContext();
			const durationMs = performance.now() - startedAt;
			const heapDeltaBytes = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
			const serializedBytes = Buffer.byteLength(JSON.stringify(context), 'utf8');
			const propertyCount = context.devices.reduce(
				(total, device) =>
					total + device.channels.reduce((channelTotal, channel) => channelTotal + channel.properties.length, 0),
				0,
			);

			expect(context.devices).toHaveLength(deviceCount);
			expect(propertyCount).toBe(deviceCount * 5);
			expect(context.devices.at(-1)?.id).toBe(expectedContext.devices.at(-1)?.id);
			expect(spacesService.findAll).toHaveBeenCalledTimes(1);
			expect(spacesService.findDevicesBySpace).toHaveBeenCalledTimes(spaces.length);
			expect(devicesService.findAll).toHaveBeenCalledTimes(1);
			expect(scenesService.findAll).toHaveBeenCalledTimes(1);
			expect(weatherService.getPrimaryWeather).toHaveBeenCalledTimes(1);
			expect(energyDataService.getDeltas).toHaveBeenCalledTimes(1);
			expect(durationMs).toBeLessThan(30_000);
			expect(heapDeltaBytes).toBeLessThan(512 * 1024 * 1024);

			process.stdout.write(
				`${JSON.stringify({
					deviceCount: context.devices.length,
					propertyCount,
					spaceCount: context.spaces.length,
					serializedBytes,
					durationMs: Math.round(durationMs * 100) / 100,
					heapDeltaBytes,
					spaceCountQueries: spacesService.findDevicesBySpace.mock.calls.length,
				})}\n`,
			);
		},
		60_000,
	);
});
