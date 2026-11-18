import { describe, expect, it } from 'vitest';

import { type TransformDraft, transformDraftChecks } from './transform-draft-validation';

const draft = (patch: Partial<TransformDraft> = {}): TransformDraft => ({
	operator: 'affine',
	maximumAgeSeconds: 60,
	inputMinimum: 0,
	inputMaximum: 10,
	outputMinimum: 0,
	outputMaximum: 100,
	scale: 10,
	offset: 0,
	points: [],
	parameters: {},
	...patch,
});
const failures = (value: TransformDraft) => transformDraftChecks(value).filter((check) => !check.valid);

describe('conversion draft review', () => {
	it('accepts a zero offset and treats an omitted test sample as optional', () => {
		expect(failures(draft())).toEqual([]);
		expect(transformDraftChecks(draft()).find((check) => check.id === 'sample')).toMatchObject({
			valid: true,
			info: true,
			message: 'sampleOptional',
		});
	});
	it('identifies incomplete fields instead of returning one generic numeric error', () => {
		expect(failures(draft({ inputMinimum: undefined, scale: undefined })).map((check) => check.id)).toEqual(['inputRange', 'scale']);
	});
	it.each([
		[{ inputMinimum: 11 }, 'inputRange', 'rangeOrder'],
		[{ previewInput: NaN }, 'sample', 'sampleBounds'],
		[{ maximumAgeSeconds: 0 }, 'age', 'ageBounds'],
	] as const)('rejects invalid range, sample or age %j', (patch, id, message) => {
		expect(failures(draft(patch))).toContainEqual(expect.objectContaining({ id, message }));
	});
	it('keeps an out-of-range finite test sample informational rather than rejecting the policy', () => {
		expect(failures(draft({ previewInput: 11 }))).toEqual([]);
		expect(transformDraftChecks(draft({ previewInput: 11 })).find((check) => check.id === 'sample')).toMatchObject({
			valid: true,
			info: true,
			message: 'sampleBounds',
		});
	});

	it.each([
		[[], 'pointCount'],
		[
			[
				{ x: 0, y: 0 },
				{ x: 0, y: 10 },
			],
			'pointOrder',
		],
		[
			[
				{ x: 1, y: 0 },
				{ x: 10, y: 100 },
			],
			'pointCoverage',
		],
	] as const)('explains invalid calibration pairs %j', (points, message) => {
		expect(failures(draft({ operator: 'piecewise_linear', points: points.map((point) => ({ ...point })) }))).toContainEqual(
			expect.objectContaining({ id: 'points', message })
		);
	});
	it('accepts calibration covering the full input range', () => {
		expect(
			failures(
				draft({
					operator: 'piecewise_linear',
					points: [
						{ x: 0, y: 0 },
						{ x: 10, y: 100 },
					],
				})
			)
		).toEqual([]);
	});
	it('requires explicit physical thermistor parameters and refuses rail voltage in the test sample', () => {
		const ntc = draft({
			operator: 'ntc_beta',
			referenceVoltage: 3.3,
			seriesResistance: 10000,
			nominalResistance: 10000,
			nominalTemperatureCelsius: 25,
			beta: 3950,
			thermistorLeg: 'low',
			previewInput: 3.3,
		});
		expect(failures(ntc).map((check) => check.id)).toEqual(['sample']);
		expect(failures({ ...ntc, previewInput: 1.5 })).toEqual([]);
		expect(failures({ ...ntc, seriesResistance: 0 })).toContainEqual(expect.objectContaining({ id: 'seriesResistance', message: 'positiveNumber' }));
	});
});
