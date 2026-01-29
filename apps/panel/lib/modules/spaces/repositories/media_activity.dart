import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/media_activity/media_activity.dart';
import 'package:flutter/foundation.dart';

/// Repository for media activity domain V2 API calls.
///
/// Uses Dio directly since the generated API client does not yet include
/// the new media activity endpoints.
class MediaActivityRepository extends ChangeNotifier {
	final Dio _dio;

	/// Cached endpoints by space ID
	final Map<String, List<MediaEndpointModel>> _endpoints = {};

	/// Cached bindings by space ID
	final Map<String, List<MediaActivityBindingModel>> _bindings = {};

	/// Cached active state by space ID
	final Map<String, MediaActiveStateModel> _activeStates = {};

	bool _isLoading = false;

	MediaActivityRepository({
		required Dio dio,
	}) : _dio = dio;

	bool get isLoading => _isLoading;

	// ============================================
	// ENDPOINTS
	// ============================================

	List<MediaEndpointModel> getEndpoints(String spaceId) {
		return _endpoints[spaceId] ?? [];
	}

	Future<List<MediaEndpointModel>> fetchEndpoints(String spaceId) async {
		try {
			final response = await _dio.get('/spaces/$spaceId/media/endpoints');

			if (response.statusCode == 200) {
				final data = response.data['data'] as Map<String, dynamic>;
				final endpointsList = data['endpoints'] as List<dynamic>? ?? [];
				final endpoints = endpointsList
						.map((e) => MediaEndpointModel.fromJson(e as Map<String, dynamic>))
						.toList();
				_endpoints[spaceId] = endpoints;
				notifyListeners();
				return endpoints;
			}
		} on DioException catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] API error fetching endpoints for $spaceId: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] Error fetching endpoints for $spaceId: $e',
				);
			}
		}
		return _endpoints[spaceId] ?? [];
	}

	// ============================================
	// BINDINGS
	// ============================================

	List<MediaActivityBindingModel> getBindings(String spaceId) {
		return _bindings[spaceId] ?? [];
	}

	MediaActivityBindingModel? getBindingForActivity(String spaceId, MediaActivityKey activityKey) {
		return getBindings(spaceId).cast<MediaActivityBindingModel?>().firstWhere(
			(b) => b!.activityKey == activityKey,
			orElse: () => null,
		);
	}

	Future<List<MediaActivityBindingModel>> fetchBindings(String spaceId) async {
		try {
			final response = await _dio.get('/spaces/$spaceId/media/bindings');

			if (response.statusCode == 200) {
				final data = response.data['data'] as List<dynamic>;
				final bindings = data
						.map((e) => MediaActivityBindingModel.fromJson(e as Map<String, dynamic>))
						.toList();
				_bindings[spaceId] = bindings;
				notifyListeners();
				return bindings;
			}
		} on DioException catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] API error fetching bindings for $spaceId: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] Error fetching bindings for $spaceId: $e',
				);
			}
		}
		return _bindings[spaceId] ?? [];
	}

	// ============================================
	// ACTIVE STATE
	// ============================================

	MediaActiveStateModel? getActiveState(String spaceId) {
		return _activeStates[spaceId];
	}

	Future<MediaActiveStateModel?> fetchActiveState(String spaceId) async {
		try {
			final response = await _dio.get('/spaces/$spaceId/media/activities/active');

			if (response.statusCode == 200) {
				final data = response.data['data'];
				if (data != null && data is Map<String, dynamic>) {
					final state = MediaActiveStateModel.fromJson(data, spaceId: spaceId);
					_activeStates[spaceId] = state;
					notifyListeners();
					return state;
				} else {
					// No active activity
					final state = MediaActiveStateModel.empty(spaceId);
					_activeStates[spaceId] = state;
					notifyListeners();
					return state;
				}
			}
		} on DioException catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] API error fetching active state for $spaceId: ${e.response?.statusCode}',
				);
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] Error fetching active state for $spaceId: $e',
				);
			}
		}
		return _activeStates[spaceId];
	}

	/// Update active state from WebSocket event data.
	void updateActiveState(String spaceId, Map<String, dynamic> json) {
		try {
			final state = MediaActiveStateModel.fromJson(json, spaceId: spaceId);
			_activeStates[spaceId] = state;

			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] Updated active state for $spaceId: ${state.state} (${state.activityKey})',
				);
			}
			notifyListeners();
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] Failed to parse active state update: $e',
				);
			}
		}
	}

	// ============================================
	// ACTIVATION / DEACTIVATION
	// ============================================

	Future<MediaActivationResultModel?> activateActivity(
		String spaceId,
		MediaActivityKey activityKey,
	) async {
		// Optimistic update: set activating state immediately
		_activeStates[spaceId] = MediaActiveStateModel(
			spaceId: spaceId,
			activityKey: activityKey,
			state: MediaActivationState.activating,
		);
		notifyListeners();

		try {
			final keyStr = mediaActivityKeyToString(activityKey);
			final response = await _dio.post('/spaces/$spaceId/media/activities/$keyStr/activate');

			final statusCode = response.statusCode ?? 0;
			if (statusCode >= 200 && statusCode < 300) {
				final data = response.data['data'] as Map<String, dynamic>;
				final result = MediaActivationResultModel.fromJson(data);

				// Update state from result
				_activeStates[spaceId] = MediaActiveStateModel(
					spaceId: spaceId,
					activityKey: result.activityKey,
					state: result.state,
					resolved: result.resolved,
					lastResult: result.summary,
					warnings: result.warnings,
				);
				notifyListeners();
				return result;
			} else {
				// Non-2xx: revert to failed
				_activeStates[spaceId] = MediaActiveStateModel(
					spaceId: spaceId,
					activityKey: activityKey,
					state: MediaActivationState.failed,
				);
				notifyListeners();
			}
		} on DioException catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] API error activating $activityKey for $spaceId: ${e.response?.statusCode}',
				);
			}
			// Revert to failed state
			_activeStates[spaceId] = MediaActiveStateModel(
				spaceId: spaceId,
				activityKey: activityKey,
				state: MediaActivationState.failed,
			);
			notifyListeners();
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] Error activating $activityKey for $spaceId: $e',
				);
			}
			_activeStates[spaceId] = MediaActiveStateModel(
				spaceId: spaceId,
				activityKey: activityKey,
				state: MediaActivationState.failed,
			);
			notifyListeners();
		}
		return null;
	}

	Future<MediaActivationResultModel?> deactivateActivity(String spaceId) async {
		// Optimistic update
		_activeStates[spaceId] = MediaActiveStateModel(
			spaceId: spaceId,
			activityKey: MediaActivityKey.off,
			state: MediaActivationState.activating,
		);
		notifyListeners();

		try {
			final response = await _dio.post('/spaces/$spaceId/media/activities/deactivate');

			final statusCode = response.statusCode ?? 0;
			if (statusCode >= 200 && statusCode < 300) {
				final data = response.data['data'] as Map<String, dynamic>;
				final result = MediaActivationResultModel.fromJson(data);

				_activeStates[spaceId] = MediaActiveStateModel(
					spaceId: spaceId,
					activityKey: null,
					state: result.state,
					resolved: result.resolved,
					lastResult: result.summary,
					warnings: result.warnings,
				);
				notifyListeners();
				return result;
			} else {
				// Non-2xx: revert to failed
				_activeStates[spaceId] = MediaActiveStateModel(
					spaceId: spaceId,
					state: MediaActivationState.failed,
				);
				notifyListeners();
			}
		} on DioException catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] API error deactivating for $spaceId: ${e.response?.statusCode}',
				);
			}
			_activeStates[spaceId] = MediaActiveStateModel(
				spaceId: spaceId,
				state: MediaActivationState.failed,
			);
			notifyListeners();
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[MEDIA ACTIVITY] Error deactivating for $spaceId: $e',
				);
			}
			_activeStates[spaceId] = MediaActiveStateModel(
				spaceId: spaceId,
				state: MediaActivationState.failed,
			);
			notifyListeners();
		}
		return null;
	}

	// ============================================
	// BATCH & LIFECYCLE
	// ============================================

	/// Fetch all media activity data for a space.
	Future<void> fetchAllForSpace(String spaceId) async {
		_isLoading = true;
		notifyListeners();

		try {
			await Future.wait([
				fetchEndpoints(spaceId),
				fetchBindings(spaceId),
				fetchActiveState(spaceId),
			]);
		} finally {
			_isLoading = false;
			notifyListeners();
		}
	}

	/// Clear all cached data.
	void clearAll() {
		_endpoints.clear();
		_bindings.clear();
		_activeStates.clear();
		_isLoading = false;
		notifyListeners();
	}

	/// Clear data for a specific space.
	void clearForSpace(String spaceId) {
		_endpoints.remove(spaceId);
		_bindings.remove(spaceId);
		_activeStates.remove(spaceId);
		notifyListeners();
	}
}
