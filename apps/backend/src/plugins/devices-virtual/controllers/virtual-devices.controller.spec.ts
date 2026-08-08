import { HttpException, HttpStatus, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import {
	VirtualCategoryNotSupportedException,
	VirtualNestingNotAllowedException,
	VirtualSourceNotFoundException,
} from '../devices-virtual.exceptions';
import { CompatibilityCandidateDto, ReqCompatibilityDto } from '../dto/compatibility-request.dto';
import { VirtualDevicesService } from '../services/virtual-devices.service';

import { VirtualDevicesController } from './virtual-devices.controller';

describe('VirtualDevicesController', () => {
	let controller: VirtualDevicesController;
	let devicesService: { findOne: jest.Mock };
	let virtualDevicesService: {
		findSourceDevices: jest.Mock;
		reportCompatibility: jest.Mock;
		assertSourceNotVirtual: jest.Mock;
		assertCategoryAllowed: jest.Mock;
	};
	let channelsPropertiesService: { findOne: jest.Mock };

	const virtualDevice = { id: 'virtual-device', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;
	const deviceA = { id: 'device-a' } as DeviceEntity;
	const deviceB = { id: 'device-b' } as DeviceEntity;

	beforeEach(() => {
		devicesService = { findOne: jest.fn().mockResolvedValue(virtualDevice) };
		virtualDevicesService = {
			findSourceDevices: jest.fn().mockResolvedValue([deviceA, deviceB]),
			reportCompatibility: jest.fn().mockReturnValue({ compatible: true }),
			assertSourceNotVirtual: jest.fn().mockResolvedValue(undefined),
			// A blocked category is refused before any candidate is looked at; the default is a category
			// virtual devices support.
			assertCategoryAllowed: jest.fn(),
		};
		channelsPropertiesService = { findOne: jest.fn() };

		controller = new VirtualDevicesController(
			devicesService as unknown as DevicesService,
			virtualDevicesService as unknown as VirtualDevicesService,
			channelsPropertiesService as unknown as ChannelsPropertiesService,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns the source devices wrapped in the response model', async () => {
		const response = await controller.findSourceDevices('virtual-device');

		expect(response.data).toEqual([deviceA, deviceB]);
		expect(virtualDevicesService.findSourceDevices).toHaveBeenCalledWith('virtual-device');
	});

	it('throws NotFoundException when the device does not exist, without consulting the domain service', async () => {
		devicesService.findOne.mockResolvedValue(null);

		await expect(controller.findSourceDevices('missing')).rejects.toThrow(NotFoundException);
		expect(virtualDevicesService.findSourceDevices).not.toHaveBeenCalled();
	});

	// Regression test for an existence-only check on a route defined solely for virtual devices. A
	// Shelly or a simulator device has no source properties either, so it used to fall through to a
	// 200 with `data: []` — byte-for-byte what a genuine virtual device assembled purely from owned
	// properties answers, and therefore indistinguishable from it.
	it('rejects a device of another type rather than reporting it as having no sources', async () => {
		devicesService.findOne.mockResolvedValue({ id: 'physical-device', type: 'shelly-ng' } as DeviceEntity);

		await expect(controller.findSourceDevices('physical-device')).rejects.toThrow(UnprocessableEntityException);
		expect(virtualDevicesService.findSourceDevices).not.toHaveBeenCalled();
	});

	// 422, not 404: the device exists and the caller can see it in the device list, so reporting it as
	// missing would trade one misleading answer for another. Matches how the rest of the codebase
	// separates "no such resource" from "that resource's type makes this operation invalid". The wire
	// status is asserted directly rather than inferred from the exception class, because it is the
	// status — not the class — that the endpoint's documented contract promises.
	it('rejects a wrong-type device with 422 rather than disguising it as a missing one', async () => {
		devicesService.findOne.mockResolvedValue({ id: 'physical-device', type: 'shelly-ng' } as DeviceEntity);

		expect.assertions(2);

		try {
			await controller.findSourceDevices('physical-device');
		} catch (error) {
			expect(error).toBeInstanceOf(HttpException);
			expect((error as HttpException).getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
		}
	});

	// The owned-properties-only case the endpoint's own description promises, kept adjacent to the
	// rejection above: an empty list stays a legitimate answer for a real virtual device, and must not
	// have been collapsed into the wrong-type branch.
	it('still returns an empty list for a virtual device that draws from nothing', async () => {
		virtualDevicesService.findSourceDevices.mockResolvedValue([]);

		const response = await controller.findSourceDevices('virtual-device');

		expect(response.data).toEqual([]);
	});

	describe('checkCompatibility', () => {
		const candidate = (sourceProperty: string, spec_property = PropertyCategory.ON): CompatibilityCandidateDto =>
			({
				spec_channel: ChannelCategory.LIGHT,
				spec_property,
				source_property: sourceProperty,
			}) as CompatibilityCandidateDto;

		const request = (candidates: CompatibilityCandidateDto[]): ReqCompatibilityDto =>
			({ data: { category: DeviceCategory.LIGHTING, candidates } }) as ReqCompatibilityDto;

		// `@ValidateCategoryAllowed` rejects a blocked category on the create, so a preview that answers
		// for one describes a device that cannot exist. Unlike an incompatible pairing that is not a
		// comparison outcome the wizard renders — it is a request about the wrong thing.
		it('refuses a category virtual devices do not support', async () => {
			virtualDevicesService.assertCategoryAllowed.mockImplementation(() => {
				throw new VirtualCategoryNotSupportedException(
					"Device category 'air_conditioner' requires closed-loop control, which virtual devices do not support yet",
				);
			});

			await expect(controller.checkCompatibility(request([candidate('source-a')]))).rejects.toThrow(
				UnprocessableEntityException,
			);
			expect(channelsPropertiesService.findOne).not.toHaveBeenCalled();
		});

		// Nesting is refused at persistence by `@ValidateSourceNotVirtual`, and `reportCompatibility`
		// cannot see it: that predicate compares a candidate against a *slot*, and a virtual device's
		// `light.on` fills a `light.on` slot perfectly. A preview that says yes here is the one answer a
		// user acts on — the wizard greys out whatever it is told is incompatible.
		it('reports a source owned by another virtual device as incompatible', async () => {
			channelsPropertiesService.findOne.mockResolvedValue({ id: 'nested-source' } as ChannelPropertyEntity);
			virtualDevicesService.assertSourceNotVirtual.mockRejectedValue(
				new VirtualNestingNotAllowedException(
					'Source property id=nested-source belongs to virtual device id=other; nesting virtual devices is not allowed',
				),
			);

			const response = await controller.checkCompatibility(request([candidate('nested-source')]));

			expect(response.data[0].compatible).toBe(false);
			expect(response.data[0].reason).toContain('nesting virtual devices is not allowed');
			// The slot predicate is not even consulted: this candidate cannot be persisted whatever it says.
			expect(virtualDevicesService.reportCompatibility).not.toHaveBeenCalled();
		});

		// The property was just read, so a chain that does not resolve means its channel or device does
		// not — malformed input of the same kind as an id naming nothing, and refused the same way rather
		// than folded into a report that would read as a legitimate comparison outcome.
		it('refuses the request when a candidate has no owning device', async () => {
			channelsPropertiesService.findOne.mockResolvedValue({ id: 'orphan-source' } as ChannelPropertyEntity);
			virtualDevicesService.assertSourceNotVirtual.mockRejectedValue(
				new VirtualSourceNotFoundException('Source property id=orphan-source does not resolve to an existing chain'),
			);

			await expect(controller.checkCompatibility(request([candidate('orphan-source')]))).rejects.toThrow(
				UnprocessableEntityException,
			);
		});

		it('reports compatibility per candidate, resolving each source property and preserving request order', async () => {
			const sourceA = { id: 'source-a' } as ChannelPropertyEntity;
			const sourceB = { id: 'source-b' } as ChannelPropertyEntity;

			channelsPropertiesService.findOne.mockImplementation((id: string) =>
				Promise.resolve(id === 'source-a' ? sourceA : sourceB),
			);
			virtualDevicesService.reportCompatibility
				.mockReturnValueOnce({ compatible: true })
				.mockReturnValueOnce({ compatible: false, reason: 'permission mismatch' });

			const response = await controller.checkCompatibility(
				request([candidate('source-a'), candidate('source-b', PropertyCategory.BRIGHTNESS)]),
			);

			expect(response.data).toEqual([
				{
					spec_channel: ChannelCategory.LIGHT,
					spec_property: PropertyCategory.ON,
					source_property: 'source-a',
					compatible: true,
					reason: undefined,
				},
				{
					spec_channel: ChannelCategory.LIGHT,
					spec_property: PropertyCategory.BRIGHTNESS,
					source_property: 'source-b',
					compatible: false,
					reason: 'permission mismatch',
				},
			]);
			// category (from the request, not the candidate) must reach the service too — it is what lets
			// reportCompatibility catch a channel that is real but not part of this device category's spec.
			expect(virtualDevicesService.reportCompatibility).toHaveBeenNthCalledWith(
				1,
				{ category: DeviceCategory.LIGHTING, channel: ChannelCategory.LIGHT, property: PropertyCategory.ON },
				sourceA,
			);
			expect(virtualDevicesService.reportCompatibility).toHaveBeenNthCalledWith(
				2,
				{
					category: DeviceCategory.LIGHTING,
					channel: ChannelCategory.LIGHT,
					property: PropertyCategory.BRIGHTNESS,
				},
				sourceB,
			);
		});

		it('resolves a source property referenced by more than one candidate only once', async () => {
			const source = { id: 'shared-source' } as ChannelPropertyEntity;

			channelsPropertiesService.findOne.mockResolvedValue(source);

			await controller.checkCompatibility(
				request([candidate('shared-source'), candidate('shared-source', PropertyCategory.BRIGHTNESS)]),
			);

			expect(channelsPropertiesService.findOne).toHaveBeenCalledTimes(1);
			expect(virtualDevicesService.reportCompatibility).toHaveBeenCalledTimes(2);
		});

		// Existence is refused outright rather than folded into the report — an id that resolves to
		// nothing is not a legitimate compatibility outcome the wizard needs to grey out, unlike a
		// permission or data-type mismatch. Matches the wrong-type split on findSourceDevices above.
		it('rejects the whole request with 422 when a candidate source property does not exist', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(null);

			await expect(controller.checkCompatibility(request([candidate('missing')]))).rejects.toThrow(
				UnprocessableEntityException,
			);
			expect(virtualDevicesService.reportCompatibility).not.toHaveBeenCalled();
		});

		// Report-per-candidate only holds for compatibility outcomes: this proves a missing source in a
		// *later* candidate still refuses the whole batch rather than reporting the earlier, resolvable
		// candidates and silently dropping the bad one.
		it('rejects the whole request even when only one of several candidates has a missing source', async () => {
			const source = { id: 'source-a' } as ChannelPropertyEntity;

			channelsPropertiesService.findOne.mockImplementation((id: string) =>
				Promise.resolve(id === 'source-a' ? source : null),
			);

			await expect(
				controller.checkCompatibility(request([candidate('source-a'), candidate('missing')])),
			).rejects.toThrow(UnprocessableEntityException);
			expect(virtualDevicesService.reportCompatibility).not.toHaveBeenCalled();
		});
	});
});
