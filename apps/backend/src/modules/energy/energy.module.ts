import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../common/logger/extension-logger.service';
import { ChannelEntity } from '../devices/entities/devices.entity';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { EnergySpacesController } from './controllers/energy-spaces.controller';
import { EnergyController } from './controllers/energy.controller';
import { ENERGY_MODULE_API_TAG_DESCRIPTION, ENERGY_MODULE_API_TAG_NAME, ENERGY_MODULE_NAME } from './energy.constants';
import { ENERGY_SWAGGER_EXTRA_MODELS } from './energy.openapi';
import { EnergyDeltaEntity } from './entities/energy-delta.entity';
import { EnergyIngestionListener } from './listeners/energy-ingestion.listener';
import { DeltaComputationService } from './services/delta-computation.service';
import { EnergyDataService } from './services/energy-data.service';

@ApiTag({
	tagName: ENERGY_MODULE_NAME,
	displayName: ENERGY_MODULE_API_TAG_NAME,
	description: ENERGY_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [TypeOrmModule.forFeature([EnergyDeltaEntity, ChannelEntity]), SwaggerModule],
	providers: [DeltaComputationService, EnergyDataService, EnergyIngestionListener],
	controllers: [EnergyController, EnergySpacesController],
	exports: [EnergyDataService],
})
export class EnergyModule implements OnModuleInit {
	private readonly logger = createExtensionLogger(ENERGY_MODULE_NAME, 'EnergyModule');

	constructor(private readonly swaggerRegistry: SwaggerModelsRegistryService) {}

	onModuleInit(): void {
		for (const model of ENERGY_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.logger.log('Energy module initialized');
	}
}
