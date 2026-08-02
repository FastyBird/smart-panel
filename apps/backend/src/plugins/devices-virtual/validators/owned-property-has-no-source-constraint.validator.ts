import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { VirtualValueOrigin, isUnsupportedValueOriginPair } from '../entities/devices-virtual.entity';

/**
 * Rejects the one (`value_origin`, `source_property`) pair the entity's state model has no state for —
 * `local` plus a source. See `isUnsupportedValueOriginPair` (../entities/devices-virtual.entity.ts) for
 * the state table and for why that pair produces a property which neither mirrors nor forwards.
 *
 * ## Scope: what one payload can see
 *
 * This is a DTO constraint, so it can only judge the pair when both halves are in the same request —
 * which is always the case on create (`value_origin` defaults to `source`, so an absent field is still
 * a known value) but not on a PATCH that sends only one of them. Two partial PATCHes reach the same
 * incoherent row without ever tripping this: `{value_origin: 'local'}` against a linked property, and
 * `{source_property: <id>}` against an owned one. Deciding those needs the *stored* row, which no
 * class-validator constraint has access to — `VirtualDevicesService.assertValueOriginPairSupported`,
 * called from the `beforeUpdate` mapping hook in ../devices-virtual.plugin.ts, judges the merged row
 * there instead.
 *
 * The two are complementary, not alternatives. This one runs first and produces the better error —
 * a 400 naming the offending field — for the payload that carries both halves, which is the shape the
 * admin UI actually sends; the hook is the backstop that no partial PATCH can slip past, and reports
 * a less specific 422 because that is all the service layer's failure vocabulary can express.
 *
 * Attached to `source_property` rather than `value_origin` so the error names the field that has to be
 * dropped: `value_origin: 'local'` is a deliberate choice about what the property *is*, whereas the
 * source is the part that cannot come with it.
 */
@ValidatorConstraint({ name: 'OwnedPropertyHasNoSource', async: false })
export class OwnedPropertyHasNoSourceConstraintValidator implements ValidatorConstraintInterface {
	validate(sourcePropertyId: string | undefined | null, args: ValidationArguments): boolean {
		// An absent or explicitly cleared source is the owned state itself, and is never in conflict.
		// (@IsOptional and @ValidateIf on the field already skip both cases; repeated here because a
		// constraint that only holds because of a decorator ordering elsewhere is a trap.)
		if (!sourcePropertyId) {
			return true;
		}

		const { value_origin } = args.object as { value_origin?: VirtualValueOrigin };

		return !isUnsupportedValueOriginPair(value_origin, sourcePropertyId);
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"Source property must not be set when value origin is '${VirtualValueOrigin.LOCAL}'; an owned property stores its own value."}]`;
	}
}

export function ValidateOwnedPropertyHasNoSource(): PropertyDecorator {
	return function (object: object, propertyName: string | symbol): void {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			validator: OwnedPropertyHasNoSourceConstraintValidator,
		});
	};
}
