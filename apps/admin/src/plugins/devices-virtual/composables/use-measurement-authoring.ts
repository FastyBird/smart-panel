import { computed, reactive, ref } from 'vue';

import { useBackend } from '../../../common';
import { getErrorReason } from '../../../common/utils/api-error.utils';
import {
	DevicesVirtualPluginConfigureAggregateOperator,
	DevicesVirtualPluginNumericTransformPolicyOperator,
	DevicesVirtualPluginNumericTransformPolicyThermistorLeg,
} from '../../../openapi';
import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';
import {
	type AggregateConfiguration,
	type AggregateState,
	type MeasurementMode,
	type TransformConfiguration,
	type TransformPolicy,
	type TransformState,
	measurementDraft,
} from '../utils/measurement-authoring.utils';

type SemanticErrorOperation = { responses: { default: { content: { 'application/json': unknown } } } };
class MeasurementRequestError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
	}
}

export function useMeasurementAuthoring(mode: MeasurementMode, outputId?: string) {
	const backend = useBackend();
	const ids = { device: crypto.randomUUID(), channel: crypto.randomUUID(), output: outputId ?? crypto.randomUUID() };
	const model = reactive({
		name: '',
		temperature: true,
		quantity: 'temperature',
		unit: '°C',
		maximumAgeSeconds: 60,
		operator: DevicesVirtualPluginNumericTransformPolicyOperator.affine,
		aggregateOperator: DevicesVirtualPluginConfigureAggregateOperator.mean,
		minimumValidInputs: 1,
		inputMinimum: undefined as number | undefined,
		inputMaximum: undefined as number | undefined,
		outputMinimum: undefined as number | undefined,
		outputMaximum: undefined as number | undefined,
		scale: undefined as number | undefined,
		offset: undefined as number | undefined,
		points: [] as { x: number; y: number }[],
		referenceVoltage: undefined as number | undefined,
		seriesResistance: undefined as number | undefined,
		nominalResistance: undefined as number | undefined,
		nominalTemperatureCelsius: undefined as number | undefined,
		beta: undefined as number | undefined,
		coefficientA: undefined as number | undefined,
		coefficientB: undefined as number | undefined,
		coefficientC: undefined as number | undefined,
		thermistorLeg: undefined as DevicesVirtualPluginNumericTransformPolicyThermistorLeg | undefined,
		previewInput: undefined as number | undefined,
		inputs: [] as { id?: string; source_property: string | null; identity?: string }[],
	});
	const busy = ref(false),
		error = ref<string | null>(null),
		conflict = ref(false);
	const current = ref<AggregateState | TransformState | null>(null);
	const preview = ref<AggregateState | TransformState | null>(null);
	const expectedRevision = ref(0),
		expectedGraphRevision = ref<number>();
	const isTransform = mode === DevicesVirtualPluginDeviceMode.sensor_transform;
	const finite = (value: number | undefined): number => {
		if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('measurementFinite');
		return value;
	};
	const policy = (): TransformPolicy => {
		const result: TransformPolicy = {
			operator: model.operator,
			inputRange: { minimum: finite(model.inputMinimum), maximum: finite(model.inputMaximum) },
			outputRange: { minimum: finite(model.outputMinimum), maximum: finite(model.outputMaximum) },
		};
		if (model.operator === DevicesVirtualPluginNumericTransformPolicyOperator.affine)
			Object.assign(result, { scale: finite(model.scale), offset: finite(model.offset) });
		else if (model.operator === DevicesVirtualPluginNumericTransformPolicyOperator.piecewise_linear)
			result.points = model.points.map(({ x, y }) => ({ x: finite(x), y: finite(y) }));
		else if (model.operator === DevicesVirtualPluginNumericTransformPolicyOperator.ntc_beta) {
			if (!model.thermistorLeg) throw new Error('measurementDivider');
			Object.assign(result, {
				referenceVoltage: finite(model.referenceVoltage),
				seriesResistance: finite(model.seriesResistance),
				nominalResistance: finite(model.nominalResistance),
				nominalTemperatureCelsius: finite(model.nominalTemperatureCelsius),
				beta: finite(model.beta),
				thermistorLeg: model.thermistorLeg,
			});
		} else {
			if (!model.thermistorLeg) throw new Error('measurementDivider');
			Object.assign(result, {
				referenceVoltage: finite(model.referenceVoltage),
				seriesResistance: finite(model.seriesResistance),
				coefficientA: finite(model.coefficientA),
				coefficientB: finite(model.coefficientB),
				coefficientC: finite(model.coefficientC),
				thermistorLeg: model.thermistorLeg,
			});
		}
		return result;
	};
	const configuration = (): TransformConfiguration | AggregateConfiguration =>
		isTransform
			? {
					schema_version: 1,
					expected_revision: expectedRevision.value,
					expected_graph_revision: expectedGraphRevision.value,
					maximum_age_seconds: model.maximumAgeSeconds,
					quantity: model.temperature ? 'temperature' : model.quantity,
					unit: model.temperature ? '°C' : model.unit,
					source: { id: model.inputs[0]?.id, source_property: model.inputs[0]?.source_property ?? null },
					policy: policy(),
				}
			: {
					expected_revision: expectedRevision.value,
					expected_graph_revision: expectedGraphRevision.value,
					operator: model.aggregateOperator,
					minimum_valid_inputs: model.minimumValidInputs,
					maximum_age_seconds: model.maximumAgeSeconds,
					inputs: model.inputs.map(({ id, source_property }) => ({ id, source_property })),
				};
	const run = async <T>(operation: () => Promise<T>): Promise<T | undefined> => {
		if (busy.value) return;
		busy.value = true;
		error.value = null;
		conflict.value = false;
		try {
			return await operation();
		} catch (failure) {
			const message = failure instanceof Error ? failure.message : 'measurementFailed';
			error.value = message;
			conflict.value = message.toLowerCase().includes('revision') || (failure instanceof MeasurementRequestError && failure.status === 409);
		} finally {
			busy.value = false;
		}
	};
	const response = <T>(data: { data: T } | undefined, failure: unknown, status?: number): T => {
		if (data) return data.data;
		throw new MeasurementRequestError(getErrorReason<SemanticErrorOperation>(failure, 'measurementFailed'), status);
	};
	const load = async () =>
		run(async () => {
			preview.value = null;
			current.value = null;
			expectedRevision.value = 0;
			expectedGraphRevision.value = undefined;
			if (!outputId) return;
			let value: AggregateState | TransformState;
			if (isTransform) {
				const result = await backend.client.GET('/plugins/devices-virtual/producers/transforms/{id}', { params: { path: { id: outputId } } });
				if (result.response?.status === 404) return;
				value = response(result.data, result.error, result.response?.status);
			} else {
				const result = await backend.client.GET('/plugins/devices-virtual/producers/aggregates/{id}', { params: { path: { id: outputId } } });
				if (result.response?.status === 404) return;
				value = response(result.data, result.error, result.response?.status);
			}
			current.value = value;
			expectedRevision.value = value.revision;
			expectedGraphRevision.value = value.graph_revision;
			model.maximumAgeSeconds = value.maximum_age_seconds;
			if ('policy' in value) {
				model.temperature = value.quantity === 'temperature';
				model.quantity = value.quantity;
				model.unit = value.unit;
				model.inputs = [{ id: value.source.id, source_property: value.source.source_property, identity: value.source.source_identity }];
				model.operator = value.policy.operator;
				model.inputMinimum = value.policy.inputRange.minimum;
				model.inputMaximum = value.policy.inputRange.maximum;
				model.outputMinimum = value.policy.outputRange.minimum;
				model.outputMaximum = value.policy.outputRange.maximum;
				for (const key of [
					'scale',
					'offset',
					'referenceVoltage',
					'seriesResistance',
					'nominalResistance',
					'nominalTemperatureCelsius',
					'beta',
					'coefficientA',
					'coefficientB',
					'coefficientC',
					'thermistorLeg',
				] as const)
					Object.assign(model, { [key]: value.policy[key] });
				model.points = value.policy.points?.map((point) => ({ ...point })) ?? [];
			} else {
				model.aggregateOperator = value.operator;
				model.minimumValidInputs = value.minimum_valid_inputs;
				model.inputs = value.inputs.map((input) => ({ id: input.id, source_property: input.source_property, identity: input.source_identity }));
			}
			preview.value = null;
		});
	const draft = () => ({
		device: measurementDraft(
			mode,
			model.name,
			!isTransform || model.temperature,
			ids.output,
			ids.device,
			ids.channel,
			isTransform ? policy().outputRange : undefined
		),
		output_property: ids.output,
	});
	const previewDraft = async () =>
		run(async () => {
			let value: AggregateState | TransformState;
			if (isTransform) {
				const config = configuration() as TransformConfiguration;
				const result = outputId
					? await backend.client.POST('/plugins/devices-virtual/producers/transforms/{id}/preview', {
							params: { path: { id: outputId } },
							body: { ...config, preview_input: model.previewInput },
						})
					: await backend.client.POST('/plugins/devices-virtual/producers/transforms/draft-preview', {
							body: { ...draft(), configuration: config, preview_input: model.previewInput },
						});
				value = response(result.data, result.error, result.response?.status);
			} else {
				const config = configuration() as AggregateConfiguration;
				const result = outputId
					? await backend.client.POST('/plugins/devices-virtual/producers/aggregates/{id}/preview', {
							params: { path: { id: outputId } },
							body: config,
						})
					: await backend.client.POST('/plugins/devices-virtual/producers/aggregates/draft-preview', { body: { ...draft(), configuration: config } });
				value = response(result.data, result.error, result.response?.status);
			}
			preview.value = value;
			expectedGraphRevision.value = value.graph_revision;
		});
	const save = async () =>
		run(async () => {
			let deviceId: string | undefined;
			if (isTransform) {
				const config = configuration() as TransformConfiguration;
				if (outputId) {
					const result = await backend.client.PUT('/plugins/devices-virtual/producers/transforms/{id}', {
						params: { path: { id: outputId } },
						body: config,
					});
					current.value = response(result.data, result.error, result.response?.status);
				} else {
					const result = await backend.client.POST('/plugins/devices-virtual/producers/transforms', { body: { ...draft(), configuration: config } });
					const value = response(result.data, result.error, result.response?.status);
					current.value = value.configuration;
					deviceId = value.device.id;
				}
			} else {
				const config = configuration() as AggregateConfiguration;
				if (outputId) {
					const result = await backend.client.PUT('/plugins/devices-virtual/producers/aggregates/{id}', {
						params: { path: { id: outputId } },
						body: config,
					});
					current.value = response(result.data, result.error, result.response?.status);
				} else {
					const result = await backend.client.POST('/plugins/devices-virtual/producers/aggregates', { body: { ...draft(), configuration: config } });
					const value = response(result.data, result.error, result.response?.status);
					current.value = value.configuration;
					deviceId = value.device.id;
				}
			}
			expectedRevision.value = current.value.revision;
			expectedGraphRevision.value = current.value.graph_revision;
			preview.value = null;
			return deviceId;
		});
	const canPreview = computed(
		() =>
			(isTransform ? model.inputs.length === 1 : model.inputs.length >= 2) &&
			model.inputs.every((input) => input.source_property !== null || !!input.id)
	);
	return { model, busy, error, conflict, current, preview, isTransform, canPreview, load, previewDraft, save };
}
