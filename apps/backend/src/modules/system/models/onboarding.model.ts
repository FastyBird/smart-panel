import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'SystemModuleOnboardingStatus' })
export class OnboardingStatusModel {
	@ApiProperty({
		name: 'has_owner',
		description: 'Whether an owner account has been created',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'has_owner' })
	hasOwner: boolean;

	@ApiProperty({
		name: 'onboarding_completed',
		description: 'Whether the onboarding wizard has been completed',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'onboarding_completed' })
	onboardingCompleted: boolean;

	@ApiProperty({
		name: 'devices_count',
		description: 'Number of configured devices',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'devices_count' })
	devicesCount: number;

	@ApiProperty({
		name: 'spaces_count',
		description: 'Number of configured spaces',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'spaces_count' })
	spacesCount: number;

	@ApiProperty({
		name: 'displays_count',
		description: 'Number of registered displays',
		type: 'integer',
		example: 0,
	})
	@Expose({ name: 'displays_count' })
	displaysCount: number;
}
