import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { PermissionType } from '../../../modules/devices/devices.constants';
import { VirtualValueOrigin, isUnsupportedOwnedPermissionsPair } from '../entities/devices-virtual.entity';

/**
 * Rejects an OWNED property that claims to be writable — a control nothing can ever act on. See
 * `isUnsupportedOwnedPermissionsPair` (../entities/devices-virtual.entity.ts) for why v1 has no write
 * semantics for such a property, and why an accepted one is worse than merely useless.
 *
 * ## Scope: what one payload can see
 *
 * This is a DTO constraint, so it can only judge the pair when both halves are in the same request —
 * always the case on create (`value_origin` defaults to `source`, so an absent field is still a known
 * value, and `permissions` is required) but not on a PATCH that sends only one of them. Two partial
 * PATCHes reach the same refused row without ever tripping this: `{permissions: ['rw']}` against an
 * owned property, and `{value_origin: 'local'}` against a writable orphan. Deciding those needs the
 * *stored* row, which no class-validator constraint has access to —
 * `VirtualDevicesService.assertOwnedPropertyNotWritable`, called from the `beforeUpdate` mapping hook
 * in ../devices-virtual.plugin.ts, judges the merged row there instead.
 *
 * The two are complementary, not alternatives, on exactly the terms
 * `OwnedPropertyHasNoSourceConstraintValidator` sets out for its own pair: this one runs first and
 * produces the better error — a 400 naming the offending field — for the payload that carries both
 * halves, which is the shape the admin UI actually sends; the hook is the backstop no partial PATCH
 * can slip past, and reports a less specific 422 because that is all the service layer's failure
 * vocabulary can express.
 *
 * Attached to `permissions` rather than `value_origin` so the error names the field that has to be
 * dropped: `value_origin: 'local'` is a deliberate choice about what the property *is*, whereas
 * writability is the part that cannot come with it.
 */
@ValidatorConstraint({ name: 'OwnedPropertyNotWritable', async: false })
export class OwnedPropertyNotWritableConstraintValidator implements ValidatorConstraintInterface {
	validate(permissions: PermissionType[] | undefined | null, args: ValidationArguments): boolean {
		// Absent permissions are @IsOptional/@ArrayNotEmpty's business, not ours.
		if (!permissions?.length) {
			return true;
		}

		const { value_origin } = args.object as { value_origin?: VirtualValueOrigin };

		return !isUnsupportedOwnedPermissionsPair(value_origin, permissions);
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"A property with value origin '${VirtualValueOrigin.LOCAL}' must be read-only; an owned property stores its own value and forwards nothing, so a writable one could never reach any hardware."}]`;
	}
}

export function ValidateOwnedPropertyNotWritable(): PropertyDecorator {
	return function (object: object, propertyName: string | symbol): void {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			validator: OwnedPropertyNotWritableConstraintValidator,
		});
	};
}
