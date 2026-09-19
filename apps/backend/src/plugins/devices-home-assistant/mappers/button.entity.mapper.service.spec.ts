import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { HomeAssistantDomain } from '../devices-home-assistant.constants';
import { HomeAssistantStateDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantChannelPropertyEntity } from '../entities/devices-home-assistant.entity';

import { ButtonEntityMapperService, InputButtonEntityMapperService } from './button.entity.mapper.service';

describe('ButtonEntityMapperService', () => {
	let service: ButtonEntityMapperService;
	let inputButtonService: InputButtonEntityMapperService;
	let channelsService: jest.Mocked<ChannelsService>;

	beforeEach(() => {
		channelsService = {
			findOne: jest.fn(),
		} as unknown as jest.Mocked<ChannelsService>;

		service = new ButtonEntityMapperService(channelsService);
		inputButtonService = new InputButtonEntityMapperService(channelsService);
	});

	it('has correct domains', () => {
		expect(service.domain).toBe(HomeAssistantDomain.BUTTON);
		expect(inputButtonService.domain).toBe(HomeAssistantDomain.INPUT_BUTTON);
	});

	it('returns empty map for mapFromHA so timestamp does not set state or toggle switchers', async () => {
		const state = {
			entity_id: 'button.doorbell_ring',
			state: '2026-09-17T00:00:00.000Z',
			attributes: {},
			last_changed: new Date('2026-09-17T00:00:00.000Z'),
			last_updated: new Date('2026-09-17T00:00:00.000Z'),
		} as unknown as HomeAssistantStateDto;
		const property = { id: 'p1' } as HomeAssistantChannelPropertyEntity;

		const mapped = await service.mapFromHA([property], state);
		expect(mapped.size).toBe(0);
	});

	it('maps to HA press service on mapToHA', async () => {
		const property = { id: 'p1' } as HomeAssistantChannelPropertyEntity;
		const values = new Map([[property.id, true]]);

		const result = await service.mapToHA([property], values);
		expect(result).toEqual({
			state: 'press',
			service: 'press',
		});
	});
});
