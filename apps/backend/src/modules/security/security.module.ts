import { Module, OnModuleInit } from '@nestjs/common';

import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';

import { SecurityController } from './controllers/security.controller';
import {
	SECURITY_MODULE_API_TAG_DESCRIPTION,
	SECURITY_MODULE_API_TAG_NAME,
	SECURITY_MODULE_NAME,
} from './security.constants';
import { SECURITY_SWAGGER_EXTRA_MODELS } from './security.openapi';
import { SecurityService } from './services/security.service';

@ApiTag({
	tagName: SECURITY_MODULE_NAME,
	displayName: SECURITY_MODULE_API_TAG_NAME,
	description: SECURITY_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [SwaggerModule],
	controllers: [SecurityController],
	providers: [SecurityService],
	exports: [SecurityService],
})
export class SecurityModule implements OnModuleInit {
	constructor(private readonly swaggerRegistry: SwaggerModelsRegistryService) {}

	onModuleInit() {
		for (const model of SECURITY_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
