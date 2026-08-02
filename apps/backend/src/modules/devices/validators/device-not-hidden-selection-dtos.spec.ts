import { ClassConstructor } from 'class-transformer';
import { useContainer, validate } from 'class-validator';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDeviceChannelDataSourceDto } from '../../../plugins/data-sources-device-channel/dto/create-data-source.dto';
import { UpdateDeviceChannelDataSourceDto } from '../../../plugins/data-sources-device-channel/dto/update-data-source.dto';
import { ChannelPropertyExistsConstraintValidator } from '../../../plugins/data-sources-device-channel/validators/channel-property-exists-constraint.validator';
import { DeviceChannelExistsConstraintValidator } from '../../../plugins/data-sources-device-channel/validators/device-channel-exists-constraint.validator';
import { DeviceExistsConstraintValidator as DataSourceDeviceExistsConstraintValidator } from '../../../plugins/data-sources-device-channel/validators/device-exists-constraint.validator';
import { CreateDeviceDetailPageDto } from '../../../plugins/pages-device-detail/dto/create-page.dto';
import { UpdateDeviceDetailPageDto } from '../../../plugins/pages-device-detail/dto/update-page.dto';
import { CreateLocalSceneActionDto } from '../../../plugins/scenes-local/dto/create-local-scene-action.dto';
import { UpdateLocalSceneActionDto } from '../../../plugins/scenes-local/dto/update-local-scene-action.dto';
import { CreateDevicePreviewTileDto } from '../../../plugins/tiles-device-preview/dto/create-tile.dto';
import { UpdateDevicePreviewTileDto } from '../../../plugins/tiles-device-preview/dto/update-tile.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsPropertiesService } from '../services/channels.properties.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';

import { DeviceExistsConstraintValidator } from './device-exists-constraint.validator';
import { DeviceNotHiddenConstraintValidator } from './device-not-hidden-constraint.validator';

const VISIBLE_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const HIDDEN_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440001';
const CHANNEL_ID = '550e8400-e29b-41d4-a716-446655440002';
const PROPERTY_ID = '550e8400-e29b-41d4-a716-446655440003';

/**
 * The design spec's settled decision — "Hidden devices excluded from the space, tile and data-source
 * pickers" — made enforceable. `ValidateDeviceNotHidden` existed but was attached to zero DTOs, so a
 * hidden device could still be selected and persisted through every one of those pickers.
 *
 * Exercised against the real DTO classes through real class-validator with a DI-resolved constraint,
 * rather than by calling the constraint directly (which device-not-hidden-constraint.validator.spec.ts
 * already covers): what was broken here was the *wiring*, and a direct call passes against the broken
 * code too.
 *
 * ## Why every case below has an "other validation still fires" twin
 *
 * class-validator's getTargetValidationMetadatas() drops an inherited metadata whenever the subclass
 * declares one with the same `(propertyName, type)` pair — it replaces rather than merges. Nearly
 * every custom constraint shares the type `customValidation`, so adding one custom validator to a
 * property a parent class already decorated silently deletes the parent's custom validators on that
 * property, with no error raised anywhere. Each DTO below declares its device field itself, so there
 * is nothing inherited to lose — but "there is nothing inherited to lose" is exactly the kind of claim
 * that stops being true the moment someone hoists a shared field up into a base DTO, so it is asserted
 * rather than assumed.
 */
describe('ValidateDeviceNotHidden on the device selection DTOs', () => {
	let devicesService: { findOne: jest.Mock };
	let channelsService: { findOne: jest.Mock };
	let channelsPropertiesService: { findOne: jest.Mock };

	beforeAll(() => {
		devicesService = { findOne: jest.fn() };
		channelsService = { findOne: jest.fn() };
		channelsPropertiesService = { findOne: jest.fn() };

		// Minimal stand-in for Nest's DI container (see main.ts's real `useContainer(app.select(...))`).
		// Every constraint reachable from the DTOs below is resolved to a real instance backed by these
		// stubs, not only the one under test: an unresolved constraint would be constructed with no
		// services at all and throw inside validate(), which rejects the whole validate() promise and
		// would take every assertion in the case with it.
		const instances = new Map<unknown, unknown>([
			[
				DeviceNotHiddenConstraintValidator,
				new DeviceNotHiddenConstraintValidator(devicesService as unknown as DevicesService),
			],
			[
				DeviceExistsConstraintValidator,
				new DeviceExistsConstraintValidator(devicesService as unknown as DevicesService),
			],
			[
				DataSourceDeviceExistsConstraintValidator,
				new DataSourceDeviceExistsConstraintValidator(devicesService as unknown as DevicesService),
			],
			[
				DeviceChannelExistsConstraintValidator,
				new DeviceChannelExistsConstraintValidator(
					devicesService as unknown as DevicesService,
					channelsService as unknown as ChannelsService,
				),
			],
			[
				ChannelPropertyExistsConstraintValidator,
				new ChannelPropertyExistsConstraintValidator(
					channelsService as unknown as ChannelsService,
					channelsPropertiesService as unknown as ChannelsPropertiesService,
				),
			],
		]);

		useContainer(
			{
				get: <T>(someClass: new () => T): T => (instances.get(someClass) ?? new someClass()) as T,
			},
			{ fallbackOnErrors: true },
		);
	});

	beforeEach(() => {
		jest.clearAllMocks();

		const visibleDevice = Object.assign(new DeviceEntity(), { id: VISIBLE_DEVICE_ID, hidden: false });
		const hiddenDevice = Object.assign(new DeviceEntity(), { id: HIDDEN_DEVICE_ID, hidden: true });
		const channel = Object.assign(new ChannelEntity(), { id: CHANNEL_ID, device: visibleDevice });

		devicesService.findOne.mockImplementation((id: string) => {
			if (id === HIDDEN_DEVICE_ID) {
				return Promise.resolve(hiddenDevice);
			}

			return Promise.resolve(id === VISIBLE_DEVICE_ID ? visibleDevice : null);
		});
		channelsService.findOne.mockResolvedValue(channel);
		channelsPropertiesService.findOne.mockResolvedValue(
			Object.assign(new ChannelPropertyEntity(), { id: PROPERTY_ID, channel }),
		);
	});

	// Every DTO the design spec names, with the field it carries the device on and whatever sibling
	// fields are needed to reach that field's validation at all. Errors are filtered by `field`, so a
	// sibling's own (irrelevant) errors can never make one of these pass or fail by accident.
	// Typed as a plain constructor of `object`: the eight DTOs share no common supertype, so an inferred
	// union would make every toInstance() call below fail to pick an overload.
	const cases: { name: string; dto: ClassConstructor<object>; field: string; rest: Record<string, unknown> }[] = [
		{ name: 'CreateDevicePreviewTileDto', dto: CreateDevicePreviewTileDto, field: 'device', rest: {} },
		{ name: 'UpdateDevicePreviewTileDto', dto: UpdateDevicePreviewTileDto, field: 'device', rest: {} },
		{ name: 'CreateDeviceDetailPageDto', dto: CreateDeviceDetailPageDto, field: 'device', rest: {} },
		{ name: 'UpdateDeviceDetailPageDto', dto: UpdateDeviceDetailPageDto, field: 'device', rest: {} },
		{
			name: 'CreateDeviceChannelDataSourceDto',
			dto: CreateDeviceChannelDataSourceDto,
			field: 'device',
			rest: { channel: CHANNEL_ID, property: PROPERTY_ID },
		},
		{
			name: 'UpdateDeviceChannelDataSourceDto',
			dto: UpdateDeviceChannelDataSourceDto,
			field: 'device',
			rest: { channel: CHANNEL_ID, property: PROPERTY_ID },
		},
		{
			name: 'CreateLocalSceneActionDto',
			dto: CreateLocalSceneActionDto,
			field: 'device_id',
			rest: { property_id: PROPERTY_ID, value: true },
		},
		{
			name: 'UpdateLocalSceneActionDto',
			dto: UpdateLocalSceneActionDto,
			field: 'device_id',
			rest: { property_id: PROPERTY_ID, value: true },
		},
	];

	describe.each(cases)('$name', ({ dto, field, rest }) => {
		const validateWith = (deviceId: unknown) => validate(toInstance(dto, { ...rest, [field]: deviceId }));

		it('rejects a hidden device', async () => {
			const errors = await validateWith(HIDDEN_DEVICE_ID);

			expect(errors.some((error) => error.property === field && !!error.constraints?.DeviceNotHidden)).toBe(true);
		});

		it('accepts a visible device', async () => {
			const errors = await validateWith(VISIBLE_DEVICE_ID);

			expect(errors.filter((error) => error.property === field)).toHaveLength(0);
		});

		// The half that catches a silently replaced decorator stack: had attaching the constraint above
		// dropped the field's other validators, a malformed value would sail straight through instead.
		it('still rejects a malformed uuid, so the field keeps its other validation', async () => {
			const errors = await validateWith('not-a-uuid');

			expect(errors.some((error) => error.property === field && !!error.constraints?.isUuid)).toBe(true);
		});
	});

	// The optional halves stay optional: an update DTO that does not mention the device at all must not
	// start failing, and must not cost a database read either.
	describe.each(cases.filter((testCase) => testCase.name.startsWith('Update')))('$name', ({ dto, field, rest }) => {
		it('still allows omitting the device entirely', async () => {
			const errors = await validate(toInstance(dto, rest));

			expect(errors.filter((error) => error.property === field)).toHaveLength(0);
			expect(devicesService.findOne).not.toHaveBeenCalled();
		});
	});
});
