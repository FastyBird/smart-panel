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

const gcd = (left: number, right: number): number => {
	while (right) [left, right] = [right, left % right];
	return Math.abs(left);
};
const inverse = (value: number, modulus: number): number => {
	let [oldR, r, oldT, t] = [value, modulus, 1, 0];
	while (r) {
		const quotient = Math.floor(oldR / r);
		[oldR, r] = [r, oldR - quotient * r];
		[oldT, t] = [t, oldT - quotient * t];
	}
	return ((oldT % modulus) + modulus) % modulus;
};
/** Exact common decimal step grids, up to six decimals; never round incompatible source metadata. */
export function intersectNumericGrid(
	properties: ChannelPropertyEntity[],
): { format: number[] | null; step: number | null } | null {
	const bounded = properties.filter((property) => property.format !== null && property.format !== undefined);
	if (
		bounded.some(
			(property) =>
				property.format.length !== 2 ||
				!property.format.every((value) => typeof value === 'number' && Number.isFinite(value)),
		)
	)
		return null;
	const lower = bounded.length ? Math.max(...bounded.map((property) => Number(property.format[0]))) : -Infinity;
	const upper = bounded.length ? Math.min(...bounded.map((property) => Number(property.format[1]))) : Infinity;
	if (lower > upper) return null;
	const grids = properties.filter((property) => property.step !== null && property.step !== undefined);
	if (!grids.length) return { format: bounded.length ? [lower, upper] : null, step: null };
	const scale = 1_000_000;
	let residue = 0;
	let period = 1;
	for (const [index, property] of grids.entries()) {
		const step = property.step * scale;
		const origin = Number(property.format?.[0] ?? 0) * scale;
		if (!Number.isSafeInteger(step) || step <= 0 || !Number.isSafeInteger(origin)) return null;
		if (index === 0) {
			residue = ((origin % step) + step) % step;
			period = step;
			continue;
		}
		const divisor = gcd(period, step);
		const difference = origin - residue;
		if (difference % divisor !== 0) return null;
		const commonPeriod = (period / divisor) * step;
		const reduced = step / divisor;
		const offset =
			reduced === 1
				? 0
				: ((((difference / divisor) * inverse(period / divisor, reduced)) % reduced) + reduced) % reduced;
		const combined = residue + period * offset;
		if (!Number.isSafeInteger(commonPeriod) || !Number.isSafeInteger(combined)) return null;
		period = commonPeriod;
		residue = ((combined % period) + period) % period;
	}
	if (!bounded.length) return residue === 0 ? { format: null, step: period / scale } : null;
	const first = (residue + Math.ceil((lower * scale - residue) / period) * period) / scale;
	const last = (residue + Math.floor((upper * scale - residue) / period) * period) / scale;
	if (
		first > last ||
		properties.some(
			(property) => property.step && !matchesStep(first, property.step, Number(property.format?.[0] ?? 0)),
		)
	)
		return null;
	return { format: [first, last], step: period / scale };
}

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
		if (
			category !== PropertyCategory.ON &&
			![
				DataTypeType.FLOAT,
				DataTypeType.CHAR,
				DataTypeType.UCHAR,
				DataTypeType.SHORT,
				DataTypeType.USHORT,
				DataTypeType.INT,
				DataTypeType.UINT,
			].includes(first.dataType)
		)
			continue;
		let format: string[] | number[] | null = null;
		let step: number | null = null;
		if (category !== PropertyCategory.ON) {
			const grid = intersectNumericGrid(properties);
			if (!grid) continue;
			format = grid.format;
			step = grid.step;
		} else if (properties.some((property) => property.format?.length)) {
			if (!properties.every((property) => property.format?.every((value) => typeof value === 'string'))) continue;
			format = (first.format as string[]).filter((value) =>
				properties.every((property) => (property.format as string[]).includes(value)),
			);
			if (!format.length) continue;
		}
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
	reasons?: readonly string[];
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
	members: Array<{ identity: string; on: boolean | null; reasons: readonly string[] }>;
	properties: Map<
		PropertyCategory,
		{
			value: string | number | boolean | null;
			representativeValue?: string | number | boolean;
			rounded?: boolean;
			mixed: boolean;
			contributors: string[];
			samples: QualifiedPropertySample[];
		}
	>;
}

/**
 * Derives reported group state from qualified member samples, retaining unknown members and
 * native-unit differences instead of treating a command's intended value as confirmed state.
 * @param members Physical members with their available qualified samples.
 * @returns Member counts and common reported controls, including mixed and unavailable values.
 */
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
		members: members.map((member) => ({
			identity: member.identity,
			on:
				typeof member.samples.get(PropertyCategory.ON)?.value === 'boolean'
					? (member.samples.get(PropertyCategory.ON).value as boolean)
					: null,
			reasons: [...(member.reasons ?? [])],
		})),
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
		const mixed =
			values.length > 0 &&
			(category === PropertyCategory.BRIGHTNESS
				? new Set(values).size > 1
				: Math.max(...values) - Math.min(...values) > lightGroupTolerance(category));
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
	// A representation is one tuple: one mixed/missing component makes every component unknown.
	for (const tuple of [
		[PropertyCategory.COLOR_RED, PropertyCategory.COLOR_GREEN, PropertyCategory.COLOR_BLUE],
		[PropertyCategory.HUE, PropertyCategory.SATURATION],
	]) {
		if (tuple.some((category) => state.properties.get(category)?.value === null)) {
			const mixed = tuple.some((category) => state.properties.get(category)?.mixed);
			for (const category of tuple) {
				const reported = state.properties.get(category);
				reported.value = null;
				reported.mixed = mixed;
			}
		}
	}
	return state;
}
