import { Injectable } from '@nestjs/common';

import { SpaceEntity } from '../../spaces/entities/space.entity';

/**
 * Validator contract contributed by plugins that own a space type.
 *
 * Phase 5 removes `DisplayRole` from `DisplayEntity`: a display simply
 * points at a space and the space's polymorphic type decides what the
 * panel renders. Some space-type plugins need to apply extra rules when
 * a display is assigned — e.g. signage space types that should only be
 * driven by a single display, or synthetic singleton spaces.
 *
 * Validators throw when the assignment is rejected. A silent no-op is
 * interpreted as "no objection".
 */
export interface ISpaceSelectionValidator {
	validate(space: SpaceEntity, displayId: string | null): Promise<void> | void;
}

@Injectable()
export class SpaceSelectionValidatorRegistryService {
	private readonly validators: ISpaceSelectionValidator[] = [];

	register(validator: ISpaceSelectionValidator): void {
		this.validators.push(validator);
	}

	getValidators(): ISpaceSelectionValidator[] {
		return this.validators;
	}
}
