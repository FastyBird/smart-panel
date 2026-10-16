import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ActivityDomain, ActivityDomainStatus } from '../activity/space-activity.constants';

@ApiSchema({ name: 'SpacesHomeControlPluginDataActivityDomainResult' })
export class ActivityDomainResultModel {
	@ApiProperty({ description: 'Domain', enum: ActivityDomain }) @Expose() domain: ActivityDomain;
	@ApiProperty({ description: 'Domain result; ready is preview-only', enum: ActivityDomainStatus })
	@Expose()
	status: ActivityDomainStatus;
	@ApiProperty({ description: 'Bounded result diagnostic', type: 'string' }) @Expose() reason: string;
}
