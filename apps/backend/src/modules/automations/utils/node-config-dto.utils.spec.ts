import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, ValidateNested } from 'class-validator';

import { FakeStrictActionConfigDto } from '../testing/fake-node-types';

import { createConfigValidatorFromDto } from './node-config-dto.utils';

class NestedDto {
	@IsInt()
	seconds: number;
}

class OuterDto {
	@IsUUID('4')
	property_id: string;

	@IsString({ message: 'plain text message' })
	label: string;

	@ValidateNested()
	@Type(() => NestedDto)
	duration: NestedDto;
}

describe('createConfigValidatorFromDto', () => {
	it('accepts a configuration that satisfies the DTO', async () => {
		const validateConfig = createConfigValidatorFromDto(FakeStrictActionConfigDto);

		expect(await validateConfig({ level: 40 })).toEqual([]);
		expect(await validateConfig({ level: 40, scene_id: 's-1' })).toEqual([]);
	});

	it('takes the reason out of a message written in the project format', async () => {
		const validateConfig = createConfigValidatorFromDto(FakeStrictActionConfigDto);

		expect(await validateConfig({ level: 101 })).toEqual([
			{ field: 'level', reason: 'Level must be between 0 and 100.' },
		]);
	});

	it('reports every broken rule of a missing property', async () => {
		const validateConfig = createConfigValidatorFromDto(FakeStrictActionConfigDto);

		const problems = await validateConfig({});

		expect(problems).toEqual(
			expect.arrayContaining([
				{ field: 'level', reason: 'Level must be a whole number.' },
				{ field: 'level', reason: 'Level must be between 0 and 100.' },
			]),
		);
		// The minimum and the maximum share one message, which is reported once
		expect(problems).toHaveLength(2);
	});

	it('refuses properties the DTO does not declare, without repeating their value', async () => {
		const validateConfig = createConfigValidatorFromDto(FakeStrictActionConfigDto);

		expect(await validateConfig({ level: 1, password: 'secret-value' })).toEqual([
			{ field: 'password', reason: 'This property is not allowed.' },
		]);
	});

	it('does not convert values: a number written as text is not a number', async () => {
		const validateConfig = createConfigValidatorFromDto(FakeStrictActionConfigDto);

		expect(await validateConfig({ level: '40' })).toEqual(
			expect.arrayContaining([{ field: 'level', reason: 'Level must be a whole number.' }]),
		);
	});

	it('keeps plain class-validator messages and gives nested fields their path', async () => {
		const validateConfig = createConfigValidatorFromDto(OuterDto);

		const problems = await validateConfig({
			property_id: 'secret-value',
			label: 7,
			duration: { seconds: 'secret-value', unit: 's' },
		});

		expect(problems).toEqual(
			expect.arrayContaining([
				{ field: 'property_id', reason: 'property_id must be a UUID' },
				{ field: 'label', reason: 'plain text message' },
				{ field: 'duration.seconds', reason: 'seconds must be an integer number' },
				{ field: 'duration.unit', reason: 'This property is not allowed.' },
			]),
		);
		expect(problems).toHaveLength(4);
		expect(JSON.stringify(problems)).not.toContain('secret-value');
	});

	it('leaves the submitted configuration as it was', async () => {
		const config = { level: 1, extra: true };

		await createConfigValidatorFromDto(FakeStrictActionConfigDto)(config);

		expect(config).toEqual({ level: 1, extra: true });
		expect(config).not.toBeInstanceOf(FakeStrictActionConfigDto);
	});
});
