import { instanceToPlain } from 'class-transformer';

import { HttpStatus, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import {
	HomeyMappingPreviewDeviceNotFoundError,
	HomeyMappingPreviewUnavailableError,
} from '../errors/homey-mapping-preview.error';
import { HomeyMappingPreviewModel } from '../models/mapping-preview.model';
import { HomeyMappingPreviewService } from '../services/homey-mapping-preview.service';

import { HomeyMappingPreviewController } from './homey-mapping-preview.controller';

const createPreview = (): HomeyMappingPreviewModel =>
	Object.assign(new HomeyMappingPreviewModel(), {
		device: {
			id: 'homey-light',
			name: 'Light',
			class: 'light',
			zoneId: 'zone-living',
			zonePath: ['Living room'],
			available: true,
		},
		suggestedCategory: DeviceCategory.LIGHTING,
		selectedCategory: DeviceCategory.LIGHTING,
		validCategories: [DeviceCategory.LIGHTING],
		channels: [],
		unsupportedCapabilityIds: [],
		warnings: [],
		readyToAdopt: true,
	});

describe('HomeyMappingPreviewController', () => {
	let mappingPreviewService: jest.Mocked<Pick<HomeyMappingPreviewService, 'generatePreview'>>;
	let controller: HomeyMappingPreviewController;

	beforeEach(() => {
		mappingPreviewService = { generatePreview: jest.fn().mockResolvedValue(createPreview()) };
		controller = new HomeyMappingPreviewController(mappingPreviewService as unknown as HomeyMappingPreviewService);
	});

	it('wraps the mapping preview in the standard response envelope', async () => {
		const request = { deviceId: 'homey-light', deviceCategory: DeviceCategory.LIGHTING };
		const response = await controller.preview(request);

		expect(mappingPreviewService.generatePreview).toHaveBeenCalledWith(request);
		expect(instanceToPlain(response)).toMatchObject({
			data: {
				device: { id: 'homey-light', zone_id: 'zone-living', zone_path: ['Living room'] },
				suggested_category: DeviceCategory.LIGHTING,
				selected_category: DeviceCategory.LIGHTING,
				valid_categories: [DeviceCategory.LIGHTING],
				ready_to_adopt: true,
			},
		});
	});

	it('maps unavailable inventory and unknown devices to fixed HTTP errors', async () => {
		mappingPreviewService.generatePreview.mockRejectedValueOnce(new HomeyMappingPreviewDeviceNotFoundError());

		await expect(controller.preview({ deviceId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);

		mappingPreviewService.generatePreview.mockRejectedValueOnce(new HomeyMappingPreviewUnavailableError());

		await expect(controller.preview({ deviceId: 'unavailable' })).rejects.toBeInstanceOf(UnprocessableEntityException);
	});

	it('allows only owners and administrators to preview mappings', () => {
		// Metadata inspection intentionally references the unbound controller method.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const handler = HomeyMappingPreviewController.prototype.preview;

		expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(HttpStatus.OK);
	});
});
