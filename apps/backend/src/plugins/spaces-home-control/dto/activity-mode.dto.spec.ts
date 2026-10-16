import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ActivityMode } from '../activity/space-activity.constants';
import { defaultActivityConfiguration } from '../activity/space-activity.defaults';

import { ReqActivityRevisionDto, ReqDeactivateActivityDto, ReqUpdateActivityModeDto } from './activity-mode.dto';

describe('activity input boundary', () => {
	const options = { whitelist: true, forbidNonWhitelisted: true };
	it('accepts nested snake_case configuration and rejects owner/source bypasses', async () => {
		const payload = {
			data: {
				expected_revision: 1,
				enabled: true,
				display_order: 0,
				configuration: defaultActivityConfiguration(ActivityMode.WORK),
			},
		};
		expect(await validate(plainToInstance(ReqUpdateActivityModeDto, payload), options)).toHaveLength(0);
		Object.assign(payload.data, { owner_id: 'forged', source: 'automation' });
		expect((await validate(plainToInstance(ReqUpdateActivityModeDto, payload), options)).length).toBeGreaterThan(0);
	});
	it('requires nested data, revision integer and activation UUID', async () => {
		expect((await validate(plainToInstance(ReqActivityRevisionDto, {}), options)).length).toBeGreaterThan(0);
		expect(
			(await validate(plainToInstance(ReqActivityRevisionDto, { data: { expected_revision: 0 } }), options)).length,
		).toBeGreaterThan(0);
		expect(
			(await validate(plainToInstance(ReqDeactivateActivityDto, { data: { activation_id: 'forged' } }), options))
				.length,
		).toBeGreaterThan(0);
	});
});
