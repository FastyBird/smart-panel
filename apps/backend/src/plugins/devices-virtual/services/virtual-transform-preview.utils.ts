import { VirtualTransformConfigurationModel, VirtualTransformPreviewModel } from '../models/transform-response.model';

import { VirtualTransformResolver } from './virtual-transform-resolver';

/** Add an unqualified numeric preview without installing a producer or claiming live source evidence. */
export function attachTransformPreview(
	model: VirtualTransformConfigurationModel,
	input?: number,
	resolver = new VirtualTransformResolver(),
): VirtualTransformConfigurationModel {
	if (input === undefined) return model;
	const computed = resolver.evaluate(model.policy, input);
	model.preview_result = Object.assign(new VirtualTransformPreviewModel(), {
		input,
		value: computed.value,
		error: computed.reason,
		qualified: false as const,
	});
	return model;
}
