import { Global, Module } from '@nestjs/common';

import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';

@Global()
@Module({
	providers: [FactoryResetRegistryService],
	exports: [FactoryResetRegistryService],
})
export class FactoryResetModule {}
