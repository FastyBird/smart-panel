import { EntityManager } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { VirtualLightGroupBindingEntity, VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import { GROUP_PROFILES, requiredGroupFields } from './virtual-group-profile';
import { commonTypedGroupCapabilities, typedGroupSourceMatchesOutput } from './virtual-typed-group.utils';

/** Full declared member contract, not only the field currently being written/read. */
export function coverContractReasons(
	properties: readonly ChannelPropertyEntity[],
	outputs: readonly ChannelPropertyEntity[] = [],
): string[] {
	const profile = VirtualLightGroupProfile.COVER;
	const common = commonTypedGroupCapabilities(profile, GROUP_PROFILES[profile].fields, [properties]);
	const reasons = requiredGroupFields(profile)
		.filter((category) => !common.some((field) => field.category === category))
		.map((category) => `cover_contract_${category}_incompatible`);
	for (const output of outputs) {
		const field = GROUP_PROFILES[profile].fields.find((field) => field.category === output.category);
		const sources = properties.filter((property) => property.category === output.category);
		if (!field || sources.length !== 1 || !typedGroupSourceMatchesOutput(profile, field, sources[0], output))
			reasons.push(`cover_contract_${output.category}_incompatible`);
	}
	return [...new Set(reasons)];
}

export async function loadCoverMemberContract(
	manager: EntityManager,
	memberId: string,
	sourceChannelId: string | null,
	outputs: readonly ChannelPropertyEntity[],
): Promise<{ properties: ChannelPropertyEntity[]; reasons: string[] }> {
	if (!sourceChannelId) return { properties: [], reasons: ['missing_channel'] };
	const bindings = await manager.find(VirtualLightGroupBindingEntity, {
		where: { memberId },
		relations: ['sourceProperty', 'sourceProperty.channel'],
	});
	const properties = bindings.map((binding) => binding.sourceProperty).filter((property) => !!property);
	const wrongBinding = outputs.some(
		(output) =>
			!bindings.some(
				(binding) =>
					binding.outputPropertyId === output.id &&
					binding.sourceProperty?.category === output.category &&
					(binding.sourceProperty.channel as { id: string })?.id === sourceChannelId,
			),
	);
	return {
		properties,
		reasons: [
			...(wrongBinding ? ['cover_contract_binding_missing_or_remapped'] : []),
			...coverContractReasons(properties, outputs),
		],
	};
}
