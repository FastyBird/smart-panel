import type { IChannel, IChannelProperty, IDevice } from '../../../modules/devices';
import { DevicesVirtualPluginThermostatActuatorRole, DevicesVirtualPluginThermostatSourceRole } from '../../../openapi';
import { DEVICES_SHELLY_NG_TYPE } from '../../devices-shelly-ng/devices-shelly-ng.constants';
import {
	RECOMMENDED_ACTUATOR_LEASE_SECONDS,
	RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS,
	type ThermostatCoolingSourceDraft,
	type ThermostatDraft,
	recommendedCoolingPolicy,
	recommendedFloorPolicy,
} from '../services/thermostat-authoring';

type SourceRole = ThermostatDraft['sources'][number]['role'];
export type ThermostatWizardSourceRole = SourceRole | ThermostatCoolingSourceDraft['role'];
export const thermostatWizardSources = (draft: ThermostatDraft) => [...draft.sources, ...(draft.coolingSources ?? [])];
export const isCoolingSourceRole = (role: string): role is ThermostatCoolingSourceDraft['role'] => ['dew_point', 'cooled_surface'].includes(role);
export const thermostatWizardRoleFull = (draft: ThermostatDraft, role: string) =>
	thermostatWizardSources(draft).filter((source) => source.role === role).length >= (role === 'cooled_surface' ? 8 : 1);
type ActuatorRole = ThermostatDraft['actuators'][number]['role'];
export interface ThermostatWizardCandidate {
	id: string;
	device: IDevice;
	channel: IChannel;
	property: IChannelProperty;
	roles: (ThermostatWizardSourceRole | ActuatorRole)[];
}

/** Structural authoring choices only. The existing backend still checks ownership and live contracts. */
export function thermostatWizardCandidates(
	kind: 'sources' | 'actuators',
	devices: IDevice[],
	channels: IChannel[],
	properties: IChannelProperty[]
): ThermostatWizardCandidate[] {
	const deviceById = new Map(devices.map((device) => [device.id, device]));
	const channelById = new Map(channels.map((channel) => [channel.id, channel]));
	return properties.flatMap((property): ThermostatWizardCandidate[] => {
		const channel = channelById.get(property.channel);
		const device = channel && deviceById.get(channel.device);
		if (!channel || !device) return [];
		const permissions: readonly string[] = property.permissions;
		const readable = permissions.includes('ro') || permissions.includes('rw');
		if (!readable) return [];
		if (kind === 'actuators') {
			if (
				device.type !== DEVICES_SHELLY_NG_TYPE ||
				!/^switch:\d+$/.test(channel.identifier ?? '') ||
				property.category !== 'on' ||
				property.dataType !== 'bool' ||
				!['output', 'on'].includes(property.identifier ?? '') ||
				!(permissions.includes('rw') || permissions.includes('wo'))
			)
				return [];
			return [{ id: property.id, device, channel, property, roles: Object.values(DevicesVirtualPluginThermostatActuatorRole) }];
		}
		if (device.type !== 'virtual' && channel.category === 'contact' && property.category === 'detected' && property.dataType === 'bool') {
			return [{ id: property.id, device, channel, property, roles: [DevicesVirtualPluginThermostatSourceRole.contact] }];
		}
		if (
			channel.category !== 'temperature' ||
			property.category !== 'temperature' ||
			!['float', 'int', 'short', 'uchar'].includes(property.dataType) ||
			permissions.some((permission) => permission === 'rw' || permission === 'wo') ||
			(property.unit != null && !['°C', 'C', 'Celsius', 'celsius'].includes(property.unit))
		)
			return [];
		const roles: ThermostatWizardSourceRole[] = [DevicesVirtualPluginThermostatSourceRole.ambient, DevicesVirtualPluginThermostatSourceRole.floor];
		if (device.type === DEVICES_SHELLY_NG_TYPE) roles.push('cooled_surface');
		if (device.type === 'virtual') {
			const virtual = device as IDevice & { mode?: string };
			const derived = property as IChannelProperty & { valueOrigin?: string; sourceProperty?: string | null };
			if (virtual.mode === 'dew_point' && derived.valueOrigin === 'derived' && !derived.sourceProperty && property.dataType === 'float')
				return [{ id: property.id, device, channel, property, roles: ['dew_point'] }];
			if (
				!['sensor_aggregate', 'sensor_transform'].includes(virtual.mode ?? '') ||
				derived.valueOrigin !== 'derived' ||
				derived.sourceProperty ||
				property.dataType !== 'float'
			)
				return [];
			if (virtual.mode === 'sensor_aggregate') roles.splice(1);
			else roles.push('cooled_surface');
		}
		return [{ id: property.id, device, channel, property, roles }];
	});
}

export function addThermostatWizardSource(draft: ThermostatDraft, candidate: ThermostatWizardCandidate): boolean {
	if (thermostatWizardSources(draft).some((source) => source.source_property === candidate.id)) return false;
	const role = candidate.roles.find((role) => !['heating', 'cooling'].includes(role) && !thermostatWizardRoleFull(draft, role)) as
		| ThermostatWizardSourceRole
		| undefined;
	if (!role) return false;
	if (isCoolingSourceRole(role)) {
		(draft.coolingSources ??= []).push({ role, source_property: candidate.id });
		draft.policy.cooling ??= recommendedCoolingPolicy();
	} else draft.sources.push({ role, source_property: candidate.id, maximum_age_seconds: RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS });
	syncThermostatWizardFloor(draft);
	return true;
}

/** Moving a reading between control and cooling roles never sends wizard-only roles to the API. */
export function setThermostatWizardSourceRole(
	draft: ThermostatDraft,
	candidate: ThermostatWizardCandidate,
	role: ThermostatWizardSourceRole,
	candidates: ThermostatWizardCandidate[]
): boolean {
	const source = thermostatWizardSources(draft).find((entry) => entry.source_property === candidate.id);
	if (!source || !candidate.roles.includes(role)) return false;
	if (source.role === role) return true;
	const other = role === 'cooled_surface' ? undefined : thermostatWizardSources(draft).find((entry) => entry !== source && entry.role === role);
	if (other && !candidates.find((entry) => entry.id === other.source_property)?.roles.includes(source.role)) return false;
	if (!other && thermostatWizardRoleFull(draft, role)) return false;
	const move = (entry: typeof source, target: ThermostatWizardSourceRole) => {
		if (!isCoolingSourceRole(target) && !isCoolingSourceRole(entry.role)) {
			entry.role = target;
			return;
		}
		draft.sources = draft.sources.filter((source) => source !== entry);
		draft.coolingSources = draft.coolingSources?.filter((source) => source !== entry);
		if (isCoolingSourceRole(target)) (draft.coolingSources ??= []).push({ role: target, source_property: entry.source_property! });
		else
			draft.sources.push({
				...entry,
				role: target,
				maximum_age_seconds: 'maximum_age_seconds' in entry ? entry.maximum_age_seconds : RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS,
			});
	};
	if (other) move(other, source.role);
	move(source, role);
	if (draft.coolingSources?.length) draft.policy.cooling ??= recommendedCoolingPolicy();
	syncThermostatWizardFloor(draft);
	return true;
}

export function removeThermostatWizardSource(draft: ThermostatDraft, id: string): void {
	draft.sources = draft.sources.filter((source) => source.source_property !== id);
	draft.coolingSources = draft.coolingSources?.filter((source) => source.source_property !== id);
	for (const member of draft.actuators) {
		if (!member.retained && member.cooling_protection) {
			if (member.cooling_protection.dew_point_property === id) member.cooling_protection.dew_point_property = null;
			if (member.cooling_protection.surface_property === id) member.cooling_protection.surface_property = null;
		}
	}
	syncThermostatWizardFloor(draft);
}

export function addThermostatWizardActuator(draft: ThermostatDraft, candidate: ThermostatWizardCandidate): boolean {
	if (draft.actuators.length >= 8 || draft.actuators.some((member) => member.source_property === candidate.id)) return false;
	draft.actuators.push({
		role: DevicesVirtualPluginThermostatActuatorRole.heating,
		source_property: candidate.id,
		lease_seconds: RECOMMENDED_ACTUATOR_LEASE_SECONDS,
	});
	return true;
}

/** Route missing values to the step that owns the controls, not an earlier selection step. */
export function thermostatWizardIssueStep(code: string): number {
	if (
		['ambientSource', 'sourceSelect', 'contactSourceLimit', 'sourceRole', 'sourceDistinct', 'coolingDewPointSource', 'coolingSurfaceSource'].includes(
			code
		)
	)
		return 1;
	if (['actuatorRequired', 'memberLimit', 'memberDistinct', 'actuatorRepair', 'retainedClaim'].includes(code)) return 2;
	return 3;
}

/** Creation only: the selected floor sensor owns the optional protection configuration. */
export function syncThermostatWizardFloor(draft: ThermostatDraft): void {
	const floor = draft.sources.find((source) => source.role === 'floor');
	if (floor) draft.policy.floor ??= recommendedFloorPolicy();
	else draft.policy.floor = null;
	for (const member of draft.actuators) {
		if (!member.retained && member.protection && member.protection.source_property !== floor?.source_property) delete member.protection;
	}
}

export function syncThermostatWizardBranches(draft: ThermostatDraft): void {
	if (draft.actuators.some((member) => member.role === 'heating')) draft.policy.heatingSetpoint ??= 21;
	else draft.policy.heatingSetpoint = null;
	if (draft.actuators.some((member) => member.role === 'cooling')) {
		draft.policy.coolingSetpoint ??= 25;
		if (draft.coolingSources?.length) draft.policy.cooling ??= recommendedCoolingPolicy();
	} else {
		draft.policy.coolingSetpoint = null;
		draft.policy.cooling = null;
	}
	const supported = new Set([
		'off',
		...(draft.actuators.some((member) => member.role === 'heating') ? ['heat'] : []),
		...(draft.actuators.some((member) => member.role === 'cooling') ? ['cool'] : []),
		...(new Set(draft.actuators.map((member) => member.role)).size === 2 ? ['auto'] : []),
	]);
	if (!supported.has(draft.requested_mode)) draft.requested_mode = 'off' as ThermostatDraft['requested_mode'];
}
