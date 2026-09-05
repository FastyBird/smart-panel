import { validateSync } from 'class-validator';

import { HOMEKIT_FORBIDDEN_PINS } from '../devices-homekit.constants';

import { IsNotForbiddenHomeKitPin } from './is-not-forbidden-homekit-pin.validator';

class TestModel {
	@IsNotForbiddenHomeKitPin()
	pincode?: unknown;
}

describe('IsNotForbiddenHomeKitPin', () => {
	it.each(Array.from(HOMEKIT_FORBIDDEN_PINS))('rejects forbidden pin %s', (forbiddenPin) => {
		const model = new TestModel();
		model.pincode = forbiddenPin;

		const errors = validateSync(model);
		expect(errors.length).toBe(1);
		expect(errors[0].constraints?.isNotForbiddenHomeKitPin).toBe(
			'[{"field":"pincode","reason":"PIN code is not allowed by Apple HomeKit."}]',
		);
	});

	it('accepts a valid non-forbidden pin', () => {
		const model = new TestModel();
		model.pincode = '031-45-154';

		const errors = validateSync(model);
		expect(errors.length).toBe(0);
	});

	it('passes for undefined, null, or empty string', () => {
		const modelUndefined = new TestModel();
		modelUndefined.pincode = undefined;
		expect(validateSync(modelUndefined).length).toBe(0);

		const modelNull = new TestModel();
		modelNull.pincode = null;
		expect(validateSync(modelNull).length).toBe(0);

		const modelEmpty = new TestModel();
		modelEmpty.pincode = '';
		expect(validateSync(modelEmpty).length).toBe(0);
	});

	it('rejects non-string values', () => {
		const model = new TestModel();
		model.pincode = 12345;

		const errors = validateSync(model);
		expect(errors.length).toBe(1);
	});
});
