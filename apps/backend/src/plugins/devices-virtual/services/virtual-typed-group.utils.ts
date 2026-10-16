import { DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { validatePropertyCommandValue } from '../../../modules/devices/utils/property-command-value.utils';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import { GroupFieldPolicy, groupBooleanContractIsSupported, groupSourceSupports } from './virtual-group-field.utils';
import { LightGroupCapability, intersectNumericGrid } from './virtual-light-group.utils';

/** Typed native contracts only: schema variants define quantities/units, never inferred conversions. */
export function commonTypedGroupCapabilities(
	profile: VirtualLightGroupProfile,
	fields: readonly GroupFieldPolicy[],
	members: readonly (readonly ChannelPropertyEntity[])[],
): LightGroupCapability[] {
	if (!members.length) return [];
	const result: LightGroupCapability[] = [];
	for (const field of fields) {
		const candidates = members.map((member) => member.filter((property) => property.category === field.category));
		if (candidates.some((properties) => properties.length !== 1)) continue;
		const properties = candidates.map(([property]) => property);
		const first = properties[0];
		if (
			properties.some(
				(property) =>
					!groupSourceSupports(property, field) ||
					property.dataType !== first.dataType ||
					resolvePropertyUnit(property) !== resolvePropertyUnit(first) ||
					!groupBooleanContractIsSupported(profile, property) ||
					property.invalid != null,
			)
		)
			continue;
		const metadata =
			first.channel && typeof first.channel !== 'string'
				? getPropertyMetadata(first.channel.category, field.category)
				: null;
		if (!metadata) continue;
		const variants = metadata.hasMultipleDataTypes ? metadata.dataTypeVariants : [metadata];
		const variant = variants?.find((variant) => variant.data_type === first.dataType);
		if (!variant || (variant.unit ?? null) !== resolvePropertyUnit(first)) continue;
		let format: string[] | number[] | null = null;
		let step: number | null = null;
		if (first.dataType === DataTypeType.BOOL) {
			// Core boolean validation does not enforce partial enum domains.
			if (properties.some((property) => !groupBooleanContractIsSupported(profile, property))) continue;
		} else if (first.dataType === DataTypeType.ENUM) {
			if (
				properties.some(
					(property) =>
						!Array.isArray(property.format) ||
						!property.format.length ||
						property.format.some(
							(value) => typeof value !== 'string' || !(variant.format as string[])?.includes(value),
						) ||
						new Set<string | number>(property.format).size !== property.format.length ||
						property.step != null,
				)
			)
				continue;
			format = (first.format as string[]).filter((value) =>
				properties.every((property) => property.format.includes(value as never)),
			);
			if (!format.length) continue;
			// A list of possible types is not evidence of the installed covering type.
			if (
				field.category === PropertyCategory.TYPE &&
				(format.length !== 1 || properties.some((property) => property.format.length !== 1))
			)
				continue;
			if (
				field.category === PropertyCategory.COMMAND &&
				properties.some(
					(property) =>
						property.format.length !== format.length ||
						property.format.some((value) => !format.includes(value as never)),
				)
			)
				continue;
		} else {
			// Require explicit bounded native ranges. Never widen an unspecified position/speed domain.
			if (
				properties.some(
					(property) =>
						!Array.isArray(property.format) ||
						property.format.length !== 2 ||
						property.format.some((value) => typeof value !== 'number' || !Number.isFinite(value)) ||
						!validatePropertyCommandValue(property, property.format[0]).valid ||
						!validatePropertyCommandValue(property, property.format[1]).valid ||
						(variant.format &&
							(Number(property.format[0]) < Number(variant.format[0]) ||
								Number(property.format[1]) > Number(variant.format[1]))),
				)
			)
				continue;
			const grid = intersectNumericGrid(properties);
			if (!grid) continue;
			format = grid.format;
			step = grid.step;
		}
		result.push({ category: field.category, dataType: first.dataType, unit: resolvePropertyUnit(first), format, step });
	}
	return result;
}

/** Revalidate live native metadata at runtime; metadata edits cannot widen the exposed output. */
export function typedGroupSourceMatchesOutput(
	profile: VirtualLightGroupProfile,
	field: GroupFieldPolicy,
	source: ChannelPropertyEntity,
	output: ChannelPropertyEntity,
): boolean {
	if (![VirtualLightGroupProfile.FAN, VirtualLightGroupProfile.COVER].includes(profile)) return true;
	const common = commonTypedGroupCapabilities(profile, [field], [[source]])[0];
	if (!common || common.dataType !== output.dataType || common.unit !== resolvePropertyUnit(output)) return false;
	if (common.dataType === DataTypeType.BOOL) return groupBooleanContractIsSupported(profile, output);
	if (common.dataType === DataTypeType.ENUM)
		return (
			Array.isArray(output.format) &&
			output.format.length > 0 &&
			output.format.every((value) => (common.format as string[]).includes(value as string))
		);
	if (!Array.isArray(output.format) || output.format.length !== 2) return false;
	// Endpoints alone do not establish a decimal grid; require every output step to fit the source grid.
	const intersection = intersectNumericGrid([source, output]);
	return (
		!!intersection &&
		JSON.stringify(intersection.format) === JSON.stringify(output.format) &&
		(intersection.step ?? null) === (output.step ?? null)
	);
}
