import { DataSource, QueryFailedError } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { WledDeviceEntity } from '../entities/devices-wled.entity';

const isMacUniqueViolation = (error: unknown): boolean => {
	if (!(error instanceof QueryFailedError)) {
		return false;
	}
	const driverMessage = (error.driverError as { message?: string } | undefined)?.message ?? '';
	const message = `${error.message} ${driverMessage}`;

	return message.includes('UNIQUE constraint failed') && message.includes('devices_module_devices.mac');
};

@Injectable()
export class WledHardwareIdentityService {
	constructor(private readonly dataSource: DataSource) {}

	async persist(device: WledDeviceEntity, reportedMac: string): Promise<'persisted' | 'unchanged' | 'conflict'> {
		const mac = this.normalize(reportedMac);
		if (!mac || device.mac === mac) {
			return 'unchanged';
		}
		if (device.mac !== null) {
			return 'conflict';
		}

		const repository = this.dataSource.getRepository(WledDeviceEntity);
		const existingOwner = await repository.findOne({ where: { mac } });
		if (existingOwner && existingOwner.id !== device.id) {
			return 'conflict';
		}

		try {
			await repository.update(device.id, { mac });
		} catch (error) {
			// Another device claimed this identity between the lookup and the write.
			if (isMacUniqueViolation(error)) {
				return 'conflict';
			}

			throw error;
		}
		device.mac = mac;
		return 'persisted';
	}

	async restore(deviceId: string, mac: string | null): Promise<void> {
		await this.dataSource.getRepository(WledDeviceEntity).update(deviceId, { mac });
	}

	private normalize(mac: string): string | null {
		const normalized = mac.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
		return normalized.length === 12 ? normalized : null;
	}
}
