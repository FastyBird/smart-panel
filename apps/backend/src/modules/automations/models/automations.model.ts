import { ApiSchema, OmitType } from '@nestjs/swagger';

import { AutomationEntity } from '../entities/automations.entity';

/**
 * An automation without its graph. Lists use it so a page of automations does not carry every canvas.
 */
@ApiSchema({ name: 'AutomationsModuleDataAutomationSummary' })
export class AutomationSummaryModel extends OmitType(AutomationEntity, ['graph'] as const) {}
