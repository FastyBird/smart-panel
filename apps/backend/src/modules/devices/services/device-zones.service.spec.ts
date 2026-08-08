/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: Asserting on a jest mock reads the method off the mocked repository,
which this rule flags even though there is no `this` binding involved.
*/
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpaceType } from '../../spaces/spaces.constants';
import { DevicesNotAllowedException } from '../devices.exceptions';
import { DeviceZoneEntity } from '../entities/device-zone.entity';
import { DeviceEntity } from '../entities/devices.entity';

import { DeviceZonesService } from './device-zones.service';

describe('DeviceZonesService', () => {
	let eventEmitter: { emit: jest.Mock };
	let service: DeviceZonesService;
	let repository: Repository<DeviceZoneEntity>;
	let deviceRepository: Repository<DeviceEntity>;
	let spaceRepository: Repository<SpaceEntity>;

	const deviceId = uuid().toString();
	const zoneId = uuid().toString();

	beforeEach(async () => {
		eventEmitter = { emit: jest.fn() };

		// `metadata.tableName` and `manager.query` are here because the membership insert is a single
		// conditional statement rather than a `save()`: it inserts only while the device is still visible,
		// so the check cannot be overtaken by a hide committing between the guard and the write.
		const mockRepository = () => ({
			find: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn((value: unknown) => value),
			save: jest.fn((value: unknown) => Promise.resolve(value)),
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
			metadata: { tableName: 'table' },
			manager: {
				query: jest.fn().mockResolvedValue(undefined),
				// The zone replacement runs as one transaction, so the callback is invoked with a manager of
				// its own; the stub hands back one whose visibility probe answers "still visible".
				transaction: jest.fn(async (run: (m: { query: jest.Mock }) => Promise<void>) => {
					await run({ query: jest.fn().mockResolvedValue([{ id: 'device' }]) });
				}),
			},
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DeviceZonesService,
				{ provide: getRepositoryToken(DeviceZoneEntity), useFactory: mockRepository },
				{ provide: getRepositoryToken(DeviceEntity), useFactory: mockRepository },
				{ provide: getRepositoryToken(SpaceEntity), useFactory: mockRepository },
				{ provide: EventEmitter2, useValue: eventEmitter },
			],
		}).compile();

		service = module.get<DeviceZonesService>(DeviceZonesService);
		repository = module.get<Repository<DeviceZoneEntity>>(getRepositoryToken(DeviceZoneEntity));
		deviceRepository = module.get<Repository<DeviceEntity>>(getRepositoryToken(DeviceEntity));
		spaceRepository = module.get<Repository<SpaceEntity>>(getRepositoryToken(SpaceEntity));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// `POST|DELETE /devices/:id/zones/:zoneId` change placement without going through
	// `DevicesService.update()`, so the guard there does not see them. Left unguarded they are a way
	// around it: a client refused a `zone_ids` PATCH on a hidden device could reach the same end state
	// one membership at a time. A hidden device is inert — changing its placement means unhiding first.
	describe('zone membership on a hidden device', () => {
		const arrangeDevice = (hidden: boolean): void => {
			jest.spyOn(deviceRepository, 'findOne').mockResolvedValue({ id: deviceId, hidden } as DeviceEntity);
			jest.spyOn(spaceRepository, 'findOne').mockResolvedValue({ id: zoneId, type: SpaceType.ZONE } as SpaceEntity);
		};

		it('refuses adding a hidden device to a zone', async () => {
			arrangeDevice(true);

			await expect(service.addDeviceToZone(deviceId, zoneId)).rejects.toThrow(DevicesNotAllowedException);

			expect(repository.save).not.toHaveBeenCalled();
		});

		it('adds a visible device to a zone', async () => {
			arrangeDevice(false);

			// The membership read back after the conditional insert — the statement matched, so the row is
			// there. `findOne` answers null first for the already-a-member check.
			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(null)
				.mockResolvedValue({ deviceId, zoneId } as DeviceZoneEntity);

			const created = await service.addDeviceToZone(deviceId, zoneId);

			expect(created).toEqual(expect.objectContaining({ deviceId, zoneId }));
			expect(repository.manager.query).toHaveBeenCalledWith(expect.stringContaining('COALESCE(d.hidden, 0) = 0'), [
				deviceId,
				zoneId,
				deviceId,
			]);
		});

		// The guard reads the device and several awaited lookups follow before anything is written. A hide
		// committing in that window would otherwise let this request change the placement of a device that
		// is now inert — so the insert itself carries the condition, and matching nothing is refused the
		// same way the guard refuses it.
		it('refuses when the device is hidden between the guard and the insert', async () => {
			arrangeDevice(false);

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.addDeviceToZone(deviceId, zoneId)).rejects.toThrow(DevicesNotAllowedException);
		});

		// A replacement is one thing: a hide arriving *inside* it used to leave the delete and the first
		// inserts committed while the rest turned into no-ops — a device with some of its new placement
		// and none of its old, then an exception on top. A caller told its change was refused has to find
		// nothing changed.
		it('rolls the whole zone replacement back when the device is hidden partway through', async () => {
			arrangeDevice(false);

			(repository.manager.transaction as jest.Mock).mockImplementation(
				async (run: (m: { query: jest.Mock }) => Promise<void>) => {
					// The visibility probe inside the transaction finds the device hidden.
					await run({ query: jest.fn().mockResolvedValue([]) });
				},
			);

			await expect(service.setDeviceZones(deviceId, [zoneId])).rejects.toThrow(DevicesNotAllowedException);
		});

		// A create may legitimately carry both `hidden: true` and `zone_ids` — the wizard hides the source
		// device it is replacing — and the placement lock is about *changing* where an already-hidden
		// device sits, which an initial placement is not. Refusing it rolled the whole create back, and
		// `room_id` on the same request was accepted, so the two halves of one placement disagreed.
		it('places a hidden device in its zones when the device is being created', async () => {
			arrangeDevice(true);

			await expect(service.setDeviceZones(deviceId, [zoneId], { initialPlacement: true })).resolves.toBeDefined();
		});

		// And the lock still holds for every other caller.
		it('refuses replacing the zones of an already-hidden device', async () => {
			arrangeDevice(true);

			(repository.manager.transaction as jest.Mock).mockImplementation(
				async (run: (m: { query: jest.Mock }) => Promise<void>) => {
					await run({ query: jest.fn().mockResolvedValue([]) });
				},
			);

			await expect(service.setDeviceZones(deviceId, [zoneId])).rejects.toThrow(DevicesNotAllowedException);
		});

		// A membership can disappear because this call removed it, or because the whole device was deleted
		// and took it along by cascade. From here the two look identical — and in the second case the
		// device's own deletion has already gone out, so announcing the row read before it tells every
		// client that a device they just removed exists again, with nothing scheduled to remove it twice.
		it('announces nothing when the device was deleted while its membership was being removed', async () => {
			arrangeDevice(false);

			// A member before the statement, gone after it — and the device gone too.
			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce({ deviceId, zoneId } as DeviceZoneEntity)
				.mockResolvedValue(null);
			jest
				.spyOn(deviceRepository, 'findOne')
				.mockResolvedValueOnce({ id: deviceId, hidden: false } as DeviceEntity)
				.mockResolvedValue(null);

			await service.removeDeviceFromZone(deviceId, zoneId);

			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		// The guard is a separate read from the delete, so a hide committing in the gap would otherwise have
		// this remove the placement of a device that is now inert. The row surviving the conditional
		// statement is what says the condition refused rather than the membership being absent.
		it('refuses when the device is hidden between the guard and the delete', async () => {
			arrangeDevice(false);

			// Still a member on both sides: the delete matched nothing because the device went hidden.
			jest.spyOn(repository, 'findOne').mockResolvedValue({ deviceId, zoneId } as DeviceZoneEntity);

			await expect(service.removeDeviceFromZone(deviceId, zoneId)).rejects.toThrow(DevicesNotAllowedException);
		});

		it('refuses removing a hidden device from a zone', async () => {
			arrangeDevice(true);

			await expect(service.removeDeviceFromZone(deviceId, zoneId)).rejects.toThrow(DevicesNotAllowedException);

			expect(repository.delete).not.toHaveBeenCalled();
		});

		it('removes a visible device from a zone', async () => {
			arrangeDevice(false);

			// A member before the delete and gone after it: the conditional statement matched.
			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce({ deviceId, zoneId } as DeviceZoneEntity)
				.mockResolvedValue(null);

			await service.removeDeviceFromZone(deviceId, zoneId);

			// Deleted through a conditional statement rather than `repository.delete`, so the visibility the
			// guard checked is decided by the database rather than across an await.
			expect(repository.manager.query).toHaveBeenCalledWith(expect.stringContaining('COALESCE(d.hidden, 0) = 0'), [
				deviceId,
				zoneId,
				deviceId,
			]);
			expect(repository.delete).not.toHaveBeenCalled();
		});
	});
});
