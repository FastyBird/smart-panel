import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { VirtualValueOrigin } from '../entities/devices-virtual.entity';

/**
 * Rejects the one (`value_origin`, `source_property`) pair the entity's state model has no state for.
 *
 * VirtualChannelPropertyEntity defines exactly three states (see its `isProjecting` / `isOrphaned` /
 * `isLinked` getters, and the design spec's state table):
 *
 * | `valueOrigin` | `sourcePropertyId` | state    |
 * |---------------|--------------------|----------|
 * | `source`      | set                | linked   |
 * | `source`      | `null`             | orphaned |
 * | `local`       | `null`             | owned    |
 *
 * `local` + a source is the missing fourth row. Each field validates fine on its own, so without this
 * the API accepts it and produces a property that neither mirrors nor forwards: VirtualValueSourceService
 * resolves an owned property to its *own* storage key and never looks at the source, VirtualPropertyIndexService
 * skips owned properties entirely so nothing projects into it, and VirtualDevicePlatform refuses to
 * forward a write for a property that is not in the index. The named source is inert in all three, and
 * silently so.
 *
 * ## Scope: what one payload can see
 *
 * This is a DTO constraint, so it can only judge the pair when both halves are in the same request —
 * which is always the case on create (`value_origin` defaults to `source`, so an absent field is still
 * a known value) but not on a PATCH that sends only one of them. Two partial PATCHes can still reach
 * the same incoherent row: `{value_origin: 'local'}` against a linked property, and
 * `{source_property: <id>}` against an owned one. Closing those needs the stored row, which no
 * class-validator constraint has access to — recorded as a follow-up rather than half-solved here.
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

		return value_origin !== VirtualValueOrigin.LOCAL;
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
