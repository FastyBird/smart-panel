import { VirtualTransformConfigurationModel, VirtualTransformPreviewModel } from '../models/transform-response.model';

import { evaluateVirtualNumericTransform } from './virtual-numeric-transform.utils';

export function attachTransformPreview(
	model: VirtualTransformConfigurationModel,
	input?: number,
): VirtualTransformConfigurationModel {
	if (input === undefined) return model;
	const computed = evaluateVirtualNumericTransform(model.policy, input);
	model.preview_result = Object.assign(new VirtualTransformPreviewModel(), {
		input,
		value: computed.value,
		error: computed.reason,
		qualified: false as const,
	});
	return model;
}
