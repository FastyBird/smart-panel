import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { INTENT_CLIENT_ORIGINS, INTENT_ORIGINS } from '../../intents/intents.constants';

import { PropertyCommandContextDto } from './property-command.dto';

describe('PropertyCommandContextDto', () => {
	const errorsOf = (origin: unknown) => validate(plainToInstance(PropertyCommandContextDto, { origin }));

	it.each(INTENT_CLIENT_ORIGINS)('takes the origin a client may name: %s', async (origin) => {
		expect(await errorsOf(origin)).toEqual([]);
	});

	it('does not let a client claim that an automation sent the command', async () => {
		// The origin exists, but only the automations module may set it
		expect(INTENT_ORIGINS).toContain('automation');
		expect(INTENT_CLIENT_ORIGINS).not.toContain('automation');

		const errors = await errorsOf('automation');

		expect(errors).toHaveLength(1);
		expect(errors[0].property).toBe('origin');
	});
});
