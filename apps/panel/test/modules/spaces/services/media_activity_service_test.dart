import 'package:fastybird_smart_panel/modules/spaces/models/media_activity/media_activity.dart';
import 'package:fastybird_smart_panel/modules/spaces/services/media_activity_service.dart';
import 'package:flutter_test/flutter_test.dart';

/// A minimal fake repository that exposes data manipulation for testing.
/// We can't easily test the real one without mock HTTP, so we test the
/// service and model logic directly.
void main() {
	const spaceId = 'space-1';

	group('MediaActiveStateModel', () {
		test('parses from JSON correctly', () {
			final json = {
				'id': 'active-1',
				'space_id': spaceId,
				'activity_key': 'watch',
				'state': 'active',
				'activated_at': '2025-01-15T10:00:00Z',
				'resolved': {
					'display_device_id': 'dev-1',
					'audio_device_id': 'dev-2',
				},
				'warnings': ['Partial failure on source'],
			};

			final state = MediaActiveStateModel.fromJson(json, spaceId: spaceId);

			expect(state.activityKey, MediaActivityKey.watch);
			expect(state.state, MediaActivationState.active);
			expect(state.isActive, true);
			expect(state.isActivating, false);
			expect(state.isFailed, false);
			expect(state.isDeactivated, false);
			expect(state.resolved?.displayDeviceId, 'dev-1');
			expect(state.resolved?.audioDeviceId, 'dev-2');
			expect(state.hasWarnings, true);
			expect(state.warnings.first, 'Partial failure on source');
		});

		test('handles activating state', () {
			final json = {
				'space_id': spaceId,
				'activity_key': 'gaming',
				'state': 'activating',
			};

			final state = MediaActiveStateModel.fromJson(json, spaceId: spaceId);
			expect(state.isActivating, true);
			expect(state.isActive, false);
			expect(state.activityKey, MediaActivityKey.gaming);
		});

		test('handles failed state with last_result', () {
			final json = {
				'space_id': spaceId,
				'activity_key': 'listen',
				'state': 'failed',
				'last_result': {
					'success_count': 1,
					'failure_count': 2,
					'failures': ['TV power on failed', 'Audio switch failed'],
				},
			};

			final state = MediaActiveStateModel.fromJson(json, spaceId: spaceId);
			expect(state.isFailed, true);
			expect(state.hasFailures, true);
			expect(state.lastResult!.failureCount, 2);
			expect(state.lastResult!.failures.length, 2);
		});

		test('empty factory creates deactivated state', () {
			final state = MediaActiveStateModel.empty(spaceId);
			expect(state.isDeactivated, true);
			expect(state.activityKey, isNull);
			expect(state.spaceId, spaceId);
		});

		test('handles null activity key for deactivated', () {
			final json = {
				'space_id': spaceId,
				'state': 'deactivated',
			};
			final state = MediaActiveStateModel.fromJson(json, spaceId: spaceId);
			expect(state.isDeactivated, true);
			expect(state.activityKey, isNull);
		});
	});

	group('MediaEndpointModel', () {
		test('parses from JSON correctly', () {
			final json = {
				'endpoint_id': '$spaceId:display:dev-1',
				'space_id': spaceId,
				'device_id': 'dev-1',
				'type': 'display',
				'name': 'LG OLED',
				'capabilities': {
					'power': true,
					'volume': true,
					'input': true,
					'mute': false,
					'playback': false,
					'playback_state': false,
					'remote': false,
					'track_metadata': false,
				},
				'links': {
					'power_property_id': 'prop-1',
					'volume_property_id': 'prop-2',
				},
			};

			final endpoint = MediaEndpointModel.fromJson(json);

			expect(endpoint.deviceId, 'dev-1');
			expect(endpoint.type, MediaEndpointType.display);
			expect(endpoint.name, 'LG OLED');
			expect(endpoint.capabilities.power, true);
			expect(endpoint.capabilities.volume, true);
			expect(endpoint.capabilities.input, true);
			expect(endpoint.capabilities.mute, false);
			expect(endpoint.links.powerPropertyId, 'prop-1');
			expect(endpoint.links.volumePropertyId, 'prop-2');
		});

		test('handles missing capabilities and links', () {
			final json = {
				'endpoint_id': 'ep-1',
				'space_id': spaceId,
				'device_id': 'dev-1',
				'type': 'audio_output',
				'name': 'Speaker',
			};

			final endpoint = MediaEndpointModel.fromJson(json);
			expect(endpoint.type, MediaEndpointType.audioOutput);
			expect(endpoint.capabilities.power, false);
			expect(endpoint.capabilities.volume, false);
		});
	});

	group('MediaActivityBindingModel', () {
		test('parses from JSON correctly', () {
			final json = {
				'id': 'binding-1',
				'space_id': spaceId,
				'activity_key': 'watch',
				'display_endpoint_id': 'ep-1',
				'audio_endpoint_id': 'ep-2',
				'source_endpoint_id': null,
				'remote_endpoint_id': null,
				'display_input_id': 'HDMI1',
				'audio_input_id': 'OPTICAL',
				'source_input_id': null,
				'audio_volume_preset': 30,
			};

			final binding = MediaActivityBindingModel.fromJson(json);

			expect(binding.activityKey, MediaActivityKey.watch);
			expect(binding.displayEndpointId, 'ep-1');
			expect(binding.audioEndpointId, 'ep-2');
			expect(binding.sourceEndpointId, isNull);
			expect(binding.remoteEndpointId, isNull);
			expect(binding.displayInputId, 'HDMI1');
			expect(binding.audioInputId, 'OPTICAL');
			expect(binding.sourceInputId, isNull);
			expect(binding.audioVolumePreset, 30);
		});
	});

	group('MediaActivationResultModel', () {
		test('parses activation result', () {
			final json = {
				'activity_key': 'watch',
				'state': 'active',
				'resolved': {
					'display_device_id': 'dev-1',
					'audio_device_id': 'dev-2',
				},
				'summary': {
					'success_count': 3,
					'failure_count': 0,
					'failures': [],
				},
				'warnings': [],
			};

			final result = MediaActivationResultModel.fromJson(json);

			expect(result.activityKey, MediaActivityKey.watch);
			expect(result.state, MediaActivationState.active);
			expect(result.resolved?.displayDeviceId, 'dev-1');
			expect(result.summary?.successCount, 3);
			expect(result.summary?.failureCount, 0);
		});
	});

	group('Enum parsing', () {
		test('mediaActivityKeyFromString', () {
			expect(mediaActivityKeyFromString('watch'), MediaActivityKey.watch);
			expect(mediaActivityKeyFromString('listen'), MediaActivityKey.listen);
			expect(mediaActivityKeyFromString('gaming'), MediaActivityKey.gaming);
			expect(mediaActivityKeyFromString('background'), MediaActivityKey.background);
			expect(mediaActivityKeyFromString('off'), MediaActivityKey.off);
			expect(mediaActivityKeyFromString('invalid'), isNull);
			expect(mediaActivityKeyFromString(null), isNull);
		});

		test('mediaActivationStateFromString', () {
			expect(mediaActivationStateFromString('activating'), MediaActivationState.activating);
			expect(mediaActivationStateFromString('active'), MediaActivationState.active);
			expect(mediaActivationStateFromString('failed'), MediaActivationState.failed);
			expect(mediaActivationStateFromString('deactivated'), MediaActivationState.deactivated);
			expect(mediaActivationStateFromString('invalid'), isNull);
		});

		test('mediaEndpointTypeFromString', () {
			expect(mediaEndpointTypeFromString('display'), MediaEndpointType.display);
			expect(mediaEndpointTypeFromString('audio_output'), MediaEndpointType.audioOutput);
			expect(mediaEndpointTypeFromString('source'), MediaEndpointType.source);
			expect(mediaEndpointTypeFromString('remote_target'), MediaEndpointType.remoteTarget);
			expect(mediaEndpointTypeFromString('invalid'), isNull);
		});

		test('mediaActivityKeyToString', () {
			expect(mediaActivityKeyToString(MediaActivityKey.watch), 'watch');
			expect(mediaActivityKeyToString(MediaActivityKey.listen), 'listen');
			expect(mediaActivityKeyToString(MediaActivityKey.gaming), 'gaming');
			expect(mediaActivityKeyToString(MediaActivityKey.background), 'background');
			expect(mediaActivityKeyToString(MediaActivityKey.off), 'off');
		});
	});

	group('MediaDeviceGroup', () {
		test('detects endpoint types correctly', () {
			final group = MediaDeviceGroup(
				deviceId: 'dev-1',
				deviceName: 'Living Room TV',
				endpoints: [
					MediaEndpointModel(
						endpointId: 'ep-1',
						spaceId: spaceId,
						deviceId: 'dev-1',
						type: MediaEndpointType.display,
						name: 'Display',
						capabilities: const MediaCapabilitiesModel(power: true, input: true),
						links: const MediaLinksModel(),
					),
					MediaEndpointModel(
						endpointId: 'ep-2',
						spaceId: spaceId,
						deviceId: 'dev-1',
						type: MediaEndpointType.remoteTarget,
						name: 'Remote',
						capabilities: const MediaCapabilitiesModel(remote: true),
						links: const MediaLinksModel(),
					),
				],
			);

			expect(group.hasDisplay, true);
			expect(group.hasRemote, true);
			expect(group.hasAudio, false);
			expect(group.hasSource, false);
			expect(group.displayEndpoint, isNotNull);
			expect(group.remoteEndpoint, isNotNull);
			expect(group.audioEndpoint, isNull);
		});
	});

	group('ActiveControlTargets', () {
		test('empty targets report no capabilities', () {
			const targets = ActiveControlTargets();
			expect(targets.hasVolume, false);
			expect(targets.hasInput, false);
			expect(targets.hasPlayback, false);
			expect(targets.hasRemote, false);
			expect(targets.hasDisplay, false);
			expect(targets.hasPower, false);
			expect(targets.hasTrackMetadata, false);
		});

		test('reports capabilities from resolved targets', () {
			final display = MediaEndpointModel(
				endpointId: 'ep-1',
				spaceId: spaceId,
				deviceId: 'dev-1',
				type: MediaEndpointType.display,
				name: 'TV',
				capabilities: const MediaCapabilitiesModel(power: true, input: true),
				links: const MediaLinksModel(),
			);

			final audio = MediaEndpointModel(
				endpointId: 'ep-2',
				spaceId: spaceId,
				deviceId: 'dev-2',
				type: MediaEndpointType.audioOutput,
				name: 'Soundbar',
				capabilities: const MediaCapabilitiesModel(volume: true, trackMetadata: true),
				links: const MediaLinksModel(),
			);

			final targets = ActiveControlTargets(
				displayTarget: display,
				volumeTarget: audio,
				inputTarget: display,
				playbackTarget: audio,
			);

			expect(targets.hasVolume, true);
			expect(targets.hasInput, true);
			expect(targets.hasPlayback, true);
			expect(targets.hasDisplay, true);
			expect(targets.hasPower, true);
			expect(targets.hasTrackMetadata, true);
			expect(targets.hasRemote, false);
		});
	});
}
