import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { HelperMappingPreviewModel } from '../models/helper-mapping-preview.model';
import { MappingPreviewModel } from '../models/mapping-preview.model';

import { DeviceAdoptionService } from './device-adoption.service';
import { HelperAdoptionService } from './helper-adoption.service';
import { HelperMappingPreviewService } from './helper-mapping-preview.service';
import { HomeAssistantHttpService } from './home-assistant.http.service';
import { MappingPreviewService } from './mapping-preview.service';
import { HomeAssistantWizardService } from './wizard.service';

const createDevicePreview = (warnings: MappingPreviewModel['warnings'] = []): MappingPreviewModel =>
	({
		haDevice: { id: 'ha-device-1', name: 'Living room lamp', manufacturer: 'Philips', model: 'Hue' },
		suggestedDevice: { category: DeviceCategory.LIGHTING, name: 'Living room lamp', confidence: 'high' },
		entities: [
			{
				entityId: 'light.living_room',
				domain: 'light',
				deviceClass: null,
				currentState: 'off',
				attributes: {},
				status: 'mapped',
				suggestedChannel: { category: ChannelCategory.LIGHT, name: 'Light', confidence: 'high' },
				suggestedProperties: [
					{
						category: PropertyCategory.ON,
						name: 'On',
						haAttribute: 'fb.main_state',
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
						unit: null,
						format: null,
						required: true,
						currentValue: false,
						haTransformer: null,
					},
				],
				unmappedAttributes: [],
				missingRequiredProperties: [],
			},
		],
		warnings,
		readyToAdopt: true,
		validation: {
			isValid: true,
			missingChannelsCount: 0,
			missingPropertiesCount: 0,
			fillableWithVirtualCount: 0,
			missingChannels: [],
			missingProperties: {},
			unknownChannels: [],
			duplicateChannels: [],
			constraintViolations: [],
			autoFilledVirtual: {},
		},
	}) as MappingPreviewModel;

const createHelperPreview = (): HelperMappingPreviewModel =>
	({
		helper: { entityId: 'input_boolean.guest_mode', name: 'Guest mode', domain: 'input_boolean' },
		suggestedDevice: { category: DeviceCategory.SWITCHER, name: 'Guest mode', confidence: 'medium' },
		suggestedChannel: {
			category: ChannelCategory.SWITCHER,
			name: 'Guest mode',
			confidence: 'medium',
			suggestedProperties: [],
		},
		suggestedChannels: [
			{
				category: ChannelCategory.SWITCHER,
				name: 'Guest mode',
				confidence: 'medium',
				suggestedProperties: [
					{
						category: PropertyCategory.ON,
						name: 'On',
						haAttribute: 'fb.main_state',
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
						unit: null,
						format: null,
						required: true,
						currentValue: false,
					},
				],
			},
		],
		warnings: [],
		readyToAdopt: true,
	}) as HelperMappingPreviewModel;

describe('HomeAssistantWizardService', () => {
	let service: HomeAssistantWizardService;
	let mappingPreviewService: { generatePreview: jest.Mock; generateSettledPreviews: jest.Mock };
	let helperMappingPreviewService: { generatePreview: jest.Mock; generateSettledPreviews: jest.Mock };
	let deviceAdoptionService: { adoptDevice: jest.Mock };
	let helperAdoptionService: { adoptHelper: jest.Mock };
	let homeAssistantHttpService: { getDiscoveredInventory: jest.Mock };
	let deviceValidationService: DeviceValidationService;

	beforeEach(() => {
		jest.useFakeTimers();
		mappingPreviewService = {
			generatePreview: jest.fn().mockResolvedValue(createDevicePreview()),
			generateSettledPreviews: jest.fn().mockResolvedValue([
				{
					source: { id: 'ha-device-1', name: 'Living room lamp' },
					preview: createDevicePreview(),
					error: null,
				},
			]),
		};
		helperMappingPreviewService = {
			generatePreview: jest.fn().mockResolvedValue(createHelperPreview()),
			generateSettledPreviews: jest.fn().mockResolvedValue([
				{
					source: { entityId: 'input_boolean.guest_mode', name: 'Guest mode', domain: 'input_boolean' },
					preview: createHelperPreview(),
					error: null,
				},
			]),
		};
		deviceAdoptionService = { adoptDevice: jest.fn().mockResolvedValue({ id: 'device-1' }) };
		helperAdoptionService = { adoptHelper: jest.fn().mockResolvedValue({ id: 'helper-1' }) };
		homeAssistantHttpService = {
			getDiscoveredInventory: jest.fn().mockResolvedValue({
				devices: [{ id: 'ha-device-1', adoptedDeviceId: null }],
				helpers: [{ entityId: 'input_boolean.guest_mode', adoptedDeviceId: null }],
			}),
		};
		deviceValidationService = new DeviceValidationService({} as DevicesService);
		service = new HomeAssistantWizardService(
			mappingPreviewService as unknown as MappingPreviewService,
			helperMappingPreviewService as unknown as HelperMappingPreviewService,
			deviceAdoptionService as unknown as DeviceAdoptionService,
			helperAdoptionService as unknown as HelperAdoptionService,
			homeAssistantHttpService as unknown as HomeAssistantHttpService,
			deviceValidationService,
		);
	});

	afterEach(() => {
		service.onModuleDestroy();
		jest.useRealTimers();
	});

	it('creates one bulk snapshot containing automatically mapped devices and helpers', async () => {
		const snapshot = await service.start();

		expect(snapshot.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(snapshot.candidates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: 'device:ha-device-1', status: 'ready', previewChannelCount: 1 }),
				expect.objectContaining({ key: 'helper:input_boolean.guest_mode', status: 'ready', previewChannelCount: 1 }),
			]),
		);
		expect(mappingPreviewService.generateSettledPreviews).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ id: 'ha-device-1' })]),
		);
		expect(helperMappingPreviewService.generateSettledPreviews).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ entityId: 'input_boolean.guest_mode' })]),
		);
		expect(homeAssistantHttpService.getDiscoveredInventory).toHaveBeenCalledTimes(1);
	});

	it('keeps ambiguous candidates out of automatic adoption', async () => {
		mappingPreviewService.generateSettledPreviews.mockResolvedValueOnce([
			{
				source: { id: 'ha-device-1', name: 'Living room lamp' },
				preview: createDevicePreview([
					{ type: 'unsupported_entity', entityId: 'sensor.unknown', message: 'Review mapping' },
				]),
				error: null,
			},
		]);
		const snapshot = await service.start();

		expect(snapshot.candidates.find((candidate) => candidate.kind === 'device')?.status).toBe('needs_attention');
		expect(snapshot.candidates.find((candidate) => candidate.kind === 'device')?.error).toBe('Review mapping');
		const results = await service.adopt(snapshot.id, ['device:ha-device-1']);

		expect(results?.[0]).toEqual(
			expect.objectContaining({
				status: 'failed',
				error: 'Candidate requires manual mapping or is no longer adoptable',
			}),
		);
		expect(deviceAdoptionService.adoptDevice).not.toHaveBeenCalled();
	});

	it('accepts only selected keys and adopts with the stored automatic mapping', async () => {
		const snapshot = await service.start();
		const results = await service.adopt(snapshot.id, ['device:ha-device-1']);

		expect(results).toEqual([{ key: 'device:ha-device-1', name: 'Living room lamp', status: 'created', error: null }]);
		expect(deviceAdoptionService.adoptDevice).toHaveBeenCalledWith(
			expect.objectContaining({
				haDeviceId: 'ha-device-1',
				name: 'Living room lamp',
				category: DeviceCategory.LIGHTING,
				channels: [expect.objectContaining({ entityId: 'light.living_room', category: ChannelCategory.LIGHT })],
			}),
			undefined,
			expect.objectContaining({ id: 'ha-device-1' }),
		);
		expect(homeAssistantHttpService.getDiscoveredInventory).toHaveBeenCalledTimes(2);
		expect(mappingPreviewService.generateSettledPreviews).toHaveBeenLastCalledWith([
			expect.objectContaining({ id: 'ha-device-1' }),
		]);
		expect(helperAdoptionService.adoptHelper).not.toHaveBeenCalled();
		expect(service.get(snapshot.id)?.candidates.find((candidate) => candidate.key === 'device:ha-device-1')).toEqual(
			expect.objectContaining({ status: 'already_registered', adoptedDeviceId: 'device-1' }),
		);
	});

	it('preserves helper mapping transformers during bulk adoption', async () => {
		const transformedPreview = createHelperPreview();
		transformedPreview.suggestedChannels[0].suggestedProperties[0].haTransformer = 'brightness_to_percent';
		helperMappingPreviewService.generateSettledPreviews.mockResolvedValueOnce([
			{
				source: { entityId: 'input_boolean.guest_mode', name: 'Guest mode', domain: 'input_boolean' },
				preview: transformedPreview,
				error: null,
			},
		]);
		const snapshot = await service.start();
		helperMappingPreviewService.generateSettledPreviews.mockResolvedValueOnce([
			{
				source: { entityId: 'input_boolean.guest_mode', name: 'Guest mode', domain: 'input_boolean' },
				preview: transformedPreview,
				error: null,
			},
		]);

		await service.adopt(snapshot.id, ['helper:input_boolean.guest_mode']);

		expect(helperAdoptionService.adoptHelper).toHaveBeenCalledWith(
			expect.objectContaining({
				channels: [
					expect.objectContaining({
						properties: [expect.objectContaining({ haTransformer: 'brightness_to_percent' })],
					}),
				],
			}),
			expect.objectContaining({ entityId: 'input_boolean.guest_mode' }),
		);
	});

	it('revalidates automatic mapping immediately before persistence', async () => {
		const snapshot = await service.start();
		mappingPreviewService.generateSettledPreviews.mockResolvedValueOnce([
			{
				source: { id: 'ha-device-1', name: 'Living room lamp' },
				preview: createDevicePreview([
					{ type: 'unsupported_entity', entityId: 'sensor.changed', message: 'Mapping changed' },
				]),
				error: null,
			},
		]);

		const results = await service.adopt(snapshot.id, ['device:ha-device-1']);

		expect(results).toEqual([
			expect.objectContaining({
				key: 'device:ha-device-1',
				status: 'failed',
				error: 'Automatic mapping changed and now requires manual review',
			}),
		]);
		expect(deviceAdoptionService.adoptDevice).not.toHaveBeenCalled();
	});

	it('keeps successful siblings when one selected candidate fails', async () => {
		const snapshot = await service.start();
		helperAdoptionService.adoptHelper.mockRejectedValueOnce(new Error('Helper disappeared'));

		const results = await service.adopt(snapshot.id, ['device:ha-device-1', 'helper:input_boolean.guest_mode']);

		expect(results).toEqual([
			{ key: 'device:ha-device-1', name: 'Living room lamp', status: 'created', error: null },
			{ key: 'helper:input_boolean.guest_mode', name: 'Guest mode', status: 'failed', error: 'Helper disappeared' },
		]);
		expect(homeAssistantHttpService.getDiscoveredInventory).toHaveBeenCalledTimes(2);
		expect(mappingPreviewService.generateSettledPreviews).toHaveBeenCalledTimes(2);
		expect(helperMappingPreviewService.generateSettledPreviews).toHaveBeenCalledTimes(2);
	});

	it('marks candidates already adopted outside the wizard as unavailable', async () => {
		homeAssistantHttpService.getDiscoveredInventory.mockResolvedValueOnce({
			devices: [{ id: 'ha-device-1', adoptedDeviceId: 'existing-1' }],
			helpers: [{ entityId: 'input_boolean.guest_mode', adoptedDeviceId: null }],
		});
		const snapshot = await service.start();

		expect(snapshot.candidates.find((candidate) => candidate.key === 'device:ha-device-1')).toEqual(
			expect.objectContaining({ status: 'already_registered', adoptedDeviceId: 'existing-1' }),
		);
	});

	it('keeps valid candidates when another mapping preview fails', async () => {
		mappingPreviewService.generateSettledPreviews.mockResolvedValueOnce([
			{
				source: { id: 'ha-device-1', name: 'Living room lamp' },
				preview: null,
				error: 'Home Assistant device with ID ha-device-1 not found',
			},
		]);

		const snapshot = await service.start();

		expect(snapshot.candidates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					key: 'device:ha-device-1',
					status: 'failed',
					error: 'Home Assistant device with ID ha-device-1 not found',
				}),
				expect.objectContaining({ key: 'helper:input_boolean.guest_mode', status: 'ready' }),
			]),
		);
	});

	it('does not offer a helper that is already represented by a ready physical device mapping', async () => {
		const overlappingHelper = createHelperPreview();
		overlappingHelper.helper.entityId = 'light.living_room';
		helperMappingPreviewService.generateSettledPreviews.mockResolvedValueOnce([
			{
				source: { entityId: 'light.living_room', name: 'Living room lamp', domain: 'light' },
				preview: overlappingHelper,
				error: null,
			},
		]);

		const snapshot = await service.start();

		expect(snapshot.candidates.find((candidate) => candidate.kind === 'helper')).toBeUndefined();
	});

	it('keeps an adopted helper visible and blocks a conflicting physical device candidate', async () => {
		const overlappingHelper = createHelperPreview();
		overlappingHelper.helper.entityId = 'light.living_room';
		homeAssistantHttpService.getDiscoveredInventory.mockResolvedValueOnce({
			devices: [{ id: 'ha-device-1', adoptedDeviceId: null }],
			helpers: [{ entityId: 'light.living_room', adoptedDeviceId: 'helper-device-1' }],
		});
		helperMappingPreviewService.generateSettledPreviews.mockResolvedValueOnce([
			{
				source: {
					entityId: 'light.living_room',
					name: 'Living room lamp',
					domain: 'light',
					adoptedDeviceId: 'helper-device-1',
				},
				preview: overlappingHelper,
				error: null,
			},
		]);

		const snapshot = await service.start();

		expect(snapshot.candidates.find((candidate) => candidate.kind === 'device')).toEqual(
			expect.objectContaining({ status: 'needs_attention' }),
		);
		expect(snapshot.candidates.find((candidate) => candidate.kind === 'helper')).toEqual(
			expect.objectContaining({ status: 'already_registered', adoptedDeviceId: 'helper-device-1' }),
		);
	});

	it('requires helper mappings to satisfy the complete device specification', async () => {
		const incompleteClimatePreview = createHelperPreview();
		incompleteClimatePreview.helper = {
			entityId: 'climate.living_room',
			name: 'Living room thermostat',
			domain: 'climate',
		};
		incompleteClimatePreview.suggestedDevice.category = DeviceCategory.THERMOSTAT;
		incompleteClimatePreview.suggestedChannels = [
			{
				category: ChannelCategory.THERMOSTAT,
				name: 'Thermostat',
				confidence: 'high',
				suggestedProperties: [
					{
						category: PropertyCategory.LOCKED,
						name: 'Locked',
						haAttribute: 'locked',
						dataType: DataTypeType.BOOL,
						permissions: [PermissionType.READ_WRITE],
						unit: null,
						format: null,
						required: false,
						currentValue: false,
						haTransformer: null,
					},
				],
			},
		];
		helperMappingPreviewService.generateSettledPreviews.mockResolvedValueOnce([
			{
				source: { entityId: 'climate.living_room', name: 'Living room thermostat', domain: 'climate' },
				preview: incompleteClimatePreview,
				error: null,
			},
		]);

		const snapshot = await service.start();

		expect(snapshot.candidates.find((candidate) => candidate.kind === 'helper')).toEqual(
			expect.objectContaining({ status: 'needs_attention', error: 'Automatic mapping requires manual review' }),
		);
		expect(helperAdoptionService.adoptHelper).not.toHaveBeenCalled();
	});

	it('returns null for an unknown session', async () => {
		expect(service.get('missing')).toBeNull();
		await expect(service.adopt('missing', ['device:ha-device-1'])).resolves.toBeNull();
	});
});
