// Media activity domain models for the V2 activity-based media architecture.

import 'dart:convert';

/// Activity keys matching backend MediaActivityKey enum.
enum MediaActivityKey {
	watch,
	listen,
	gaming,
	background,
	off,
}

/// Activation lifecycle states matching backend MediaActivationState enum.
enum MediaActivationState {
	activating,
	deactivating,
	active,
	failed,
	deactivated,
}

/// Endpoint type matching backend MediaEndpointType enum.
enum MediaEndpointType {
	display,
	audioOutput,
	source,
	remoteTarget,
}

/// Capability flags matching backend MediaCapability enum.
enum MediaCapability {
	power,
	volume,
	mute,
	playback,
	playbackState,
	input,
	remote,
	trackMetadata,
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

MediaActivityKey? mediaActivityKeyFromString(String? value) {
	if (value == null) return null;
	switch (value) {
		case 'watch':
			return MediaActivityKey.watch;
		case 'listen':
			return MediaActivityKey.listen;
		case 'gaming':
			return MediaActivityKey.gaming;
		case 'background':
			return MediaActivityKey.background;
		case 'off':
			return MediaActivityKey.off;
		default:
			return null;
	}
}

String mediaActivityKeyToString(MediaActivityKey key) {
	switch (key) {
		case MediaActivityKey.watch:
			return 'watch';
		case MediaActivityKey.listen:
			return 'listen';
		case MediaActivityKey.gaming:
			return 'gaming';
		case MediaActivityKey.background:
			return 'background';
		case MediaActivityKey.off:
			return 'off';
	}
}

MediaActivationState? mediaActivationStateFromString(String? value) {
	if (value == null) return null;
	switch (value) {
		case 'activating':
			return MediaActivationState.activating;
		case 'deactivating':
			return MediaActivationState.deactivating;
		case 'active':
			return MediaActivationState.active;
		case 'failed':
			return MediaActivationState.failed;
		case 'deactivated':
			return MediaActivationState.deactivated;
		default:
			return null;
	}
}

MediaEndpointType? mediaEndpointTypeFromString(String? value) {
	if (value == null) return null;
	switch (value) {
		case 'display':
			return MediaEndpointType.display;
		case 'audio_output':
			return MediaEndpointType.audioOutput;
		case 'source':
			return MediaEndpointType.source;
		case 'remote_target':
			return MediaEndpointType.remoteTarget;
		default:
			return null;
	}
}

MediaCapability? mediaCapabilityFromString(String? value) {
	if (value == null) return null;
	switch (value) {
		case 'power':
			return MediaCapability.power;
		case 'volume':
			return MediaCapability.volume;
		case 'mute':
			return MediaCapability.mute;
		case 'playback':
			return MediaCapability.playback;
		case 'playback_state':
			return MediaCapability.playbackState;
		case 'input':
			return MediaCapability.input;
		case 'remote':
			return MediaCapability.remote;
		case 'track_metadata':
			return MediaCapability.trackMetadata;
		default:
			return null;
	}
}

// ============================================================================
// DATA MODELS
// ============================================================================

/// Capabilities of a media endpoint.
class MediaCapabilitiesModel {
	final bool power;
	final bool volume;
	final bool mute;
	final bool playback;
	final bool playbackState;
	final bool input;
	final bool remote;
	final bool trackMetadata;

	const MediaCapabilitiesModel({
		this.power = false,
		this.volume = false,
		this.mute = false,
		this.playback = false,
		this.playbackState = false,
		this.input = false,
		this.remote = false,
		this.trackMetadata = false,
	});

	factory MediaCapabilitiesModel.fromJson(Map<String, dynamic> json) {
		return MediaCapabilitiesModel(
			power: json['power'] == true,
			volume: json['volume'] == true,
			mute: json['mute'] == true,
			playback: json['playback'] == true,
			playbackState: json['playback_state'] == true,
			input: json['input'] == true,
			remote: json['remote'] == true,
			trackMetadata: json['track_metadata'] == true,
		);
	}
}

/// Links from capabilities to concrete property/command IDs.
class MediaLinksModel {
	final Map<String, dynamic> raw;

	const MediaLinksModel({this.raw = const {}});

	factory MediaLinksModel.fromJson(Map<String, dynamic> json) {
		return MediaLinksModel(raw: json);
	}

	String? get powerPropertyId => raw['power_property_id'] as String?;
	String? get volumePropertyId => raw['volume_property_id'] as String?;
	String? get mutePropertyId => raw['mute_property_id'] as String?;
	String? get inputPropertyId => raw['input_property_id'] as String?;
	String? get playbackCommandId => raw['playback_command_id'] as String?;
}

/// A derived media endpoint for a space.
class MediaEndpointModel {
	final String endpointId;
	final String spaceId;
	final String deviceId;
	final MediaEndpointType type;
	final String name;
	final MediaCapabilitiesModel capabilities;
	final MediaLinksModel links;

	const MediaEndpointModel({
		required this.endpointId,
		required this.spaceId,
		required this.deviceId,
		required this.type,
		required this.name,
		required this.capabilities,
		required this.links,
	});

	factory MediaEndpointModel.fromJson(Map<String, dynamic> json) {
		return MediaEndpointModel(
			endpointId: json['endpoint_id'] as String,
			spaceId: json['space_id'] as String,
			deviceId: json['device_id'] as String,
			type: mediaEndpointTypeFromString(json['type'] as String?) ?? MediaEndpointType.display,
			name: json['name'] as String? ?? 'Unknown',
			capabilities: json['capabilities'] != null
					? MediaCapabilitiesModel.fromJson(json['capabilities'] as Map<String, dynamic>)
					: const MediaCapabilitiesModel(),
			links: json['links'] != null
					? MediaLinksModel.fromJson(json['links'] as Map<String, dynamic>)
					: const MediaLinksModel(),
		);
	}
}

/// A media activity binding (activity → endpoint assignment).
class MediaActivityBindingModel {
	final String id;
	final String spaceId;
	final MediaActivityKey activityKey;
	final String? displayEndpointId;
	final String? audioEndpointId;
	final String? sourceEndpointId;
	final String? remoteEndpointId;
	final String? displayInputId;
	final int? audioVolumePreset;

	const MediaActivityBindingModel({
		required this.id,
		required this.spaceId,
		required this.activityKey,
		this.displayEndpointId,
		this.audioEndpointId,
		this.sourceEndpointId,
		this.remoteEndpointId,
		this.displayInputId,
		this.audioVolumePreset,
	});

	factory MediaActivityBindingModel.fromJson(Map<String, dynamic> json) {
		return MediaActivityBindingModel(
			id: json['id'] as String,
			spaceId: json['space_id'] as String,
			activityKey: mediaActivityKeyFromString(json['activity_key'] as String?) ?? MediaActivityKey.off,
			displayEndpointId: json['display_endpoint_id'] as String?,
			audioEndpointId: json['audio_endpoint_id'] as String?,
			sourceEndpointId: json['source_endpoint_id'] as String?,
			remoteEndpointId: json['remote_endpoint_id'] as String?,
			displayInputId: json['display_input_id'] as String?,
			audioVolumePreset: json['audio_volume_preset'] as int?,
		);
	}
}

/// Resolved device IDs from an activation.
class MediaActivityResolvedModel {
	final String? displayDeviceId;
	final String? audioDeviceId;
	final String? sourceDeviceId;
	final String? remoteDeviceId;

	const MediaActivityResolvedModel({
		this.displayDeviceId,
		this.audioDeviceId,
		this.sourceDeviceId,
		this.remoteDeviceId,
	});

	factory MediaActivityResolvedModel.fromJson(Map<String, dynamic> json) {
		return MediaActivityResolvedModel(
			displayDeviceId: json['display_device_id'] as String?,
			audioDeviceId: json['audio_device_id'] as String?,
			sourceDeviceId: json['source_device_id'] as String?,
			remoteDeviceId: json['remote_device_id'] as String?,
		);
	}
}

/// Summary of the last activation result (successes/failures).
class MediaActivityLastResultModel {
	final int successCount;
	final int failureCount;
	final List<String> failures;

	const MediaActivityLastResultModel({
		this.successCount = 0,
		this.failureCount = 0,
		this.failures = const [],
	});

	factory MediaActivityLastResultModel.fromJson(Map<String, dynamic> json) {
		return MediaActivityLastResultModel(
			successCount: json['success_count'] as int? ?? 0,
			failureCount: json['failure_count'] as int? ?? 0,
			failures: (json['failures'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
		);
	}
}

/// The active media activity state for a space.
class MediaActiveStateModel {
	final String? id;
	final String spaceId;
	final MediaActivityKey? activityKey;
	final MediaActivationState state;
	final DateTime? activatedAt;
	final MediaActivityResolvedModel? resolved;
	final MediaActivityLastResultModel? lastResult;
	final List<String> warnings;

	const MediaActiveStateModel({
		this.id,
		required this.spaceId,
		this.activityKey,
		required this.state,
		this.activatedAt,
		this.resolved,
		this.lastResult,
		this.warnings = const [],
	});

	bool get isActive => state == MediaActivationState.active;
	bool get isActivating => state == MediaActivationState.activating;
	bool get isDeactivating => state == MediaActivationState.deactivating;
	bool get isFailed => state == MediaActivationState.failed;
	bool get isDeactivated => state == MediaActivationState.deactivated;
	bool get hasWarnings => warnings.isNotEmpty;
	bool get hasFailures => lastResult != null && lastResult!.failureCount > 0;

	factory MediaActiveStateModel.fromJson(Map<String, dynamic> json, {required String spaceId}) {
		// Parse resolved - could be a JSON string or a map
		MediaActivityResolvedModel? resolved;
		final resolvedRaw = json['resolved'];
		if (resolvedRaw is Map<String, dynamic>) {
			resolved = MediaActivityResolvedModel.fromJson(resolvedRaw);
		} else if (resolvedRaw is String && resolvedRaw.isNotEmpty) {
			try {
				final decoded = jsonDecode(resolvedRaw);
				if (decoded is Map<String, dynamic>) {
					resolved = MediaActivityResolvedModel.fromJson(decoded);
				}
			} catch (_) {
				resolved = null;
			}
		}

		// Parse last_result - could be a JSON string or a map
		MediaActivityLastResultModel? lastResult;
		final lastResultRaw = json['last_result'];
		if (lastResultRaw is Map<String, dynamic>) {
			lastResult = MediaActivityLastResultModel.fromJson(lastResultRaw);
		}

		return MediaActiveStateModel(
			id: json['id'] as String?,
			spaceId: spaceId,
			activityKey: mediaActivityKeyFromString(json['activity_key'] as String?),
			state: mediaActivationStateFromString(json['state'] as String?) ?? MediaActivationState.deactivated,
			activatedAt: json['activated_at'] != null ? DateTime.tryParse(json['activated_at'] as String) : null,
			resolved: resolved,
			lastResult: lastResult,
			warnings: (json['warnings'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
		);
	}

	/// Create a deactivated/empty state.
	factory MediaActiveStateModel.empty(String spaceId) {
		return MediaActiveStateModel(
			spaceId: spaceId,
			state: MediaActivationState.deactivated,
		);
	}
}

/// Result of an activate/deactivate API call.
class MediaActivationResultModel {
	final MediaActivityKey? activityKey;
	final MediaActivationState state;
	final MediaActivityResolvedModel? resolved;
	final MediaActivityLastResultModel? summary;
	final List<String> warnings;

	const MediaActivationResultModel({
		this.activityKey,
		required this.state,
		this.resolved,
		this.summary,
		this.warnings = const [],
	});

	factory MediaActivationResultModel.fromJson(Map<String, dynamic> json) {
		return MediaActivationResultModel(
			activityKey: mediaActivityKeyFromString(json['activity_key'] as String?),
			state: mediaActivationStateFromString(json['state'] as String?) ?? MediaActivationState.failed,
			resolved: json['resolved'] != null
					? MediaActivityResolvedModel.fromJson(json['resolved'] as Map<String, dynamic>)
					: null,
			summary: json['summary'] != null
					? MediaActivityLastResultModel.fromJson(json['summary'] as Map<String, dynamic>)
					: null,
			warnings: (json['warnings'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
		);
	}
}
