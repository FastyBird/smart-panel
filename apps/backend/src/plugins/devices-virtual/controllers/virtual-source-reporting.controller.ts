import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { toInstance } from '../../../common/utils/transform.utils';
import { ApiSuccessResponse } from '../../../modules/swagger/decorators/api-documentation.decorator';
import { DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME } from '../devices-virtual.constants';
import {
	VirtualSourceReportingModel,
	VirtualSourceReportingResponseModel,
} from '../models/source-reporting-response.model';
import { VirtualSourceReportingService } from '../services/virtual-source-reporting.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('producers/source-reporting')
export class VirtualSourceReportingController {
	constructor(private readonly reporting: VirtualSourceReportingService) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Describe how often a virtual device source reports',
		description:
			'Reports how often a candidate source of a thermostat, aggregate, converter or dew point has been reporting ' +
			'since Smart Panel started, with a maximum sample age that suits it. Battery radio sensors often report only ' +
			'every 30-60 minutes. Guidance only: it never qualifies a binding.',
		operationId: 'get-devices-virtual-plugin-source-reporting',
	})
	@ApiSuccessResponse(VirtualSourceReportingResponseModel, 'Source reporting profile')
	@Get(':id')
	async sourceReporting(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualSourceReportingResponseModel> {
		const reporting = await this.reporting.sourceReporting(id);
		if (!reporting) throw new NotFoundException('Source property does not exist.');
		const response = new VirtualSourceReportingResponseModel();
		response.data = toInstance(VirtualSourceReportingModel, reporting);
		return response;
	}
}
