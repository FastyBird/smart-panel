import { EventEmitter2 } from '@nestjs/event-emitter';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { DEFAULT_TTL_SPACE_COMMAND, IntentType } from '../../intents/intents.constants';
import { MediaIntentDto } from '../dto/media-intent.dto';
import { MediaIntentType, MediaMode } from '../spaces.constants';

import { MediaIntentService } from './media-intent.service';

describe('MediaIntentService', () => {
	const spacesService = {
		findOne: jest.fn(),
		findDevicesBySpace: jest.fn(),
	};
	const platformRegistryService = {
		get: jest.fn(),
	};
	const mediaRoleService = {
		getRoleMap: jest.fn(),
	};
	const eventEmitter = {
		emit: jest.fn(),
	} as unknown as EventEmitter2;
	const mediaStateService = {
		setLastAppliedMode: jest.fn(),
		getMediaState: jest.fn(),
	};
	const intentsService = {
		createIntent: jest.fn(),
		completeIntent: jest.fn(),
	};
	const intentTimeseriesService = {
		storeMediaStateChange: jest.fn(),
	};

	let service: MediaIntentService;

	beforeEach(() => {
		jest.resetAllMocks();

		service = new MediaIntentService(
			spacesService as unknown as any,
			platformRegistryService as unknown as any,
			mediaRoleService as unknown as any,
			eventEmitter,
			mediaStateService as unknown as any,
			intentsService as unknown as any,
		intentTimeseriesService as unknown as any,
		);

		platformRegistryService.get.mockReturnValue({
			processBatch: jest.fn().mockResolvedValue(true),
		});
		mediaStateService.getMediaState.mockResolvedValue({ totalDevices: 1, devicesOn: 1 });
		intentsService.createIntent.mockReturnValue({ id: 'intent-1' });
	});

	it('creates and completes intent for media mode change', async () => {
		const dto: MediaIntentDto = {
			type: MediaIntentType.SET_MODE,
			mode: MediaMode.PARTY,
		};

		spacesService.findOne.mockResolvedValue({ id: 'space-1' });
		spacesService.findDevicesBySpace.mockResolvedValue([
			{
				id: 'device-1',
				category: DeviceCategory.MEDIA,
				channels: [
					{
						id: 'channel-1',
						category: ChannelCategory.SPEAKER,
						properties: [
							{ category: PropertyCategory.ON, value: true },
							{ category: PropertyCategory.VOLUME, value: 50 },
							{ category: PropertyCategory.MUTE, value: false },
						],
					},
				],
			},
		]);
		mediaRoleService.getRoleMap.mockResolvedValue(new Map());

		const result = await service.executeMediaIntent('space-1', dto);

		expect(result?.success).toBe(true);
		expect(intentsService.createIntent).toHaveBeenCalledWith(
			expect.objectContaining({
				type: IntentType.SPACE_MEDIA_SET_MODE,
				ttlMs: DEFAULT_TTL_SPACE_COMMAND,
			}),
		);
		expect(intentsService.completeIntent).toHaveBeenCalledWith('intent-1', expect.any(Array));
		expect(mediaStateService.setLastAppliedMode).toHaveBeenCalledWith('space-1', MediaMode.PARTY);
		expect(intentTimeseriesService.storeMediaStateChange).toHaveBeenCalledWith(
			'space-1',
			IntentType.SPACE_MEDIA_SET_MODE,
			expect.objectContaining({ mode: MediaMode.PARTY }),
		);
	});
});
