import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

import { GroupFieldPolicy, groupBooleanContractIsSupported, groupSourceSupports } from './virtual-group-field.utils';
import {
	LightGroupCapability,
	LightGroupReportedMember,
	LightGroupReportedState,
	commonLightCapabilities,
	reportLightGroup,
} from './virtual-light-group.utils';
import { commonTypedGroupCapabilities } from './virtual-typed-group.utils';

export type { GroupFieldAccess, GroupFieldPolicy } from './virtual-group-field.utils';
export { groupBooleanContractIsSupported, groupSourceSupports } from './virtual-group-field.utils';

export interface GroupProfile {
	deviceCategory: DeviceCategory;
	channelCategory: ChannelCategory;
	fields: readonly GroupFieldPolicy[];
	required?: readonly PropertyCategory[];
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
	[VirtualLightGroupProfile.FAN]: {
		deviceCategory: DeviceCategory.FAN,
		channelCategory: ChannelCategory.FAN,
		fields: [
			PropertyCategory.ON,
			PropertyCategory.SPEED,
			PropertyCategory.SWING,
			PropertyCategory.DIRECTION,
			PropertyCategory.MODE,
		].map(rw),
	},
	[VirtualLightGroupProfile.COVER]: {
		deviceCategory: DeviceCategory.WINDOW_COVERING,
		channelCategory: ChannelCategory.WINDOW_COVERING,
		required: [PropertyCategory.TYPE, PropertyCategory.STATUS, PropertyCategory.POSITION, PropertyCategory.COMMAND],
		fields: [
			{ category: PropertyCategory.TYPE, access: 'ro' },
			{ category: PropertyCategory.STATUS, access: 'ro' },
			rw(PropertyCategory.POSITION),
			{ category: PropertyCategory.COMMAND, access: 'wo' },
			rw(PropertyCategory.TILT),
			{ category: PropertyCategory.OBSTRUCTION, access: 'ro' },
		],
	},
};
export const requiredGroupFields = (profile: VirtualLightGroupProfile): readonly PropertyCategory[] =>
	GROUP_PROFILES[profile].required ?? [PropertyCategory.ON];
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
export function commonGroupCapabilities(
	profile: VirtualLightGroupProfile,
	members: readonly (readonly ChannelPropertyEntity[])[],
): LightGroupCapability[] {
	if (profile === VirtualLightGroupProfile.LIGHT) return commonLightCapabilities(members);
	if ([VirtualLightGroupProfile.FAN, VirtualLightGroupProfile.COVER].includes(profile))
		return commonTypedGroupCapabilities(profile, GROUP_PROFILES[profile].fields, members);
	if (!members.length || !Object.hasOwn(GROUP_PROFILES, profile)) return [];
	const result: LightGroupCapability[] = [];
	for (const field of GROUP_PROFILES[profile].fields) {
		const sources = members.map((member) => member.filter((property) => property.category === field.category));
		if (
			sources.some(
				(properties) =>
					properties.length !== 1 ||
					!groupBooleanContractIsSupported(profile, properties[0]) ||
					!groupSourceSupports(properties[0], field),
			)
		)
			continue;
		const properties = sources.map(([property]) => property);
		const first = properties[0];
		if (properties.some((property) => resolvePropertyUnit(property) !== resolvePropertyUnit(first))) continue;

		result.push({
			category: field.category,
			dataType: DataTypeType.BOOL,
			unit: resolvePropertyUnit(first) ?? null,
			format: null,
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
	if ([VirtualLightGroupProfile.FAN, VirtualLightGroupProfile.COVER].includes(profile)) {
		for (const field of GROUP_PROFILES[profile].fields.filter((field) => field.category !== PropertyCategory.ON)) {
			const contributors = members.filter((member) => member.samples.has(field.category));
			const samples = contributors.map((member) => member.samples.get(field.category));
			const values = samples.map((sample) => sample.value);
			const mixed = new Set(values).size > 1;
			state.properties.set(field.category, {
				value:
					field.access !== 'wo' && !mixed && samples.length === members.length && samples.length > 0 ? values[0] : null,
				mixed,
				samples,
				contributors: contributors.map((member) => member.identity),
			});
		}
	}
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
