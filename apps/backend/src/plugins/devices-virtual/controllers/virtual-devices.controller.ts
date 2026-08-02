import {
	Body,
	Controller,
	Get,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
	ApiUnprocessableEntityResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import {
	DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME,
	DEVICES_VIRTUAL_PLUGIN_NAME,
	DEVICES_VIRTUAL_TYPE,
} from '../devices-virtual.constants';
import { ReqCompatibilityDto } from '../dto/compatibility-request.dto';
import { CompatibilityReportModel, CompatibilityResponseModel } from '../models/compatibility-response.model';
import { VirtualSourceDevicesResponseModel } from '../models/virtual-response.model';
import { VirtualDevicesService } from '../services/virtual-devices.service';

@ApiTags(DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME)
@Controller('devices')
export class VirtualDevicesController {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualDevicesController');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly virtualDevicesService: VirtualDevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
	) {}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'List the physical devices behind a virtual device',
		description:
			"Fetches the distinct physical devices that the specified virtual device's linked properties currently draw their values from. A virtual device built only from owned (synthesized) properties returns an empty list. Devices of any other type are rejected, so an empty list always means the virtual device genuinely draws from nothing.",
		operationId: 'get-devices-virtual-plugin-device-source-devices',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Virtual device ID' })
	@ApiSuccessResponse(VirtualSourceDevicesResponseModel, 'The distinct source devices behind the virtual device.')
	@ApiBadRequestResponse('Invalid UUID format')
	@ApiNotFoundResponse('Device not found')
	@ApiUnprocessableEntityResponse('Device is not a virtual device')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id/source-devices')
	async findSourceDevices(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
	): Promise<VirtualSourceDevicesResponseModel> {
		this.logger.debug(`Fetching source devices for virtual device id=${id}`);

		const device = await this.devicesService.findOne(id);

		if (!device) {
			this.logger.error(`[ERROR] Device with id=${id} not found`);

			throw new NotFoundException('Requested device does not exist');
		}

		// An ordinary physical device has no source properties either, so without this it would answer
		// `data: []` — a successful, and completely misleading, response: byte-for-byte what a real
		// virtual device assembled purely from owned properties returns. Distinguishing the two is the
		// whole point, because only one of them means "this device draws from nothing".
		//
		// 422 rather than 404: the id resolves to a device that genuinely exists, so reporting it as
		// missing would be a lie of a different kind, and the request is well-formed enough that 400
		// does not fit either. This is the codebase's established split for a resource whose *type*
		// makes an operation invalid — see SpacesSignageInfoPanelValidationException on the
		// space-type-scoped announcements routes, and DevicesValidationException for a space that is a
		// zone where a room was required; both surface as UnprocessableEntityException. Deliberately
		// not `devicesService.findOne(id, DEVICES_VIRTUAL_TYPE)`, which would collapse wrong-type into
		// the null branch above and answer 404 for a device the caller can see in the device list.
		if (device.type !== DEVICES_VIRTUAL_TYPE) {
			this.logger.error(`[ERROR] Device with id=${id} is of type '${device.type}', not a virtual device`);

			throw new UnprocessableEntityException('Requested device is not a virtual device');
		}

		const sourceDevices = await this.virtualDevicesService.findSourceDevices(id);

		this.logger.debug(`Found ${sourceDevices.length} source device(s) for virtual device id=${id}`);

		const response = new VirtualSourceDevicesResponseModel();

		response.data = sourceDevices;

		return response;
	}

	@ApiOperation({
		tags: [DEVICES_VIRTUAL_PLUGIN_API_TAG_NAME],
		summary: 'Preview source-property compatibility for a set of spec slots',
		description:
			'Reports, for each candidate spec-slot / source-property pairing, whether the source property could fill that slot and — when it cannot — why not. A read-only check with no side effects: nothing is created, linked or persisted. Every candidate is evaluated independently, so one incompatible pairing does not stop the others from being reported. Lets the construction wizard hard-block a source before the device is ever built, rather than accepting a mapping whose writes would die at the source platform.',
		operationId: 'check-devices-virtual-plugin-devices-compatibility',
	})
	@ApiSuccessResponse(CompatibilityResponseModel, 'One compatibility report per candidate, in request order.')
	@ApiBadRequestResponse('Invalid request body')
	@ApiUnprocessableEntityResponse('One or more candidate source properties do not exist')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post('compatibility')
	async checkCompatibility(@Body() body: ReqCompatibilityDto): Promise<CompatibilityResponseModel> {
		const { category, candidates } = body.data;

		this.logger.debug(`Checking compatibility of ${candidates.length} candidate(s) for category=${category}`);

		// Resolved once per distinct id rather than once per candidate: the same source property is
		// often checked against several spec slots at once (e.g. "could this switch's relay fill any of
		// these light channels"), and resolution failure is whole-request, so there is nothing to gain
		// from re-fetching a given id.
		const sourceProperties = new Map<string, ChannelPropertyEntity>();

		for (const candidate of candidates) {
			if (sourceProperties.has(candidate.source_property)) {
				continue;
			}

			const sourceProperty = await this.channelsPropertiesService.findOne(candidate.source_property);

			// Refuses the whole request rather than reporting this one candidate as incompatible: unlike a
			// permission or data-type mismatch, an id that resolves to nothing is not a legitimate
			// comparison outcome the wizard needs to grey out — it is a reference to a property that does
			// not exist, which is malformed input. Matches findSourceDevices' split above: existence
			// problems are refused outright, not folded into the report.
			if (!sourceProperty) {
				this.logger.error(`[ERROR] Candidate source property id=${candidate.source_property} not found`);

				throw new UnprocessableEntityException(
					`Candidate source property id=${candidate.source_property} does not exist`,
				);
			}

			sourceProperties.set(candidate.source_property, sourceProperty);
		}

		const reports = candidates.map((candidate) => {
			const sourceProperty = sourceProperties.get(candidate.source_property);

			const result = this.virtualDevicesService.reportCompatibility(
				{ category, channel: candidate.spec_channel, property: candidate.spec_property },
				sourceProperty,
			);

			const report = new CompatibilityReportModel();

			report.spec_channel = candidate.spec_channel;
			report.spec_property = candidate.spec_property;
			report.source_property = candidate.source_property;
			report.compatible = result.compatible;
			report.reason = result.reason;

			return report;
		});

		this.logger.debug(
			`Compatibility check complete: ${reports.filter((report) => report.compatible).length}/${reports.length} compatible`,
		);

		const response = new CompatibilityResponseModel();

		response.data = reports;

		return response;
	}
}
