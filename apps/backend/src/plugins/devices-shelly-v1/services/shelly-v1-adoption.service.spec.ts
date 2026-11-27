import { Test, TestingModule } from '@nestjs/testing';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DeviceProvisionQueueService } from '../../../modules/devices/services/device-provision-queue.service';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { AdoptDeviceDto } from '../dto/adopt-devices.dto';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';

import { ShellyV1AdoptedIdentityService, ShellyV1AdoptionState } from './shelly-v1-adopted-identity.service';
import { ShellyV1AdoptionService } from './shelly-v1-adoption.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

describe('ShellyV1AdoptionService', () => {
	let module: TestingModule | undefined;
	let service: ShellyV1AdoptionService;
	let identities: {
		captureDevice: jest.Mock;
		captureDiscovery: jest.Mock;
		createDevice: jest.Mock<Promise<ShellyV1DeviceEntity>, [CreateShellyV1DeviceDto]>;
		updateDevice: jest.Mock;
	};
	let getDeviceInfo: jest.Mock;

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
		identities = {
			captureDevice: jest.fn().mockResolvedValue(null),
			captureDiscovery: jest.fn(async (identifier: string) => ({
				exact: (await identities.captureDevice(identifier)) as ShellyV1AdoptionState | null,
				aliases: [],
			})),
			createDevice: jest
				.fn<Promise<ShellyV1DeviceEntity>, [CreateShellyV1DeviceDto]>()
				.mockResolvedValue(Object.assign(new ShellyV1DeviceEntity(), { id: 'new-device' })),
			updateDevice: jest.fn().mockImplementation(() => Promise.resolve({ id: 'existing' } as ShellyV1DeviceEntity)),
		};

		getDeviceInfo = jest.fn().mockResolvedValue(null);
		module = await Test.createTestingModule({
			providers: [
				ShellyV1AdoptionService,
				DeviceProvisionQueueService,
				{ provide: ShellyV1AdoptedIdentityService, useValue: identities },
				{ provide: ShellyV1HttpClientService, useValue: { getDeviceInfo } },
			],
		}).compile();

		service = module.get<ShellyV1AdoptionService>(ShellyV1AdoptionService);
	});

	it.each([true, false])(
		'uses an explicit adoption to establish a missing legacy pin and refuses a conflicting endpoint (matches=%s)',
		async (matches) => {
			const chosen = selection({ identifier: 'DDEEFF' });
			identities.captureDevice.mockResolvedValue({
				id: 'legacy',
				identifier: chosen.identifier,
				hostname: chosen.hostname,
			});
			getDeviceInfo.mockResolvedValue({ mac: 'aabbccddeeff' });
			if (!matches)
				identities.updateDevice.mockRejectedValue(new Error('Endpoint does not match the adopted hardware identity.'));
			const [result] = await service.adopt([chosen]);
			expect(identities.updateDevice).toHaveBeenCalledWith(
				expect.objectContaining({ id: 'legacy' }),
				expect.objectContaining({ hostname: chosen.hostname }),
				'AABBCCDDEEFF',
			);
			expect(result.status).toBe(matches ? 'updated' : 'failed');
		},
	);

	it('creates a device that is not registered yet', async () => {
		const [outcome] = await service.adopt([selection()]);

		expect(outcome.status).toBe('created');
		expect(outcome.deviceId).toBe('new-device');
		expect(identities.createDevice).toHaveBeenCalledWith(
			expect.objectContaining({
				type: DEVICES_SHELLY_V1_TYPE,
				identifier: 'shelly1-a4cf12df3b21',
				name: 'Kitchen light',
				category: DeviceCategory.LIGHTING,
				hostname: '192.168.1.100',
			}),
			undefined,
		);
	});

	it('updates a device the connector already registered', async () => {
		identities.captureDevice.mockResolvedValue({ id: 'existing' } as ShellyV1DeviceEntity);

		const [outcome] = await service.adopt([selection()]);

		expect(outcome.status).toBe('updated');
		expect(outcome.deviceId).toBe('existing');
		expect(identities.createDevice).not.toHaveBeenCalled();
		expect(identities.updateDevice).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'existing' }),
			expect.objectContaining({ name: 'Kitchen light' }),
			undefined,
		);
	});

	// The whole point of adopting here rather than in the browser: the connector
	// can register a device between the lookup and the create, and the answer is
	// a local re-read instead of the browser re-polling discovery.
	it('treats a device the connector registered mid-request as an update', async () => {
		identities.captureDevice
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: 'raced-in' } as ShellyV1DeviceEntity);
		identities.createDevice.mockRejectedValue(new Error('UNIQUE constraint failed: devices.identifier'));

		const [outcome] = await service.adopt([selection()]);

		expect(outcome.status).toBe('updated');
		expect(outcome.deviceId).toBe('raced-in');
		expect(identities.updateDevice).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'raced-in' }),
			expect.anything(),
			undefined,
		);
	});

	it('reports a genuine create failure with its reason', async () => {
		identities.createDevice.mockRejectedValue(new Error('Device could not be created'));

		const [outcome] = await service.adopt([selection()]);

		expect(outcome.status).toBe('failed');
		expect(outcome.error).toBe('Device could not be created');
		expect(outcome.deviceId).toBeNull();
	});

	// A blank password means the operator did not type one this session, not that
	// the stored one should be discarded.
	it('leaves a stored password alone when none was supplied', async () => {
		identities.captureDevice.mockResolvedValue({ id: 'existing' } as ShellyV1DeviceEntity);

		await service.adopt([selection({ password: null })]);

		// The key has to be absent, not present-and-null: `expect.anything()` does
		// not match null, so an `objectContaining` assertion here would pass either
		// way and prove nothing.
		const [, dto] = identities.updateDevice.mock.calls[0] as [ShellyV1AdoptionState, Record<string, unknown>];

		expect(Object.keys(dto)).not.toContain('password');
	});

	it('sends a password the operator did supply', async () => {
		identities.captureDevice.mockResolvedValue({ id: 'existing' } as ShellyV1DeviceEntity);

		await service.adopt([selection({ password: 'hunter2' })]);

		expect(identities.updateDevice).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'existing' }),
			expect.objectContaining({ password: 'hunter2' }),
			undefined,
		);
	});

	it('adopts the rest of the selection after one device fails', async () => {
		identities.createDevice.mockImplementation((dto) =>
			dto.identifier === 'bad'
				? Promise.reject(new Error('nope'))
				: Promise.resolve(Object.assign(new ShellyV1DeviceEntity(), { id: dto.identifier })),
		);

		const outcomes = await service.adopt([
			selection({ identifier: 'first' }),
			selection({ identifier: 'bad' }),
			selection({ identifier: 'last' }),
		]);

		expect(outcomes.map((outcome) => outcome.status)).toEqual(['created', 'failed', 'created']);
	});

	afterEach(async () => {
		const moduleToClose = module;
		module = undefined;
		await moduleToClose?.close();
	});
});
