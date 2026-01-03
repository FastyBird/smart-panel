import { validate as uuidValidate } from 'uuid';

import { Injectable } from '@nestjs/common';

import { TileEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import { ITileRelationsLoader } from '../../../modules/dashboard/entities/dashboard.relations';
import { ScenesService } from '../../../modules/scenes/services/scenes.service';
import { SceneTileEntity } from '../entities/tiles-scene.entity';

@Injectable()
export class TileRelationsLoaderService implements ITileRelationsLoader {
	constructor(private readonly scenesService: ScenesService) {}

	async loadRelations(tile: SceneTileEntity): Promise<void> {
		if (typeof tile.sceneId === 'string' && uuidValidate(tile.sceneId)) {
			tile.scene = await this.scenesService.findOne(tile.sceneId);
		}
	}

	supports(entity: TileEntity): boolean {
		return entity instanceof SceneTileEntity;
	}
}
