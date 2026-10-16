import { DataTypeType, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { VirtualLightGroupProfile } from '../entities/virtual-producer.entity';

/** Source access is separate from the read-only materialized output and composite command entry. */
export type GroupFieldAccess = 'ro' | 'rw' | 'wo';
export interface GroupFieldPolicy {
	category: PropertyCategory;
	access: GroupFieldAccess;
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
/**
 * Switch/outlet fields represent a complete boolean domain. Core boolean validation parses
 * true/false case-insensitively but does not enforce format enums, so partial domains and
 * malformed formats cannot participate in these profiles. Legacy lights retain their policy.
 */
export function groupBooleanContractIsSupported(
	profile: VirtualLightGroupProfile,
	property: ChannelPropertyEntity,
): boolean {
	if (profile === VirtualLightGroupProfile.LIGHT) return true;
	// This legacy guard is deliberately local to boolean fields in the new typed profiles.
	if (
		[VirtualLightGroupProfile.FAN, VirtualLightGroupProfile.COVER].includes(profile) &&
		![PropertyCategory.ON, PropertyCategory.SWING, PropertyCategory.OBSTRUCTION].includes(property.category)
	)
		return true;
	if (property.dataType !== DataTypeType.BOOL) return false;
	const format = property.format;
	if (format == null) return true;
	if (!Array.isArray(format)) return false;
	if (!format.length) return true;
	return (
		format.length === 2 &&
		format.every((value) => typeof value === 'string') &&
		new Set(format.map((value) => value.toLowerCase())).size === 2 &&
		format.every((value) => ['true', 'false'].includes(value.toLowerCase()))
	);
}
