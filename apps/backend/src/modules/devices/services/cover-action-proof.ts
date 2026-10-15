import { ChannelCategory, DataTypeType, PermissionType, PropertyCategory } from '../devices.constants';
import {
	CoverActionDispatchContext,
	CoverActionObservation,
	IDevicePropertyData,
	PreparedCoverAction,
} from '../platforms/device.platform';

import {
	PropertyCommandWindow,
	PropertyCommandWindowHandle,
	PropertyCommandWindowService,
} from './property-command-window.service';
import { PropertyValueService } from './property-value.service';

export const isCoverControl = (update: IDevicePropertyData): boolean =>
	update.channel.category === ChannelCategory.WINDOW_COVERING &&
	[PropertyCategory.COMMAND, PropertyCategory.POSITION, PropertyCategory.TILT].includes(update.property.category);

/** Core validates the provider's exact same-component sibling observation footprint before WO admission. */
export function validCoverAction(
	action: PreparedCoverAction | undefined,
	updates: readonly IDevicePropertyData[],
): boolean {
	if (!action || action.kind !== 'cover_action' || updates.length !== 1) return false;
	const [update] = updates;
	const sameChannel = (property: PreparedCoverAction['status']) =>
		(typeof property.channel === 'string' ? property.channel : property.channel?.id) === update.channel.id;
	return (
		isCoverControl(update) &&
		update.property.category === PropertyCategory.COMMAND &&
		update.property.dataType === DataTypeType.ENUM &&
		update.property.permissions.includes(PermissionType.WRITE_ONLY) &&
		['open', 'close', 'stop'].includes(String(update.value)) &&
		action.commandPropertyId === update.property.id &&
		action.status.id !== action.position.id &&
		action.status.id !== update.property.id &&
		action.status.category === PropertyCategory.STATUS &&
		action.status.dataType === DataTypeType.ENUM &&
		action.position.category === PropertyCategory.POSITION &&
		action.position.dataType === DataTypeType.UCHAR &&
		sameChannel(action.status) &&
		sameChannel(action.position) &&
		!!action.effects &&
		action.effects.some((property) => property.id === action.position.id) &&
		new Set(action.effects.map((property) => property.id)).size === action.effects.length &&
		action.effects.every(
			(property) =>
				sameChannel(property) && [PropertyCategory.POSITION, PropertyCategory.TILT].includes(property.category),
		) &&
		[action.status, action.position].every((property) =>
			property.permissions.some((permission) =>
				[PermissionType.READ_ONLY, PermissionType.READ_WRITE].includes(permission),
			),
		)
	);
}

/** A process-local capability tied to one admitted COMMAND generation, never a provider-supplied handle. */
export function coverActionContext(
	action: PreparedCoverAction,
	update: IDevicePropertyData,
	handle: PropertyCommandWindowHandle,
	windows: PropertyCommandWindowService,
	values: PropertyValueService,
	isAdmitted: () => boolean,
): CoverActionDispatchContext {
	let acceptedAt: number | null = null;
	const observationToken = Object.freeze({});
	const isCurrent = () =>
		isAdmitted() &&
		windows.get(handle.canonicalPropertyId)?.generation === handle.generation &&
		windows.get(handle.canonicalPropertyId)?.state === 'pending';
	return Object.freeze({
		observationToken,
		tag: handle.generation.replaceAll('-', '').slice(0, 20),
		isCurrent,
		accepted: () => {
			if (isCurrent() && acceptedAt === null) acceptedAt = Date.now();
		},
		observe: (observation: CoverActionObservation) => {
			if (
				!isCurrent() ||
				acceptedAt === null ||
				!Number.isFinite(observation.observedAt.getTime()) ||
				observation.observedAt.getTime() < acceptedAt ||
				observation.observedAt.getTime() > Date.now()
			)
				return false;
			const status = values.readQualifiedSample(action.status, 30_000);
			const position = values.readQualifiedSample(action.position, 30_000);
			const nativeStatus = observation.state === 'open' ? 'opened' : observation.state;
			if (
				!status ||
				status.semanticOrigin !== 'native_cover_status' ||
				status.commandObservation !== observationToken ||
				position?.commandObservation !== observationToken ||
				status.acceptanceGeneration <= observation.acceptanceBoundary ||
				position?.acceptanceGeneration <= observation.acceptanceBoundary ||
				status.sampledAt.getTime() !== observation.observedAt.getTime() ||
				position?.sampledAt.getTime() !== observation.observedAt.getTime() ||
				!position ||
				status.acceptanceGeneration !== observation.statusAcceptance ||
				position.acceptanceGeneration !== observation.positionAcceptance ||
				status.value !== nativeStatus ||
				position.value !== observation.position ||
				status.receivedAt.getTime() < acceptedAt ||
				position.receivedAt.getTime() < acceptedAt ||
				!Number.isFinite(observation.position) ||
				observation.position < 0 ||
				observation.position > 100
			)
				return false;
			const tagMatches = observation.tag === handle.generation.replaceAll('-', '').slice(0, 20);
			const idle = ['open', 'closed', 'stopped'].includes(observation.state);
			const noopStop = update.value === 'stop' && idle && observation.preflightState === observation.state;
			const endpoint =
				(update.value === 'open' && observation.state === 'open' && observation.position === 100) ||
				(update.value === 'close' && observation.state === 'closed' && observation.position === 0);
			const begun =
				tagMatches &&
				((update.value === 'open' && observation.state === 'opening') ||
					(update.value === 'close' && observation.state === 'closing'));
			if (!(endpoint || begun || (update.value === 'stop' && idle && (tagMatches || noopStop)))) return false;
			if (!isCurrent()) return false;
			// Receipt records the actual observation; no COMMAND sample or optimistic physical state is written.
			return windows.confirm(handle, { value: nativeStatus, receivedAt: Date.now() }) !== null;
		},
	});
}

/** Completion means action begun/target observed for OPEN/CLOSE, explicit nonmoving state for STOP. */
export const coverConfirmationReason = (window: PropertyCommandWindow | null): string | undefined =>
	window?.proofKind !== 'cover_action'
		? undefined
		: window.commandedValue === 'stop'
			? 'cover_stopped'
			: ['opening', 'closing'].includes(String(window.lastReceipt?.value))
				? 'cover_action_begun'
				: 'cover_target_observed';
