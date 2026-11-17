import type { NumericOperator } from './measurement-authoring.utils';

type NumberField =
	| 'inputMinimum'
	| 'inputMaximum'
	| 'outputMinimum'
	| 'outputMaximum'
	| 'scale'
	| 'offset'
	| 'referenceVoltage'
	| 'seriesResistance'
	| 'nominalResistance'
	| 'nominalTemperatureCelsius'
	| 'beta'
	| 'coefficientA'
	| 'coefficientB'
	| 'coefficientC'
	| 'previewInput';
export type TransformDraft = Partial<Record<NumberField, number>> & {
	operator: string;
	maximumAgeSeconds: number;
	points: { x: number; y: number }[];
	thermistorLeg?: string;
	parameters: Record<string, number>;
};
export interface TransformDraftCheck {
	id: string;
	label: string;
	literalLabel?: string;
	value: string;
	valid: boolean;
	message?: string;
	info?: boolean;
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const valueText = (value: unknown): string => (finite(value) ? String(value) : '—');

/** Form feedback only. The backend still validates source identity, policy and revision atomically. */
export function transformDraftChecks(draft: TransformDraft, descriptor?: NumericOperator): TransformDraftCheck[] {
	const checks: TransformDraftCheck[] = [];
	const add = (id: string, label: string, value: string, valid: boolean, message?: string) => checks.push({ id, label, value, valid, message });
	for (const side of ['input', 'output'] as const) {
		const min = draft[`${side}Minimum`],
			max = draft[`${side}Maximum`];
		const complete = finite(min) && finite(max);
		add(
			`${side}Range`,
			`conversion.${side}Range`,
			`${valueText(min)} → ${valueText(max)}`,
			complete && min <= max,
			complete ? 'rangeOrder' : 'rangeRequired'
		);
	}
	const number = (field: NumberField, positive = false, minimum?: number) => {
		const value = draft[field];
		add(
			field,
			`measurement.${field}`,
			valueText(value),
			finite(value) && (!positive || value > 0) && (minimum === undefined || value > minimum),
			positive ? 'positiveNumber' : minimum !== undefined ? 'absoluteTemperature' : 'requiredNumber'
		);
	};
	switch (draft.operator) {
		case 'affine':
			number('scale');
			number('offset');
			break;
		case 'piecewise_linear': {
			const points = draft.points;
			const count = points.length >= 2 && points.length <= 256;
			const values = points.every((point, index) => finite(point.x) && finite(point.y) && (index === 0 || point.x > points[index - 1].x));
			const covered =
				count &&
				finite(draft.inputMinimum) &&
				finite(draft.inputMaximum) &&
				draft.inputMinimum >= points[0].x &&
				draft.inputMaximum <= points[points.length - 1].x;
			add(
				'points',
				'conversion.calibration',
				points.map((point) => `${valueText(point.x)} → ${valueText(point.y)}`).join(', ') || '—',
				count && values && covered,
				!count ? 'pointCount' : !values ? 'pointOrder' : 'pointCoverage'
			);
			break;
		}
		case 'ntc_beta':
		case 'steinhart_hart':
			number('referenceVoltage', true);
			number('seriesResistance', true);
			if (draft.operator === 'ntc_beta') {
				number('nominalResistance', true);
				number('nominalTemperatureCelsius', false, -273.15);
				number('beta', true);
			} else {
				for (const field of ['coefficientA', 'coefficientB', 'coefficientC'] as const) number(field);
				add(
					'coefficients',
					'conversion.coefficients',
					[draft.coefficientA, draft.coefficientB, draft.coefficientC].map(valueText).join(', '),
					[draft.coefficientA, draft.coefficientB, draft.coefficientC].some((value) => finite(value) && value !== 0),
					'coefficientsNonzero'
				);
			}
			add('divider', 'measurement.divider', draft.thermistorLeg ?? '—', ['low', 'high'].includes(draft.thermistorLeg ?? ''), 'dividerRequired');
			break;
		case 'extension':
			add('extension', 'measurement.extensionOperator', descriptor?.operatorId ?? '—', !!descriptor, 'operatorMissing');
			if (descriptor) {
				for (const [name, schema] of Object.entries(descriptor.parameters)) {
					const value = draft.parameters[name];
					checks.push({
						id: `parameter:${name}`,
						label: '',
						literalLabel: name,
						value: valueText(value),
						valid: (!schema.required && value === undefined) || (finite(value) && value >= schema.minimum && value <= schema.maximum),
						message: 'parameterBounds',
					});
				}
				add(
					'operatorRanges',
					'conversion.operatorRanges',
					`${descriptor.inputRange.minimum} → ${descriptor.inputRange.maximum}; ${descriptor.outputRange.minimum} → ${descriptor.outputRange.maximum}`,
					finite(draft.inputMinimum) &&
						finite(draft.inputMaximum) &&
						finite(draft.outputMinimum) &&
						finite(draft.outputMaximum) &&
						draft.inputMinimum >= descriptor.inputRange.minimum &&
						draft.inputMaximum <= descriptor.inputRange.maximum &&
						draft.outputMinimum >= descriptor.outputRange.minimum &&
						draft.outputMaximum <= descriptor.outputRange.maximum,
					'operatorRanges'
				);
			}
			break;
	}
	add(
		'age',
		'measurement.maximumAge',
		String(draft.maximumAgeSeconds),
		Number.isInteger(draft.maximumAgeSeconds) && draft.maximumAgeSeconds >= 1 && draft.maximumAgeSeconds <= 86400,
		'ageBounds'
	);
	const sample = draft.previewInput;
	if (sample === undefined || sample === null)
		checks.push({ id: 'sample', label: 'measurement.sample', value: '—', valid: true, info: true, message: 'sampleOptional' });
	else {
		const valid =
			finite(sample) &&
			(!['ntc_beta', 'steinhart_hart'].includes(draft.operator) || (sample > 0 && finite(draft.referenceVoltage) && sample < draft.referenceVoltage));
		const outsideRange =
			valid && finite(draft.inputMinimum) && finite(draft.inputMaximum) && (sample < draft.inputMinimum || sample > draft.inputMaximum);
		checks.push({ id: 'sample', label: 'measurement.sample', value: valueText(sample), valid, info: outsideRange, message: 'sampleBounds' });
	}
	return checks;
}
