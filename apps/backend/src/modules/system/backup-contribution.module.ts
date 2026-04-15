import { Global, Module } from '@nestjs/common';

import { BackupContributionRegistry } from './services/backup-contribution-registry.service';

@Global()
@Module({
	providers: [BackupContributionRegistry],
	exports: [BackupContributionRegistry],
})
export class BackupContributionModule {}
