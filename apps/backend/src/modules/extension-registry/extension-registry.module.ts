import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { ExtensionsBundledService } from '../extensions/services/extensions-bundled.service';
import { ExtensionsService } from '../extensions/services/extensions.service';

@Global()
@Module({
	imports: [NestConfigModule],
	providers: [ExtensionsBundledService, ExtensionsService],
	exports: [ExtensionsBundledService, ExtensionsService],
})
export class ExtensionRegistryModule {}
