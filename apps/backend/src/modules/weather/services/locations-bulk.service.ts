import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { BulkResultModel } from '../../api/models/bulk.model';
import { runBulkOperation } from '../../api/utils/bulk.utils';
import { WEATHER_MODULE_NAME } from '../weather.constants';
import { WeatherException } from '../weather.exceptions';

import { LocationsService } from './locations.service';

/**
 * Runs a location operation across a selection in a single request.
 *
 * The per-location semantics, including each refusal, are meant to be identical
 * to the single-location endpoints - see runBulkOperation for why the work is
 * still performed one location at a time.
 */
@Injectable()
export class LocationsBulkService {
	private readonly logger = createExtensionLogger(WEATHER_MODULE_NAME, 'LocationsBulkService');

	constructor(private readonly locationsService: LocationsService) {}

	async remove(ids: string[]): Promise<BulkResultModel> {
		const result = await runBulkOperation(
			ids,
			// The service raises for a missing location, and for the primary one it
			// refuses to delete, with a reason worth reading; runBulkOperation
			// carries that through per item.
			(id) => this.locationsService.remove(id),
			{ fallbackReason: 'Location could not be removed', safeErrors: [WeatherException], logger: this.logger },
		);

		this.logger.debug(`Bulk removal finished succeeded=${result.succeeded.length} failed=${result.failed.length}`);

		return result;
	}
}
