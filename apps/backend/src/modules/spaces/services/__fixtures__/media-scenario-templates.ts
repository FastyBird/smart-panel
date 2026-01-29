/**
 * Media Scenario Templates – deterministic device topologies for regression testing.
 *
 * Each template returns a stable set of capability summaries and their expected
 * derived endpoints.  All IDs are fixed strings so assertions are deterministic.
 *
 * To add a new scenario:
 *   1. Define a new `MediaScenario` constant following the pattern below.
 *   2. Export it from this file.
 *   3. Import it in the regression spec.
 */
import { DeviceCategory } from '../../../devices/devices.constants';
import { MediaCapabilityPermission, MediaEndpointType } from '../../spaces.constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapLink {
	propertyId: string;
	channelId: string;
	permission: MediaCapabilityPermission;
}

export interface ScenarioDevice {
	deviceId: string;
	deviceName: string;
	deviceCategory: string;
	isOnline: boolean;
	suggestedEndpointTypes: MediaEndpointType[];
	power?: CapLink;
	volume?: CapLink;
	mute?: CapLink;
	playback?: CapLink;
	playbackState?: CapLink;
	input?: CapLink;
	remote?: CapLink;
	trackMetadata?: CapLink;
}

export interface MediaScenario {
	name: string;
	description: string;
	spaceId: string;
	devices: ScenarioDevice[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _counter = 0;

function stableId(prefix: string): string {
	_counter++;
	return `${prefix}-${String(_counter).padStart(4, '0')}`;
}

function cap(prefix: string): CapLink {
	return {
		propertyId: stableId(`${prefix}-prop`),
		channelId: stableId(`${prefix}-ch`),
		permission: MediaCapabilityPermission.READ_WRITE,
	};
}

/** Reset counter – call in beforeAll / beforeEach so IDs stay deterministic across runs. */
export function resetIds(): void {
	_counter = 0;
}

// ---------------------------------------------------------------------------
// Stable IDs shared across templates
// ---------------------------------------------------------------------------

export const SPACE_ID = '00000000-0000-4000-a000-000000000001';

// Device IDs (stable across runs)
export const DEVICE_TV = '00000000-0000-4000-b000-000000000001';
export const DEVICE_AVR = '00000000-0000-4000-b000-000000000002';
export const DEVICE_SPEAKER = '00000000-0000-4000-b000-000000000003';
export const DEVICE_STREAMER = '00000000-0000-4000-b000-000000000004';
export const DEVICE_CONSOLE = '00000000-0000-4000-b000-000000000005';
export const DEVICE_PROJECTOR = '00000000-0000-4000-b000-000000000006';
export const DEVICE_SPEAKER_2 = '00000000-0000-4000-b000-000000000007';

// ---------------------------------------------------------------------------
// 1) media_tv_only
// ---------------------------------------------------------------------------
export function mediaTvOnly(opts: { tvVolume?: boolean } = {}): MediaScenario {
	resetIds();
	const tvCaps: Partial<ScenarioDevice> = {
		power: cap('tv-power'),
		input: cap('tv-input'),
		remote: cap('tv-remote'),
	};

	if (opts.tvVolume) {
		tvCaps.volume = cap('tv-volume');
	}

	return {
		name: 'media_tv_only',
		description: '1x TV: power, inputSelect, remote commands. Optional TV volume.',
		spaceId: SPACE_ID,
		devices: [
			{
				deviceId: DEVICE_TV,
				deviceName: 'Living Room TV',
				deviceCategory: DeviceCategory.TELEVISION,
				isOnline: true,
				suggestedEndpointTypes: [],
				...tvCaps,
			},
		],
	};
}

// ---------------------------------------------------------------------------
// 2) media_speaker_only
// ---------------------------------------------------------------------------
export function mediaSpeakerOnly(opts: { mute?: boolean } = {}): MediaScenario {
	resetIds();
	const spkCaps: Partial<ScenarioDevice> = {
		power: cap('spk-power'),
		volume: cap('spk-volume'),
		playback: cap('spk-playback'),
		trackMetadata: cap('spk-track'),
	};

	if (opts.mute !== false) {
		spkCaps.mute = cap('spk-mute');
	}

	return {
		name: 'media_speaker_only',
		description: '1x Speaker: volume, playback, track metadata. Optional mute.',
		spaceId: SPACE_ID,
		devices: [
			{
				deviceId: DEVICE_SPEAKER,
				deviceName: 'Sonos Speaker',
				deviceCategory: DeviceCategory.SPEAKER,
				isOnline: true,
				suggestedEndpointTypes: [],
				...spkCaps,
			},
		],
	};
}

// ---------------------------------------------------------------------------
// 3) media_tv_avr_console_streamer  ("the Media Rig")
// ---------------------------------------------------------------------------
export function mediaTvAvrConsoleStreamer(opts: { backgroundSpeaker?: boolean } = {}): MediaScenario {
	resetIds();
	const devices: ScenarioDevice[] = [
		// TV – display + remote + inputSelect
		{
			deviceId: DEVICE_TV,
			deviceName: 'Samsung TV',
			deviceCategory: DeviceCategory.TELEVISION,
			isOnline: true,
			suggestedEndpointTypes: [],
			power: cap('tv-power'),
			input: cap('tv-input'),
			remote: cap('tv-remote'),
		},
		// AV Receiver – audio_output + volume + inputSelect + power
		{
			deviceId: DEVICE_AVR,
			deviceName: 'Denon AVR',
			deviceCategory: DeviceCategory.AV_RECEIVER,
			isOnline: true,
			suggestedEndpointTypes: [],
			power: cap('avr-power'),
			volume: cap('avr-volume'),
			mute: cap('avr-mute'),
			input: cap('avr-input'),
		},
		// Streamer – source + playback + track + remote
		{
			deviceId: DEVICE_STREAMER,
			deviceName: 'Apple TV',
			deviceCategory: DeviceCategory.STREAMING_SERVICE,
			isOnline: true,
			suggestedEndpointTypes: [],
			power: cap('str-power'),
			playback: cap('str-playback'),
			trackMetadata: cap('str-track'),
			remote: cap('str-remote'),
		},
		// Console – source-like (power only at minimum, identified for binding)
		{
			deviceId: DEVICE_CONSOLE,
			deviceName: 'PlayStation 5',
			deviceCategory: DeviceCategory.GAME_CONSOLE,
			isOnline: true,
			suggestedEndpointTypes: [],
			power: cap('con-power'),
		},
	];

	if (opts.backgroundSpeaker) {
		devices.push({
			deviceId: DEVICE_SPEAKER,
			deviceName: 'Background Speaker',
			deviceCategory: DeviceCategory.SPEAKER,
			isOnline: true,
			suggestedEndpointTypes: [],
			power: cap('bg-power'),
			volume: cap('bg-volume'),
			playback: cap('bg-playback'),
			trackMetadata: cap('bg-track'),
		});
	}

	return {
		name: 'media_tv_avr_console_streamer',
		description: 'TV + AV Receiver + Streamer + Console. Optional background speaker.',
		spaceId: SPACE_ID,
		devices,
	};
}

// ---------------------------------------------------------------------------
// 4) media_multi_output  (edge case)
// ---------------------------------------------------------------------------
export function mediaMultiOutput(): MediaScenario {
	resetIds();
	return {
		name: 'media_multi_output',
		description: '2x Displays (TV + Projector) + 2x Audio outputs (AVR + Speaker). Tests default selection stability.',
		spaceId: SPACE_ID,
		devices: [
			// TV
			{
				deviceId: DEVICE_TV,
				deviceName: 'Living Room TV',
				deviceCategory: DeviceCategory.TELEVISION,
				isOnline: true,
				suggestedEndpointTypes: [],
				power: cap('tv-power'),
				input: cap('tv-input'),
				remote: cap('tv-remote'),
			},
			// Projector
			{
				deviceId: DEVICE_PROJECTOR,
				deviceName: 'Epson Projector',
				deviceCategory: DeviceCategory.PROJECTOR,
				isOnline: true,
				suggestedEndpointTypes: [],
				power: cap('proj-power'),
				input: cap('proj-input'),
			},
			// AVR
			{
				deviceId: DEVICE_AVR,
				deviceName: 'Denon AVR',
				deviceCategory: DeviceCategory.AV_RECEIVER,
				isOnline: true,
				suggestedEndpointTypes: [],
				power: cap('avr-power'),
				volume: cap('avr-volume'),
				mute: cap('avr-mute'),
				input: cap('avr-input'),
			},
			// Speaker
			{
				deviceId: DEVICE_SPEAKER,
				deviceName: 'Sonos Speaker',
				deviceCategory: DeviceCategory.SPEAKER,
				isOnline: true,
				suggestedEndpointTypes: [],
				power: cap('spk-power'),
				volume: cap('spk-volume'),
				playback: cap('spk-playback'),
				trackMetadata: cap('spk-track'),
			},
		],
	};
}
