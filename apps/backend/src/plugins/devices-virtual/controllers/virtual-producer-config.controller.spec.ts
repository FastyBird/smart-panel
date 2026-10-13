import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ConfigureVirtualAggregateDto } from '../dto/producer-config.dto';
import { VirtualProducerConfigService } from '../services/virtual-producer-config.service';

import { VirtualProducerConfigController } from './virtual-producer-config.controller';

describe('producer configuration HTTP failures', () => {
	it('reports a rejected policy or stale revision as 422', async () => {
		const configs = {
			configureAggregate: jest.fn().mockRejectedValue(new DevicesValidationException('revision changed')),
		};
		const controller = new VirtualProducerConfigController(configs as unknown as VirtualProducerConfigService);
		await expect(controller.configureAggregate('output', new ConfigureVirtualAggregateDto())).rejects.toBeInstanceOf(
			UnprocessableEntityException,
		);
	});

	it('preserves a missing configuration response as 404', async () => {
		const configs = { getAggregate: jest.fn().mockRejectedValue(new NotFoundException('missing')) };
		const controller = new VirtualProducerConfigController(configs as unknown as VirtualProducerConfigService);
		await expect(controller.getAggregate('output')).rejects.toBeInstanceOf(NotFoundException);
	});
});
