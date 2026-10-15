import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { matchesStep } from '../../../modules/devices/utils/property-command-value.utils';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import { LightGroupCapability } from './virtual-light-group.utils';

/** Authoring candidates and persistence share the exact durable output-contract rule. */
export function groupCapabilityChange(
	profile: VirtualLightGroupProfile,
	common: LightGroupCapability | undefined,
	output: ChannelPropertyEntity,
): 'changed' | 'removed' | null {
	if (
		[VirtualLightGroupProfile.FAN, VirtualLightGroupProfile.COVER].includes(profile) &&
		(!common ||
			common.dataType !== output.dataType ||
			common.unit !== (resolvePropertyUnit(output) ?? null) ||
			common.step !== (output.step ?? null) ||
			JSON.stringify(common.format) !== JSON.stringify(output.format ?? null))
	)
		return 'changed';
	const numericRange = common?.format?.length === 2 && common.format.every((value) => typeof value === 'number');
	if (
		!common ||
		common.dataType !== output.dataType ||
		common.unit !== (resolvePropertyUnit(output) ?? null) ||
		(common.format?.every((value) => typeof value === 'string') &&
			common.format.length > 0 &&
			(!output.format?.length ||
				output.format.some((value) => !(common.format as string[]).includes(String(value))))) ||
		(numericRange &&
			(!output.format ||
				output.format.length !== 2 ||
				Number(output.format[0]) < Number(common.format[0]) ||
				Number(output.format[1]) > Number(common.format[1]))) ||
		(common.step &&
			(!output.step ||
				!matchesStep(output.step, common.step, 0) ||
				!matchesStep(Number(output.format?.[0] ?? 0), common.step, Number(common.format?.[0] ?? 0))))
	)
		return 'removed';
	return null;
}
