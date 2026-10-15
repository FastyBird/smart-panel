import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';

export interface NativeCoverStatus {
	readonly id: number;
	readonly state: 'open' | 'closed' | 'opening' | 'closing' | 'stopped';
	readonly current_pos: number;
	readonly pos_control: true;
	readonly tag?: unknown;
}
/** Native validation precedes every transformer, clamp and command proof. */
export function nativeCoverStatus(value: unknown, componentId: number): NativeCoverStatus | null {
	if (!value || typeof value !== 'object') return null;
	const raw = value as Record<string, unknown>;
	if (
		raw.id !== componentId ||
		raw.pos_control !== true ||
		typeof raw.state !== 'string' ||
		!['open', 'closed', 'opening', 'closing', 'stopped'].includes(raw.state) ||
		typeof raw.current_pos !== 'number' ||
		!Number.isFinite(raw.current_pos) ||
		raw.current_pos < 0 ||
		raw.current_pos > 100 ||
		(raw.tag !== undefined && raw.tag !== null && (typeof raw.tag !== 'string' || raw.tag.length > 20)) ||
		(raw.errors !== undefined && (!Array.isArray(raw.errors) || raw.errors.length > 0))
	)
		return null;
	if ((raw.state === 'open' && raw.current_pos !== 100) || (raw.state === 'closed' && raw.current_pos !== 0))
		return null;
	return raw as unknown as NativeCoverStatus;
}
export const coverStatusReason = (value: Readonly<Record<string, unknown>>): string =>
	Array.isArray(value.errors) && value.errors.includes('source_unavailable')
		? 'cover_status_unavailable'
		: value.pos_control !== true
			? 'position_unavailable_uncalibrated'
			: typeof value.current_pos !== 'number' ||
				  !Number.isFinite(value.current_pos) ||
				  value.current_pos < 0 ||
				  value.current_pos > 100
				? 'position_unavailable_invalid'
				: 'cover_status_invalid_or_faulted';

export function configuredCoverType(properties: readonly ChannelPropertyEntity[]): string | null {
	const types = properties.filter((property) => property.category === PropertyCategory.TYPE);
	const property = types[0];
	return types.length === 1 &&
		property.dataType === DataTypeType.ENUM &&
		property.format?.length === 1 &&
		['curtain', 'roller', 'blind', 'venetian_blind', 'vertical_blind', 'shutter', 'outdoor_blind', 'awning'].includes(
			String(property.format[0]),
		) &&
		property.permissions.includes(PermissionType.READ_ONLY)
		? String(property.format[0])
		: null;
}
