import { validate as uuidValidate } from 'uuid';

import { Injectable } from '@nestjs/common';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { ITileRelationsLoader } from '../../../modules/dashboard/entities/dashboard.relations';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DevicePreviewTileEntity } from '../entities/tiles-device-preview.entity';

@Injectable()
export class TileRelationsLoaderService implements ITileRelationsLoader {
	constructor(private readonly devicesService: DevicesService) {}

	async loadRelations(tile: DevicePreviewTileEntity): Promise<void> {
		if (typeof tile.deviceId === 'string' && uuidValidate(tile.deviceId)) {
			tile.device = await this.devicesService.findOne(tile.deviceId);
		}
	}

	supports(entity: TileEntity): boolean {
		return entity instanceof DevicePreviewTileEntity;
	}
}
