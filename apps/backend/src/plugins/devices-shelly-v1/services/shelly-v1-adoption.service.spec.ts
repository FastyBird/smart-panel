import { Test, TestingModule } from '@nestjs/testing';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { AdoptDeviceDto } from '../dto/adopt-devices.dto';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';

import { ShellyV1AdoptionService } from './shelly-v1-adoption.service';

describe('ShellyV1AdoptionService', () => {
	let service: ShellyV1AdoptionService;
	let devicesService: { findOneBy: jest.Mock; create: jest.Mock; update: jest.Mock };

	const selection = (overrides: Partial<AdoptDeviceDto> = {}): AdoptDeviceDto =>
		({
			identifier: 'shelly1-a4cf12df3b21',
			hostname: '192.168.1.100',
			name: 'Kitchen light',
			category: DeviceCategory.LIGHTING,
			password: null,
			...overrides,
		}) as AdoptDeviceDto;

	beforeEach(async () => {
		devicesService = {
			findOneBy: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockImplementation(() => Promise.resolve({ id: 'new-device' } as ShellyV1DeviceEntity)),
			update: jest.fn().mockImplementation(() => Promise.resolve({ id: 'existing' } as ShellyV1DeviceEntity)),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [ShellyV1AdoptionService, { provide: DevicesService, useValue: devicesService }],
		}).compile();

		service = module.get<ShellyV1AdoptionService>(ShellyV1AdoptionService);
	});

	it('creates a device that is not registered yet', async () => {
		const [outcome] = await service.adopt([selection()]);

		expect(outcome.status).toBe('created');
		expect(outcome.deviceId).toBe('new-device');
		expect(devicesService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: DEVICES_SHELLY_V1_TYPE,
				identifier: 'shelly1-a4cf12df3b21',
				name: 'Kitchen light',
				category: DeviceCategory.LIGHTING,
				hostname: '192.168.1.100',
			}),
		);
	});

	it('updates a device the connector already registered', async () => {
		devicesService.findOneBy.mockResolvedValue({ id: 'existing' } as ShellyV1DeviceEntity);

		const [outcome] = await service.adopt([selection()]);

		expect(outcome.status).toBe('updated');
		expect(outcome.deviceId).toBe('existing');
		expect(devicesService.create).not.toHaveBeenCalled();
		expect(devicesService.update).toHaveBeenCalledWith('existing', expect.objectContaining({ name: 'Kitchen light' }));
	});

	// The whole point of adopting here rather than in the browser: the connector
	// can register a device between the lookup and the create, and the answer is
	// a local re-read instead of the browser re-polling discovery.
	it('treats a device the connector registered mid-request as an update', async () => {
		devicesService.findOneBy
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: 'raced-in' } as ShellyV1DeviceEntity);
		devicesService.create.mockRejectedValue(new Error('UNIQUE constraint failed: devices.identifier'));

		const [outcome] = await service.adopt([selection()]);

		expect(outcome.status).toBe('updated');
		expect(outcome.deviceId).toBe('raced-in');
		expect(devicesService.update).toHaveBeenCalledWith('raced-in', expect.anything());
	});

	it('reports a genuine create failure with its reason', async () => {
		devicesService.create.mockRejectedValue(new Error('Device could not be created'));

		const [outcome] = await service.adopt([selection()]);

		expect(outcome.status).toBe('failed');
		expect(outcome.error).toBe('Device could not be created');
		expect(outcome.deviceId).toBeNull();
	});

	// A blank password means the operator did not type one this session, not that
	// the stored one should be discarded.
	it('leaves a stored password alone when none was supplied', async () => {
		devicesService.findOneBy.mockResolvedValue({ id: 'existing' } as ShellyV1DeviceEntity);

		await service.adopt([selection({ password: null })]);

		// The key has to be absent, not present-and-null: `expect.anything()` does
		// not match null, so an `objectContaining` assertion here would pass either
		// way and prove nothing.
		const [, dto] = devicesService.update.mock.calls[0] as [string, Record<string, unknown>];

		expect(Object.keys(dto)).not.toContain('password');
	});

	it('sends a password the operator did supply', async () => {
		devicesService.findOneBy.mockResolvedValue({ id: 'existing' } as ShellyV1DeviceEntity);

		await service.adopt([selection({ password: 'hunter2' })]);

		expect(devicesService.update).toHaveBeenCalledWith('existing', expect.objectContaining({ password: 'hunter2' }));
	});

	it('adopts the rest of the selection after one device fails', async () => {
		devicesService.create.mockImplementation((dto: { identifier: string }) =>
			dto.identifier === 'bad' ? Promise.reject(new Error('nope')) : Promise.resolve({ id: dto.identifier }),
		);

		const outcomes = await service.adopt([
			selection({ identifier: 'first' }),
			selection({ identifier: 'bad' }),
			selection({ identifier: 'last' }),
		]);

		expect(outcomes.map((outcome) => outcome.status)).toEqual(['created', 'failed', 'created']);
	});
});
