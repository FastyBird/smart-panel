import { validate as uuidValidate } from 'uuid';

import { Injectable } from '@nestjs/common';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { IPageRelationsLoader } from '../../../modules/dashboard/entities/dashboard.relations';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DeviceDetailPageEntity } from '../entities/pages-device-detail.entity';

@Injectable()
export class PageRelationsLoaderService implements IPageRelationsLoader {
	constructor(private readonly devicesService: DevicesService) {}

	async loadRelations(page: DeviceDetailPageEntity): Promise<void> {
		if (typeof page.deviceId === 'string' && uuidValidate(page.deviceId)) {
			page.device = await this.devicesService.findOne(page.deviceId);
		}
	}

	supports(entity: PageEntity): boolean {
		return entity instanceof DeviceDetailPageEntity;
	}
}
