import { Body, Controller, HttpCode, Logger, Put } from '@nestjs/common';

import { SkipApplicationInterceptor } from '../../../common/interceptors/response.interceptor';
import { toInstance } from '../../../common/utils/transform.utils';
import { Public } from '../../../modules/auth/guards/auth.guard';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';
import { PropertiesUpdateRequestDto } from '../dto/third-party-property-update-request.dto';
import { ThirdPartyDemoControlModel } from '../models/demo-control.model';

@Controller('demo')
@SkipApplicationInterceptor()
export class ThirdPartyDemoController {
	private readonly logger = new Logger(ThirdPartyDemoController.name);
	private queue: { [key: string]: NodeJS.Timeout } = {};

	constructor(private readonly channelsPropertiesService: ChannelsPropertiesService) {}

	@Public()
	@Put('webhook')
	@HttpCode(204)
	async controlDevice(@Body() body: PropertiesUpdateRequestDto): Promise<ThirdPartyDemoControlModel> {
		this.logger.debug('[THIRD-PARTY][DEMO CONTROLLER] Execute demo property update');

		const response = {
			properties: [],
		};

		for (const property of body.properties) {
			response.properties.push({
				...property,
				status: ThirdPartyPropertiesUpdateStatus.SUCCESS,
			});
		}

		for (const update of body.properties) {
			const property = await this.channelsPropertiesService.findOne(update.property);

			if (property === null) {
				this.logger.warn(
					`[THIRD-PARTY][DEMO CONTROLLER] Property to update was not found in system ${update.property}`,
				);

				continue;
			}

			if (property.id in this.queue) {
				clearTimeout(this.queue[property.id]);
			}

			this.queue[property.id] = setTimeout(() => {
				void (async () => {
					this.logger.debug(
						`[THIRD-PARTY][DEMO CONTROLLER] Updating property ${property.id} with value ${update.value}`,
					);

					await this.channelsPropertiesService.update(property.id, {
						type: property.type,
						value: update.value,
					});

					delete this.queue[property.id];
				})();
			}, 500);
		}

		return toInstance(ThirdPartyDemoControlModel, response);
	}
}
