import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { BulkResultModel } from '../../api/models/bulk.model';
import { runBulkOperation } from '../../api/utils/bulk.utils';
import { EXTENSIONS_MODULE_NAME } from '../extensions.constants';
import {
	ExtensionConfigValidationException,
	ExtensionNotConfigurableException,
	ExtensionNotFoundException,
} from '../extensions.exceptions';

import { ExtensionsService } from './extensions.service';

/**
 * Runs an extension operation across a selection in a single request.
 *
 * The per-extension semantics, including each refusal, are meant to be
 * identical to the single-extension endpoint - see runBulkOperation for why the
 * work is still performed one extension at a time.
 *
 * Unlike the other bulk endpoints, the selection is keyed by extension type
 * rather than by a generated id, matching `PATCH /extensions/:type`.
 */
@Injectable()
export class ExtensionsBulkService {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ExtensionsBulkService');

	constructor(private readonly extensionsService: ExtensionsService) {}

	async setEnabled(types: string[], enabled: boolean): Promise<BulkResultModel> {
		const result = await runBulkOperation(
			types,
			// The service raises for an unknown extension, for one that cannot be
			// toggled - a core extension - and for a config the update would
			// invalidate. Each reason is worth reading, and runBulkOperation carries
			// it through per item.
			async (type) => {
				await this.extensionsService.updateEnabled(type, enabled);
			},
			{
				fallbackReason: 'Extension could not be updated',
				safeErrors: [ExtensionNotFoundException, ExtensionNotConfigurableException, ExtensionConfigValidationException],
				logger: this.logger,
			},
		);

		this.logger.debug(
			`Bulk enabled=${String(enabled)} finished succeeded=${result.succeeded.length} failed=${result.failed.length}`,
		);

		return result;
	}
}
