import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { matchesStep } from '../../../modules/devices/utils/property-command-value.utils';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';

export const LIGHT_GROUP_MAXIMUM_AGE_MS = 300_000;
/** Absolute native-unit tolerances: 1 brightness/RGB/saturation, 2 degrees hue, 25 K temperature. */
export const lightGroupTolerance = (category: PropertyCategory): number =>
	category === PropertyCategory.COLOR_TEMPERATURE ? 25 : category === PropertyCategory.HUE ? 2 : 1;

export interface LightGroupCapability {
	category: PropertyCategory;
	dataType: DataTypeType;
	unit: string | null;
	format: string[] | number[] | null;
	step: number | null;
}

const allowed = [
	PropertyCategory.ON,
	PropertyCategory.BRIGHTNESS,
	PropertyCategory.COLOR_TEMPERATURE,
	PropertyCategory.COLOR_RED,
	PropertyCategory.COLOR_GREEN,
	PropertyCategory.COLOR_BLUE,
	PropertyCategory.HUE,
	PropertyCategory.SATURATION,
];

/** Conservative intersection: unsupported/disjoint grids are explained as unavailable, never converted. */
export function commonLightCapabilities(
	members: readonly (readonly ChannelPropertyEntity[])[],
): LightGroupCapability[] {
	if (!members.length) return [];
	const result: LightGroupCapability[] = [];
	for (const category of allowed) {
		const properties = members.map((member) => member.find((property) => property.category === category));
		if (properties.some((property) => !property || !property.permissions.includes(PermissionType.READ_WRITE))) continue;
		const first = properties[0];
		if (
			properties.some(
				(property) =>
					property.dataType !== first.dataType || resolvePropertyUnit(property) !== resolvePropertyUnit(first),
			)
		)
			continue;
		if (category === PropertyCategory.ON && first.dataType !== DataTypeType.BOOL) continue;
		let format: string[] | number[] | null = null;
		let step: number | null = null;
		if (
			properties.every(
				(property) =>
					Array.isArray(property.format) &&
					property.format.length === 2 &&
					property.format.every((v) => typeof v === 'number'),
			)
		) {
			const lower = Math.max(...properties.map((property) => Number(property.format[0])));
			const upper = Math.min(...properties.map((property) => Number(property.format[1])));
			step = Math.max(...properties.map((property) => property.step ?? 0)) || null;
			if (
				lower > upper ||
				properties.some(
					(property) =>
						property.step &&
						(!step ||
							!matchesStep(step, property.step, 0) ||
							!matchesStep(lower, property.step, Number(property.format[0]))),
				)
			)
				continue;
			format = [lower, upper];
		} else if (properties.some((property) => property.format !== null && property.format !== undefined)) {
			if (!properties.every((property) => property.format?.every((v) => typeof v === 'string'))) continue;
			format = (first.format as string[]).filter((value) =>
				properties.every((property) => (property.format as string[]).includes(value)),
			);
			if (!format.length) continue;
		} else if (properties.some((property) => property.step !== first.step)) continue;
		else step = first.step;
		result.push({ category, dataType: first.dataType, unit: resolvePropertyUnit(first) ?? null, format, step });
	}
	for (const tuple of [
		[PropertyCategory.COLOR_RED, PropertyCategory.COLOR_GREEN, PropertyCategory.COLOR_BLUE],
		[PropertyCategory.HUE, PropertyCategory.SATURATION],
	]) {
		if (!tuple.every((category) => result.some((capability) => capability.category === category))) {
			for (let index = result.length - 1; index >= 0; index--)
				if (tuple.includes(result[index].category)) result.splice(index, 1);
		}
	}
	return result;
}

export interface LightGroupReportedMember {
	identity: string;
	samples: ReadonlyMap<PropertyCategory, QualifiedPropertySample>;
}
export interface LightGroupReportedState {
	on: boolean | null;
	allOn: boolean | null;
	mixed: boolean;
	total: number;
	onCount: number;
	offCount: number;
	unknownCount: number;
	properties: Map<
		PropertyCategory,
		{ value: number | boolean | null; mixed: boolean; contributors: string[]; samples: QualifiedPropertySample[] }
	>;
}

export function reportLightGroup(members: readonly LightGroupReportedMember[]): LightGroupReportedState {
	const on = members.filter((member) => member.samples.get(PropertyCategory.ON)?.value === true);
	const off = members.filter((member) => member.samples.get(PropertyCategory.ON)?.value === false);
	const unknownCount = members.length - on.length - off.length;
	const state: LightGroupReportedState = {
		on: on.length ? true : off.length === members.length && members.length > 0 ? false : null,
		allOn: off.length ? false : on.length === members.length && members.length > 0 ? true : null,
		mixed: on.length > 0 && off.length > 0,
		total: members.length,
		onCount: on.length,
		offCount: off.length,
		unknownCount,
		properties: new Map(),
	};
	state.properties.set(PropertyCategory.ON, {
		value: state.on,
		mixed: state.mixed,
		contributors: [...on, ...off].map((member) => member.identity),
		samples: [...on, ...off].map((member) => member.samples.get(PropertyCategory.ON)),
	});
	for (const category of allowed.filter((category) => category !== PropertyCategory.ON)) {
		const contributors = on.filter((member) => typeof member.samples.get(category)?.value === 'number');
		const samples = contributors.map((member) => member.samples.get(category));
		const values = samples.map((sample) => Number(sample.value));
		const mixed = values.length > 0 && Math.max(...values) - Math.min(...values) > lightGroupTolerance(category);
		// Partial color evidence is unknown. Brightness explicitly advertises its valid contributors.
		const value =
			values.length === 0
				? null
				: category === PropertyCategory.BRIGHTNESS
					? values.reduce((sum, value) => sum + value, 0) / values.length
					: mixed || contributors.length !== on.length
						? null
						: values[0];
		state.properties.set(category, {
			value,
			mixed,
			contributors: contributors.map((member) => member.identity),
			samples,
		});
	}
	return state;
}
