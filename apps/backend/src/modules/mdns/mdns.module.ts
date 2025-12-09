import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { UpdateMdnsConfigDto } from './dto/update-config.dto';
import { MDNS_MODULE_NAME } from './mdns.constants';
import { MDNS_MODULE_SWAGGER_EXTRA_MODELS } from './mdns.openapi';
import { MdnsConfigModel } from './models/config.model';
import { MdnsService } from './services/mdns.service';

@ApiTag({
	tagName: MDNS_MODULE_NAME,
	displayName: 'mDNS module',
	description: 'Endpoints related to mDNS service advertisement configuration.',
})
@Module({
	imports: [NestConfigModule, ConfigModule, SwaggerModule],
	providers: [MdnsService],
	exports: [MdnsService],
})
export class MdnsModule implements OnModuleInit {
	constructor(
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
	) {}

	onModuleInit() {
		this.modulesMapperService.registerMapping<MdnsConfigModel, UpdateMdnsConfigDto>({
			type: MDNS_MODULE_NAME,
			class: MdnsConfigModel,
			configDto: UpdateMdnsConfigDto,
		});

		for (const model of MDNS_MODULE_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
