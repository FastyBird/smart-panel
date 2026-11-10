import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { Seeder } from '../../seed/services/seed.service';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';

/**
 * Automations ship without demo data: an automation refers to devices, scenes and spaces by id, and
 * there is nothing meaningful to seed before node types exist. The seeder is registered so the module
 * takes part in the seed pipeline and demo automations can be added here later.
 */
@Injectable()
export class AutomationsSeederService implements Seeder {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationsSeederService');

	seed(): Promise<void> {
		this.logger.log('[SEED] Automations module has no demo data to seed.');

		return Promise.resolve();
	}
}
