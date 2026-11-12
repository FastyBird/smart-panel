import { ApiSchema, OmitType } from '@nestjs/swagger';

import { AutomationRunEntity } from '../entities/automation-runs.entity';

/**
 * A run without its trace. Lists and the run events use it so they do not carry every step of every run.
 */
@ApiSchema({ name: 'AutomationsModuleDataRunSummary' })
export class AutomationRunSummaryModel extends OmitType(AutomationRunEntity, ['trace', 'automation'] as const) {}
