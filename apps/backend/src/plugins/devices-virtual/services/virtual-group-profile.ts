import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import {
	LightGroupCapability,
	LightGroupReportedMember,
	LightGroupReportedState,
	commonLightCapabilities,
	reportLightGroup,
} from './virtual-light-group.utils';

/** Source access is separate from the read-only materialized output and composite command entry. */
export type GroupFieldAccess = 'ro' | 'rw' | 'wo';
export interface GroupFieldPolicy {
	category: PropertyCategory;
	access: GroupFieldAccess;
}
export interface GroupProfile {
	deviceCategory: DeviceCategory;
	channelCategory: ChannelCategory;
	fields: readonly GroupFieldPolicy[];
}
const rw = (category: PropertyCategory): GroupFieldPolicy => ({ category, access: 'rw' });
export const GROUP_PROFILES: Readonly<Record<VirtualLightGroupProfile, GroupProfile>> = {
	[VirtualLightGroupProfile.LIGHT]: {
		deviceCategory: DeviceCategory.LIGHTING,
		channelCategory: ChannelCategory.LIGHT,
		fields: [
			PropertyCategory.ON,
			PropertyCategory.BRIGHTNESS,
			PropertyCategory.COLOR_TEMPERATURE,
			PropertyCategory.COLOR_RED,
			PropertyCategory.COLOR_GREEN,
			PropertyCategory.COLOR_BLUE,
			PropertyCategory.HUE,
			PropertyCategory.SATURATION,
		].map(rw),
	},
	[VirtualLightGroupProfile.SWITCH]: {
		deviceCategory: DeviceCategory.SWITCHER,
		channelCategory: ChannelCategory.SWITCHER,
		fields: [rw(PropertyCategory.ON)],
	},
	[VirtualLightGroupProfile.OUTLET]: {
		deviceCategory: DeviceCategory.OUTLET,
		channelCategory: ChannelCategory.OUTLET,
		fields: [rw(PropertyCategory.ON), { category: PropertyCategory.IN_USE, access: 'ro' }],
	},
};
export function groupProfileForChannel(channel: ChannelCategory): VirtualLightGroupProfile | undefined {
	return (Object.keys(GROUP_PROFILES) as VirtualLightGroupProfile[]).find(
		(key) => GROUP_PROFILES[key].channelCategory === channel,
	);
}
export function groupField(
	profile: VirtualLightGroupProfile,
	category: PropertyCategory,
): GroupFieldPolicy | undefined {
	return GROUP_PROFILES[profile]?.fields.find((field) => field.category === category);
}
export function groupSourceSupports(property: ChannelPropertyEntity, field: GroupFieldPolicy | undefined): boolean {
	if (!field) return false;
	const readable =
		property.permissions.includes(PermissionType.READ_ONLY) || property.permissions.includes(PermissionType.READ_WRITE);
	const writable =
		property.permissions.includes(PermissionType.WRITE_ONLY) ||
		property.permissions.includes(PermissionType.READ_WRITE);
	return field.access === 'rw' ? readable && writable : field.access === 'ro' ? readable : writable;
}
export function commonGroupCapabilities(
	profile: VirtualLightGroupProfile,
	members: readonly (readonly ChannelPropertyEntity[])[],
): LightGroupCapability[] {
	if (profile === VirtualLightGroupProfile.LIGHT) return commonLightCapabilities(members);
	if (!members.length || !Object.hasOwn(GROUP_PROFILES, profile)) return [];
	const result: LightGroupCapability[] = [];
	for (const field of GROUP_PROFILES[profile].fields) {
		const sources = members.map((member) => member.filter((property) => property.category === field.category));
		if (
			sources.some(
				(properties) =>
					properties.length !== 1 ||
					properties[0].dataType !== DataTypeType.BOOL ||
					!groupSourceSupports(properties[0], field),
			)
		)
			continue;
		const properties = sources.map(([property]) => property);
		const first = properties[0];
		if (properties.some((property) => resolvePropertyUnit(property) !== resolvePropertyUnit(first))) continue;
		const bounded = properties.filter((property) => property.format?.length);
		if (bounded.some((property) => !property.format.every((value) => typeof value === 'string'))) continue;
		const format = bounded.length
			? (bounded[0].format as string[]).filter((value) =>
					bounded.every((property) => (property.format as string[]).includes(value)),
				)
			: null;
		if (format && !format.length) continue;
		result.push({
			category: field.category,
			dataType: DataTypeType.BOOL,
			unit: resolvePropertyUnit(first) ?? null,
			format,
			step: null,
		});
	}
	return result;
}
export function reportGroup(
	profile: VirtualLightGroupProfile,
	members: readonly LightGroupReportedMember[],
): LightGroupReportedState {
	const state = reportLightGroup(members);
	if (profile === VirtualLightGroupProfile.LIGHT) return state;
	state.properties = new Map([...state.properties].filter(([category]) => !!groupField(profile, category)));
	if (profile === VirtualLightGroupProfile.OUTLET) {
		const contributors = members.filter(
			(member) => typeof member.samples.get(PropertyCategory.IN_USE)?.value === 'boolean',
		);
		const samples = contributors.map((member) => member.samples.get(PropertyCategory.IN_USE));
		const values = samples.map((sample) => sample.value);
		const mixed = new Set(values).size > 1;
		state.properties.set(PropertyCategory.IN_USE, {
			value: !mixed && samples.length === members.length && samples.length > 0 ? (values[0] as boolean) : null,
			mixed,
			samples,
			contributors: contributors.map((member) => member.identity),
		});
	}
	return state;
}
