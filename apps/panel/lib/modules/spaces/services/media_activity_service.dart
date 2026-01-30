import 'package:fastybird_smart_panel/modules/spaces/models/media_activity/media_activity.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/media_activity.dart';
import 'package:flutter/foundation.dart';

/// Grouped endpoints for a single device.
class MediaDeviceGroup {
	final String deviceId;
	final String deviceName;
	final List<MediaEndpointModel> endpoints;

	const MediaDeviceGroup({
		required this.deviceId,
		required this.deviceName,
		required this.endpoints,
	});

	bool get hasDisplay => endpoints.any((e) => e.type == MediaEndpointType.display);
	bool get hasAudio => endpoints.any((e) => e.type == MediaEndpointType.audioOutput);
	bool get hasSource => endpoints.any((e) => e.type == MediaEndpointType.source);
	bool get hasRemote => endpoints.any((e) => e.type == MediaEndpointType.remoteTarget);

	MediaEndpointModel? get displayEndpoint =>
			endpoints.cast<MediaEndpointModel?>().firstWhere((e) => e!.type == MediaEndpointType.display, orElse: () => null);
	MediaEndpointModel? get audioEndpoint =>
			endpoints.cast<MediaEndpointModel?>().firstWhere((e) => e!.type == MediaEndpointType.audioOutput, orElse: () => null);
	MediaEndpointModel? get sourceEndpoint =>
			endpoints.cast<MediaEndpointModel?>().firstWhere((e) => e!.type == MediaEndpointType.source, orElse: () => null);
	MediaEndpointModel? get remoteEndpoint =>
			endpoints.cast<MediaEndpointModel?>().firstWhere((e) => e!.type == MediaEndpointType.remoteTarget, orElse: () => null);
}

/// Resolved control targets for the currently active activity.
class ActiveControlTargets {
	final MediaEndpointModel? volumeTarget;
	final MediaEndpointModel? inputTarget;
	final MediaEndpointModel? playbackTarget;
	final MediaEndpointModel? remoteTarget;
	final MediaEndpointModel? displayTarget;

	const ActiveControlTargets({
		this.volumeTarget,
		this.inputTarget,
		this.playbackTarget,
		this.remoteTarget,
		this.displayTarget,
	});

	bool get hasVolume => volumeTarget != null;
	bool get hasInput => inputTarget != null;
	bool get hasPlayback => playbackTarget != null;
	bool get hasRemote => remoteTarget != null;
	bool get hasDisplay => displayTarget != null;
	bool get hasPower => displayTarget?.capabilities.power == true;
	bool get hasTrackMetadata =>
			(playbackTarget?.capabilities.trackMetadata == true) ||
			(volumeTarget?.capabilities.trackMetadata == true);
}

/// Service providing derived state and helpers for the media activity domain.
class MediaActivityService extends ChangeNotifier {
	final MediaActivityRepository _repository;

	MediaActivityService({
		required MediaActivityRepository repository,
	}) : _repository = repository {
		_repository.addListener(_onRepositoryChanged);
	}

	void _onRepositoryChanged() {
		notifyListeners();
	}

	// ============================================
	// DELEGATED GETTERS
	// ============================================

	bool get isLoading => _repository.isLoading;

	List<MediaEndpointModel> getEndpoints(String spaceId) => _repository.getEndpoints(spaceId);
	List<MediaActivityBindingModel> getBindings(String spaceId) => _repository.getBindings(spaceId);
	MediaActiveStateModel? getActiveState(String spaceId) => _repository.getActiveState(spaceId);

	// ============================================
	// DERIVED HELPERS
	// ============================================

	/// Group endpoints by device ID.
	List<MediaDeviceGroup> getDeviceGroups(String spaceId) {
		final endpoints = _repository.getEndpoints(spaceId);
		final Map<String, List<MediaEndpointModel>> grouped = {};

		for (final ep in endpoints) {
			grouped.putIfAbsent(ep.deviceId, () => []).add(ep);
		}

		return grouped.entries.map((entry) {
			final eps = entry.value;
			// Use the first endpoint's name as a fallback device name
			final name = eps.isNotEmpty ? eps.first.name.split(' ').first : 'Unknown';
			return MediaDeviceGroup(
				deviceId: entry.key,
				deviceName: name,
				endpoints: eps,
			);
		}).toList();
	}

	/// Resolve control targets for the current active activity.
	///
	/// Uses the active state's resolved device IDs to find the corresponding endpoints.
	/// Falls back to binding endpoint IDs if resolved is not available.
	ActiveControlTargets resolveControlTargets(String spaceId) {
		final activeState = _repository.getActiveState(spaceId);
		final endpoints = _repository.getEndpoints(spaceId);

		if (activeState == null || activeState.isDeactivated) {
			return const ActiveControlTargets();
		}

		// Try to use resolved device IDs first
		final resolved = activeState.resolved;
		if (resolved != null) {
			return _resolveFromDeviceIds(endpoints, resolved);
		}

		// Fallback: use binding endpoint IDs
		if (activeState.activityKey != null) {
			final binding = _repository.getBindingForActivity(spaceId, activeState.activityKey!);
			if (binding != null) {
				return _resolveFromBinding(endpoints, binding);
			}
		}

		return const ActiveControlTargets();
	}

	ActiveControlTargets _resolveFromDeviceIds(
		List<MediaEndpointModel> endpoints,
		MediaActivityResolvedModel resolved,
	) {
		MediaEndpointModel? findByDeviceAndType(String? deviceId, MediaEndpointType type) {
			if (deviceId == null) return null;
			return endpoints.cast<MediaEndpointModel?>().firstWhere(
				(e) => e!.deviceId == deviceId && e.type == type,
				orElse: () => null,
			);
		}

		final display = findByDeviceAndType(resolved.displayDeviceId, MediaEndpointType.display);
		final audio = findByDeviceAndType(resolved.audioDeviceId, MediaEndpointType.audioOutput);
		final source = findByDeviceAndType(resolved.sourceDeviceId, MediaEndpointType.source);
		final remote = findByDeviceAndType(resolved.remoteDeviceId, MediaEndpointType.remoteTarget);

		// Volume: prefer audio endpoint, fallback to display
		final volumeTarget = (audio?.capabilities.volume == true)
				? audio
				: (display?.capabilities.volume == true ? display : null);

		// Input: display input if available
		final inputTarget = (display?.capabilities.input == true) ? display : null;

		// Playback: source > audio > display
		final playbackTarget = (source?.capabilities.playback == true)
				? source
				: (audio?.capabilities.playback == true
						? audio
						: (display?.capabilities.playback == true ? display : null));

		return ActiveControlTargets(
			volumeTarget: volumeTarget,
			inputTarget: inputTarget,
			playbackTarget: playbackTarget,
			remoteTarget: remote,
			displayTarget: display,
		);
	}

	ActiveControlTargets _resolveFromBinding(
		List<MediaEndpointModel> endpoints,
		MediaActivityBindingModel binding,
	) {
		MediaEndpointModel? findById(String? endpointId) {
			if (endpointId == null) return null;
			return endpoints.cast<MediaEndpointModel?>().firstWhere(
				(e) => e!.endpointId == endpointId,
				orElse: () => null,
			);
		}

		final display = findById(binding.displayEndpointId);
		final audio = findById(binding.audioEndpointId);
		final source = findById(binding.sourceEndpointId);
		final remote = findById(binding.remoteEndpointId);

		final volumeTarget = (audio?.capabilities.volume == true)
				? audio
				: (display?.capabilities.volume == true ? display : null);
		final inputTarget = (display?.capabilities.input == true) ? display : null;
		final playbackTarget = (source?.capabilities.playback == true)
				? source
				: (audio?.capabilities.playback == true
						? audio
						: (display?.capabilities.playback == true ? display : null));

		return ActiveControlTargets(
			volumeTarget: volumeTarget,
			inputTarget: inputTarget,
			playbackTarget: playbackTarget,
			remoteTarget: remote,
			displayTarget: display,
		);
	}

	/// Get available activity keys that have bindings configured.
	List<MediaActivityKey> getAvailableActivities(String spaceId) {
		final bindings = _repository.getBindings(spaceId);
		final keys = bindings.map((b) => b.activityKey).toSet();
		// Always include 'off'
		keys.add(MediaActivityKey.off);
		// Return in canonical order
		return MediaActivityKey.values.where((k) => keys.contains(k)).toList();
	}

	/// Get composition labels for the active card (e.g., "Display: Samsung TV").
	List<String> getActiveCompositionLabels(String spaceId) {
		final targets = resolveControlTargets(spaceId);
		final labels = <String>[];
		if (targets.hasDisplay) labels.add('Display: ${targets.displayTarget!.name}');
		if (targets.hasVolume) labels.add('Audio: ${targets.volumeTarget!.name}');
		if (targets.hasPlayback) labels.add('Source: ${targets.playbackTarget!.name}');
		if (targets.hasRemote) labels.add('Remote: ${targets.remoteTarget!.name}');
		return labels;
	}

	// ============================================
	// DELEGATED ACTIONS
	// ============================================

	Future<void> fetchAllForSpace(String spaceId) => _repository.fetchAllForSpace(spaceId);

	Future<MediaActivationResultModel?> activateActivity(
		String spaceId,
		MediaActivityKey activityKey,
	) => _repository.activateActivity(spaceId, activityKey);

	Future<MediaDryRunPreviewModel?> previewActivity(
		String spaceId,
		MediaActivityKey activityKey,
	) => _repository.previewActivity(spaceId, activityKey);

	Future<MediaActivationResultModel?> deactivateActivity(String spaceId) =>
			_repository.deactivateActivity(spaceId);

	@override
	void dispose() {
		_repository.removeListener(_onRepositoryChanged);
		super.dispose();
	}
}
