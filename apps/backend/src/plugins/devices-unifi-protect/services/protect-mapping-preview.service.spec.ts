import { instanceToPlain } from 'class-transformer';
import { readFileSync } from 'fs';
import { join } from 'path';

import { ConfigService } from '../../../modules/config/services/config.service';
import { PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	DeviceValidationService,
	ValidationIssueSeverity,
	ValidationIssueType,
} from '../../../modules/devices/services/device-validation.service';
import { ProtectDeviceEntity } from '../entities/devices-unifi-protect.entity';
import { ProtectUnsupportedDeviceError } from '../errors/protect-adoption.error';
import { ProtectMappingLoaderService } from '../mappings/mapping-loader.service';
import { ProtectModelKey } from '../mappings/mapping.types';
import { ProtectPreviewWarningCode, ProtectPreviewWarningSeverity } from '../models/protect-mapping-preview.model';

import { ProtectInventoryService } from './protect-inventory.service';
import { ProtectMappingPreviewService } from './protect-mapping-preview.service';

type Raw = Record<string, unknown>;

const FIXTURES = join(__dirname, '..', '__fixtures__');
const fixture = (name: string): Raw[] => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as Raw[];
const expected = (name: string): { channels: unknown[] } =>
	JSON.parse(readFileSync(join(FIXTURES, 'expected', `${name}.json`), 'utf8')) as { channels: unknown[] };

const IDENTITY = { nvrId: '68b3ace392bf98c9fb76f70c', nvrMacKey: '0cea14003a69' };
const NONE = { high: null, medium: null, low: null, package: null };

describe('ProtectMappingPreviewService', () => {
	let client: { getRtspsStreams: jest.Mock };
	let inventory: { fetchDevice: jest.Mock; getAdoptedByIdentifier: jest.Mock };
	let validation: { validateDeviceStructure: jest.Mock };
	let adopted: Map<string, ProtectDeviceEntity>;
	let loader: ProtectMappingLoaderService;
	let service: ProtectMappingPreviewService;

	const serve = (raw: Raw, modelKey: ProtectModelKey): void => {
		inventory.fetchDevice.mockResolvedValue({
			client,
			identity: IDENTITY,
			entry: { modelKey, id: raw.id as string, raw },
		});
	};

	const build = (): void => {
		service = new ProtectMappingPreviewService(
			inventory as unknown as ProtectInventoryService,
			loader,
			validation as unknown as DeviceValidationService,
			{ getPluginConfig: () => ({ defaultStreamQuality: 'medium' }) } as unknown as ConfigService,
		);
	};

	beforeEach(() => {
		client = { getRtspsStreams: jest.fn(() => Promise.resolve({ ...NONE, high: 'rtsps://h/SENTINELALIAS1' })) };
		adopted = new Map();
		inventory = { fetchDevice: jest.fn(), getAdoptedByIdentifier: jest.fn(() => Promise.resolve(adopted)) };
		validation = new (class {
			validateDeviceStructure = jest.fn(() => ({ isValid: true, issues: [] }));
		})();
		loader = new ProtectMappingLoaderService();
		loader.onModuleInit();
		build();
	});

	it('previews the captured camera without warnings, with the golden channels', async () => {
		serve(fixture('cameras.json')[0], 'camera');

		const preview = await service.preview('600cefafd5f365d6f83c4ef3', 'camera');
		const plain = instanceToPlain(preview) as Raw;

		expect(preview.channels.map((channel) => channel.identifier)).toEqual(
			expected('camera').channels.map((channel) => (channel as { identifier: string }).identifier),
		);
		expect(preview.warnings).toEqual([]);
		expect(plain.stream).toEqual({ enabled_qualities: ['high'], default_quality: 'medium', package_camera: false });
		expect(preview).toMatchObject({
			identifier: '0cea14003a69:600cefafd5f365d6f83c4ef3',
			category: 'camera',
			readyToAdopt: true,
			adopted: false,
			adoptedDeviceId: null,
			device: { id: '600cefafd5f365d6f83c4ef3', modelKey: 'camera', name: 'Front door', state: 'CONNECTED' },
		});
		expect(plain.ready_to_adopt).toBe(true);
	});

	it('matches the golden channel properties for the camera', async () => {
		serve(fixture('cameras.json')[0], 'camera');

		const preview = await service.prepare('600cefafd5f365d6f83c4ef3', 'camera');

		expect(JSON.parse(JSON.stringify(preview.device.channels))).toEqual(expected('camera').channels);
	});

	it('flags stream_not_enabled for a doorbell without streams and for its package camera', async () => {
		client.getRtspsStreams.mockResolvedValue(NONE);
		serve(fixture('cameras-doorbell.json')[1], 'camera');

		const preview = await service.preview('5f0000000000000000000a02', 'camera');

		expect(preview.warnings).toEqual([
			expect.objectContaining({
				code: 'stream_not_enabled',
				severity: 'warning',
				identifier: 'camera.main',
			}),
			expect.objectContaining({ code: 'stream_not_enabled', identifier: 'camera.package' }),
		]);
		expect(preview.stream).toMatchObject({ enabledQualities: [], packageCamera: true });
	});

	it.each([
		[{ videoCodec: 'H265' }, 'hevc_codec', 'warning'],
		[{ videoCodec: 'hevc' }, 'hevc_codec', 'warning'],
		[{ isThirdPartyCamera: true }, 'third_party_camera', 'info'],
		[{ state: 'DISCONNECTED' }, 'device_disconnected', 'warning'],
	])('flags %j as %s', async (override, code, severity) => {
		serve({ ...fixture('cameras.json')[0], ...override }, 'camera');

		const preview = await service.preview('600cefafd5f365d6f83c4ef3', 'camera');

		expect(preview.warnings).toEqual([expect.objectContaining({ code, severity, identifier: null })]);
	});

	it('does not flag h264', async () => {
		serve({ ...fixture('cameras.json')[0], videoCodec: 'h264' }, 'camera');

		expect((await service.preview('600cefafd5f365d6f83c4ef3', 'camera')).warnings).toEqual([]);
	});

	it('reports stream_state_unknown and still previews when the stream read fails', async () => {
		client.getRtspsStreams.mockRejectedValue(new Error('boom'));
		serve(fixture('cameras.json')[0], 'camera');

		const preview = await service.preview('600cefafd5f365d6f83c4ef3', 'camera');

		expect(preview.warnings).toEqual([
			expect.objectContaining({ code: 'stream_state_unknown', severity: 'warning', identifier: null }),
		]);
		expect(preview.stream).toMatchObject({ enabledQualities: null });
		expect(preview.channels.length).toBeGreaterThan(0);
		expect(preview.readyToAdopt).toBe(true);
	});

	it('never reads streams for sensors and floodlights', async () => {
		serve(fixture('sensors.json')[0], 'sensor');
		expect((await service.preview('5f0000000000000000000b01', 'sensor')).stream).toBeNull();

		serve(fixture('lights.json')[0], 'light');
		expect((await service.preview('5f0000000000000000000c01', 'light')).stream).toBeNull();

		expect(client.getRtspsStreams).not.toHaveBeenCalled();
	});

	it('keeps stream URLs out of the preview', async () => {
		client.getRtspsStreams.mockResolvedValue({
			high: 'rtsps://h/SENTINELALIAS1',
			medium: 'rtsps://h/SENTINELALIAS2',
			low: null,
			package: 'rtsps://h/SENTINELALIAS3',
		});
		serve(fixture('cameras-doorbell.json')[1], 'camera');

		const json = JSON.stringify(await service.preview('5f0000000000000000000a02', 'camera'));

		expect(json).not.toContain('rtsps');
		expect(json).not.toContain('SENTINELALIAS');
	});

	it('marks a device adopted when its identifier exists', async () => {
		adopted.set('0cea14003a69:600cefafd5f365d6f83c4ef3', { id: 'sp-device-1' } as ProtectDeviceEntity);
		serve(fixture('cameras.json')[0], 'camera');

		const preview = await service.preview('600cefafd5f365d6f83c4ef3', 'camera');

		expect(preview).toMatchObject({ adopted: true, adoptedDeviceId: 'sp-device-1' });
	});

	it('marks the preview not ready when spec validation reports an error', async () => {
		validation.validateDeviceStructure.mockReturnValue({
			isValid: false,
			issues: [
				{
					type: ValidationIssueType.MISSING_PROPERTY,
					severity: ValidationIssueSeverity.ERROR,
					channelCategory: 'camera',
					message: 'missing',
				},
				{
					type: ValidationIssueType.MISSING_PROPERTY,
					severity: ValidationIssueSeverity.WARNING,
					message: 'no channel',
				},
			],
		});
		serve(fixture('cameras.json')[0], 'camera');

		const preview = await service.preview('600cefafd5f365d6f83c4ef3', 'camera');

		expect(preview.readyToAdopt).toBe(false);
		expect(preview.warnings).toEqual([
			{ code: ProtectPreviewWarningCode.SPEC_VALIDATION_FAILED, severity: 'error', identifier: 'camera' },
			{ code: ProtectPreviewWarningCode.SPEC_VALIDATION_FAILED, severity: 'warning', identifier: null },
		]);
		expect(preview.warnings[0].severity).toBe(ProtectPreviewWarningSeverity.ERROR);
	});

	it('reports an unsupported detection type as info', async () => {
		serve(
			{
				...fixture('cameras.json')[0],
				featureFlags: {
					...((fixture('cameras.json')[0].featureFlags as Raw) ?? {}),
					smartDetectTypes: ['person', 'mystery'],
				},
				smartDetectSettings: { objectTypes: ['person', 'mystery'], audioTypes: [] },
			},
			'camera',
		);

		const preview = await service.preview('600cefafd5f365d6f83c4ef3', 'camera');

		expect(preview.warnings).toEqual([
			expect.objectContaining({ code: 'unsupported_detection_type', severity: 'info', identifier: 'mystery' }),
		]);
	});

	it('throws ProtectUnsupportedDeviceError when no device mapping matches', async () => {
		const all = loader.getMappings();

		loader = {
			getMappings: () => ({ ...all, devices: all.devices.filter((mapping) => mapping.modelKey !== 'light') }),
		} as unknown as ProtectMappingLoaderService;
		build();
		serve(fixture('lights.json')[0], 'light');

		await expect(service.prepare('5f0000000000000000000c01', 'light')).rejects.toBeInstanceOf(
			ProtectUnsupportedDeviceError,
		);
	});

	it('re-evaluates the stream status values with toStatusValue', async () => {
		serve(fixture('cameras.json')[0], 'camera');

		const prepared = await service.prepare('600cefafd5f365d6f83c4ef3', 'camera');
		const statusOf = (device: typeof prepared.device): unknown =>
			device.channels
				.find((channel) => channel.identifier === 'camera.main')
				?.properties.find((property) => property.category === PropertyCategory.STATUS)?.value;
		const none = { high: false, medium: false, low: false, package: false };

		expect(statusOf(prepared.device)).toBe(statusOf(service.toStatusValue(prepared, { ...none, high: true })));
		expect(statusOf(service.toStatusValue(prepared, none))).not.toBe(
			statusOf(service.toStatusValue(prepared, { ...none, high: true })),
		);
	});
});
