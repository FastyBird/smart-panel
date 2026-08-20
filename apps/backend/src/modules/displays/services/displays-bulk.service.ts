import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { BulkResultModel } from '../../api/models/bulk.model';
import { runBulkOperation } from '../../api/utils/bulk.utils';
import { DISPLAYS_MODULE_NAME } from '../displays.constants';
import { DisplaysNotFoundException } from '../displays.exceptions';

import { DisplaysService } from './displays.service';

/**
 * Runs a display operation across a selection in a single request.
 *
 * The per-display semantics, including each refusal, are meant to be identical
 * to the single-display endpoints - see runBulkOperation for why the work is
 * still performed one display at a time.
 */
@Injectable()
export class DisplaysBulkService {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'DisplaysBulkService');

	constructor(private readonly displaysService: DisplaysService) {}

	async remove(ids: string[]): Promise<BulkResultModel> {
		const result = await runBulkOperation(
			ids,
			// The service raises for a display that is not there with a reason worth
			// reading, and runBulkOperation carries that through per item.
			(id) => this.displaysService.remove(id),
			{
				fallbackReason: 'Display could not be removed',
				safeErrors: [DisplaysNotFoundException],
				logger: this.logger,
			},
		);

		this.logger.debug(`Bulk removal finished succeeded=${result.succeeded.length} failed=${result.failed.length}`);

		return result;
	}
}
