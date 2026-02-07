// Media activity domain models for the activity-based media architecture.

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
// STEP PROGRESS MODELS
// ============================================================================

/// Status of a single activation step for real-time progress tracking.
enum MediaStepStatus {
	pending,
	executing,
	succeeded,
	failed,
}

MediaStepStatus mediaStepStatusFromString(String? value) {
	switch (value) {
		case 'executing':
			return MediaStepStatus.executing;
		case 'succeeded':
			return MediaStepStatus.succeeded;
		case 'failed':
			return MediaStepStatus.failed;
		default:
			return MediaStepStatus.pending;
	}
}

/// A single step in the activation plan, used for real-time progress display.
class MediaActivationPlanStepModel {
	final int index;
	final String label;
	final bool critical;
	final MediaStepStatus status;

	const MediaActivationPlanStepModel({
		required this.index,
		required this.label,
		this.critical = false,
		this.status = MediaStepStatus.pending,
	});

	factory MediaActivationPlanStepModel.fromJson(Map<String, dynamic> json) {
		return MediaActivationPlanStepModel(
			index: json['index'] as int? ?? 0,
			label: json['label'] as String? ?? 'Step',
			critical: json['critical'] as bool? ?? false,
		);
	}

	MediaActivationPlanStepModel copyWith({MediaStepStatus? status}) {
		return MediaActivationPlanStepModel(
			index: index,
			label: label,
			critical: critical,
			status: status ?? this.status,
		);
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
			input: json['input_select'] == true || json['input'] == true,
			remote: json['remote_commands'] == true || json['remote'] == true,
			trackMetadata: json['track'] == true || json['track_metadata'] == true,
		);
	}
}

/// Links from capabilities to concrete property/command IDs.
///
/// Backend returns nested structure: `{ "volume": { "property_id": "uuid" } }`
class MediaLinksModel {
	final Map<String, dynamic> raw;

	const MediaLinksModel({this.raw = const {}});

	factory MediaLinksModel.fromJson(Map<String, dynamic> json) {
		return MediaLinksModel(raw: json);
	}

	String? _extractPropertyId(String key) {
		final value = raw[key];
		if (value is Map<String, dynamic>) {
			return value['property_id'] as String?;
		}
		// Fallback: flat key format (e.g. 'volume_property_id')
		return raw['${key}_property_id'] as String?;
	}

	String? get powerPropertyId => _extractPropertyId('power');
	String? get volumePropertyId => _extractPropertyId('volume');
	String? get mutePropertyId => _extractPropertyId('mute');
	String? get inputPropertyId =>
			_extractPropertyId('input_select') ?? _extractPropertyId('inputSelect') ?? _extractPropertyId('input');
	String? get playbackCommandId => _extractPropertyId('playback');
	String? get playbackStatePropertyId =>
			_extractPropertyId('playback_state') ?? _extractPropertyId('playbackState');
	String? get trackMetadataPropertyId =>
			_extractPropertyId('track_metadata') ?? _extractPropertyId('trackMetadata');
	String? get albumPropertyId => _extractPropertyId('album');
	String? get artistPropertyId => _extractPropertyId('artist');
	String? get positionPropertyId => _extractPropertyId('position');
	String? get durationPropertyId => _extractPropertyId('duration');
	/// Remote command property ID.
	///
	/// The backend structure is: `{ "remote": { "commands": { "remoteKey": "propertyId" } } }`
	/// where the single value is the property ID for sending remote key commands.
	String? get remotePropertyId {
		// Try standard extraction first
		final standard = _extractPropertyId('remote_commands') ?? _extractPropertyId('remoteCommands') ?? _extractPropertyId('remote');
		if (standard != null) return standard;

		// Extract from commands map: { "remote": { "commands": { "remoteKey": "propId" } } }
		final remote = raw['remote'];
		if (remote is Map<String, dynamic>) {
			final commands = remote['commands'];
			if (commands is Map<String, dynamic> && commands.isNotEmpty) {
				return commands.values.first?.toString();
			}
		}
		return null;
	}
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
	final String? audioInputId;
	final String? sourceInputId;
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
		this.audioInputId,
		this.sourceInputId,
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
			audioInputId: json['audio_input_id'] as String?,
			sourceInputId: json['source_input_id'] as String?,
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

/// A single step failure from activation execution.
class MediaStepFailureModel {
	final int stepIndex;
	final bool critical;
	final String reason;
	final String? targetDeviceId;
	final String? kind;
	final String? propertyId;
	final String? commandId;
	final String? label;
	final String? timestamp;

	const MediaStepFailureModel({
		required this.stepIndex,
		required this.critical,
		required this.reason,
		this.targetDeviceId,
		this.kind,
		this.propertyId,
		this.commandId,
		this.label,
		this.timestamp,
	});

	factory MediaStepFailureModel.fromJson(Map<String, dynamic> json) {
		return MediaStepFailureModel(
			stepIndex: json['step_index'] as int? ?? 0,
			critical: json['critical'] as bool? ?? false,
			reason: json['reason'] as String? ?? 'Unknown',
			targetDeviceId: json['target_device_id'] as String?,
			kind: json['kind'] as String?,
			propertyId: json['property_id'] as String?,
			commandId: json['command_id'] as String?,
			label: json['label'] as String?,
			timestamp: json['timestamp'] as String?,
		);
	}

	Map<String, dynamic> toJson() => {
		'step_index': stepIndex,
		'critical': critical,
		'reason': reason,
		if (targetDeviceId != null) 'target_device_id': targetDeviceId,
		if (kind != null) 'kind': kind,
		if (propertyId != null) 'property_id': propertyId,
		if (commandId != null) 'command_id': commandId,
		if (label != null) 'label': label,
		if (timestamp != null) 'timestamp': timestamp,
	};
}

/// Summary of the last activation result (successes/failures).
class MediaActivityLastResultModel {
	final int stepsTotal;
	final int stepsSucceeded;
	final int stepsFailed;
	final List<MediaStepFailureModel> failures;
	final List<MediaStepFailureModel> warnings;
	final List<MediaStepFailureModel> errors;
	final int warningCount;
	final int errorCount;

	const MediaActivityLastResultModel({
		this.stepsTotal = 0,
		this.stepsSucceeded = 0,
		this.stepsFailed = 0,
		this.failures = const [],
		this.warnings = const [],
		this.errors = const [],
		this.warningCount = 0,
		this.errorCount = 0,
	});

	/// Legacy compat getters
	int get successCount => stepsSucceeded;
	int get failureCount => stepsFailed;

	bool get hasWarnings => warnings.isNotEmpty;
	bool get hasErrors => errors.isNotEmpty;

	factory MediaActivityLastResultModel.fromJson(Map<String, dynamic> json) {
		List<MediaStepFailureModel> parseFailures(dynamic raw) {
			if (raw is List) {
				return raw.map((e) {
					if (e is Map<String, dynamic>) {
						return MediaStepFailureModel.fromJson(e);
					}
					return MediaStepFailureModel(stepIndex: 0, critical: false, reason: e.toString());
				}).toList();
			}
			return [];
		}

		final legacySuccess = json['success_count'] as int? ?? 0;
		final legacyFailure = json['failure_count'] as int? ?? 0;

		return MediaActivityLastResultModel(
			stepsTotal: json['steps_total'] as int? ?? (legacySuccess + legacyFailure),
			stepsSucceeded: json['steps_succeeded'] as int? ?? legacySuccess,
			stepsFailed: json['steps_failed'] as int? ?? legacyFailure,
			failures: parseFailures(json['failures']),
			warnings: parseFailures(json['warnings']),
			errors: parseFailures(json['errors']),
			warningCount: json['warning_count'] as int? ?? 0,
			errorCount: json['error_count'] as int? ?? 0,
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
	final List<MediaActivationPlanStepModel> planSteps;

	const MediaActiveStateModel({
		this.id,
		required this.spaceId,
		this.activityKey,
		required this.state,
		this.activatedAt,
		this.resolved,
		this.lastResult,
		this.warnings = const [],
		this.planSteps = const [],
	});

	bool get isActive => state == MediaActivationState.active;
	bool get isActivating => state == MediaActivationState.activating;
	bool get isDeactivating => state == MediaActivationState.deactivating;
	bool get isFailed => state == MediaActivationState.failed;
	bool get isDeactivated => state == MediaActivationState.deactivated;
	bool get hasWarnings => warnings.isNotEmpty || (lastResult?.hasWarnings ?? false);
	bool get hasErrors => lastResult?.hasErrors ?? false;
	bool get hasFailures => lastResult != null && lastResult!.failureCount > 0;
	bool get isActiveWithWarnings => isActive && hasWarnings && !hasErrors;

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
		} else if (lastResultRaw is String && lastResultRaw.isNotEmpty) {
			try {
				final decoded = jsonDecode(lastResultRaw);
				if (decoded is Map<String, dynamic>) {
					lastResult = MediaActivityLastResultModel.fromJson(decoded);
				}
			} catch (_) {
				lastResult = null;
			}
		}

		// Parse plan steps from ACTIVATING event payload
		List<MediaActivationPlanStepModel> planSteps = [];
		final stepsRaw = json['steps'];
		if (stepsRaw is List) {
			planSteps = stepsRaw
					.whereType<Map<String, dynamic>>()
					.map((e) => MediaActivationPlanStepModel.fromJson(e))
					.toList();
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
			planSteps: planSteps,
		);
	}

	/// Create a deactivated/empty state.
	factory MediaActiveStateModel.empty(String spaceId) {
		return MediaActiveStateModel(
			spaceId: spaceId,
			state: MediaActivationState.deactivated,
		);
	}

	/// Create a copy with an updated step status (immutable update).
	MediaActiveStateModel copyWithStepStatus(int stepIndex, MediaStepStatus newStatus) {
		final updatedSteps = planSteps.map((step) {
			if (step.index == stepIndex) {
				return step.copyWith(status: newStatus);
			}
			return step;
		}).toList();

		return MediaActiveStateModel(
			id: id,
			spaceId: spaceId,
			activityKey: activityKey,
			state: state,
			activatedAt: activatedAt,
			resolved: resolved,
			lastResult: lastResult,
			warnings: warnings,
			planSteps: updatedSteps,
		);
	}
}

/// A single execution step in a dry-run preview plan.
class MediaExecutionStepModel {
	final String targetDeviceId;
	final String kind;
	final String? propertyId;
	final dynamic value;
	final bool critical;
	final String? label;

	const MediaExecutionStepModel({
		required this.targetDeviceId,
		required this.kind,
		this.propertyId,
		this.value,
		this.critical = false,
		this.label,
	});

	factory MediaExecutionStepModel.fromJson(Map<String, dynamic> json) {
		final action = json['action'] as Map<String, dynamic>? ?? {};
		return MediaExecutionStepModel(
			targetDeviceId: json['target_device_id'] as String? ?? '',
			kind: action['kind'] as String? ?? 'unknown',
			propertyId: action['property_id'] as String?,
			value: action['value'],
			critical: json['critical'] as bool? ?? false,
			label: json['label'] as String?,
		);
	}
}

/// A warning from a dry-run preview.
class MediaDryRunWarningModel {
	final String label;

	const MediaDryRunWarningModel({required this.label});

	factory MediaDryRunWarningModel.fromJson(Map<String, dynamic> json) {
		return MediaDryRunWarningModel(
			label: json['label'] as String? ?? '',
		);
	}
}

/// Result of a dry-run preview API call.
class MediaDryRunPreviewModel {
	final String spaceId;
	final String activityKey;
	final MediaActivityResolvedModel resolved;
	final List<MediaExecutionStepModel> plan;
	final List<MediaDryRunWarningModel> warnings;

	const MediaDryRunPreviewModel({
		required this.spaceId,
		required this.activityKey,
		required this.resolved,
		this.plan = const [],
		this.warnings = const [],
	});

	factory MediaDryRunPreviewModel.fromJson(Map<String, dynamic> json) {
		return MediaDryRunPreviewModel(
			spaceId: json['space_id'] as String? ?? '',
			activityKey: json['activity_key'] as String? ?? '',
			resolved: json['resolved'] != null
					? MediaActivityResolvedModel.fromJson(json['resolved'] as Map<String, dynamic>)
					: const MediaActivityResolvedModel(),
			plan: (json['plan'] as List<dynamic>?)
							?.map((e) => MediaExecutionStepModel.fromJson(e as Map<String, dynamic>))
							.toList() ??
					[],
			warnings: (json['warnings'] as List<dynamic>?)
							?.map((e) => MediaDryRunWarningModel.fromJson(e as Map<String, dynamic>))
							.toList() ??
					[],
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
