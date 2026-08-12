import { validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';

import { ReqHomeAssistantWizardAdoptDto } from './wizard-adopt.dto';

describe('ReqHomeAssistantWizardAdoptDto', () => {
	it('rejects a missing adoption payload wrapper', async () => {
		const dto = toInstance(ReqHomeAssistantWizardAdoptDto, {});

		const errors = await validate(dto);

		expect(errors.some((error) => error.property === 'data')).toBe(true);
	});
});
