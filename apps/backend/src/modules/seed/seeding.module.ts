import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { SeedCommand } from './commands/seeding.command';
import { SeedRegistryService } from './services/seed-registry.service';
import { SeedService, SeedTools } from './services/seed.service';

@Module({
	imports: [NestConfigModule],
	providers: [SeedService, SeedRegistryService, SeedTools, SeedCommand],
	exports: [SeedService, SeedRegistryService, SeedTools],
})
export class SeedModule {}
