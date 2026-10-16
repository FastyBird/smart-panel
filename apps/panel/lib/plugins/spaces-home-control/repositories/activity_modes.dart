import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/spaces_home_control_plugin_data_space_activity_config_entity.dart';
import 'package:fastybird_smart_panel/api/models/spaces_home_control_plugin_data_space_activity_state_entity.dart';
import 'package:flutter/foundation.dart';

typedef ActivityModeConfig =
    SpacesHomeControlPluginDataSpaceActivityConfigEntity;
typedef ActivityModeState = SpacesHomeControlPluginDataSpaceActivityStateEntity;

enum ActivityModeIssue { unavailable, conflict, unconfirmed }

/// One mounted space's read model. Events invalidate it; only a manual tap writes.
/// Generations fence old GETs, actions and space rebindings without replaying writes.
class ActivityModesRepository extends ChangeNotifier {
  final Dio _dio;
  ActivityModesRepository({required Dio dio}) : _dio = dio;

  String? _spaceId;
  int _generation = 0;
  bool _disposed = false;
  bool _refreshAfterAction = false;
  List<ActivityModeConfig> modes = [];
  ActivityModeState? state;
  bool loading = false;
  bool busy = false;
  bool fresh = false;
  ActivityModeIssue? issue;

  String? get spaceId => _spaceId;
  bool get canSubmit =>
      !_disposed &&
      fresh &&
      !loading &&
      !busy &&
      state?.activityStatus.json != 'activating';
  String _path(String id) => '/modules/spaces/spaces/$id/activity-modes';

  Future<void> bind(String? id) async {
    if (_disposed) return;
    if (_spaceId == id) return;
    _generation++;
    _spaceId = id;
    modes = [];
    state = null;
    busy = false;
    fresh = false;
    issue = null;
    _refreshAfterAction = false;
    if (id == null || id.isEmpty) {
      loading = false;
      _notify();
      return;
    }
    await refresh();
  }

  /// Losing the connection invalidates admission, without resubmitting anything.
  void markStale() {
    fresh = false;
    if (!busy) {
      _generation++;
      loading = false;
    }
    _notify();
  }

  Future<void> refresh() async {
    final id = _spaceId;
    if (id == null || id.isEmpty || _disposed) return;
    if (busy) {
      _refreshAfterAction = true;
      fresh = false;
      _notify();
      return;
    }
    final generation = ++_generation;
    loading = true;
    fresh = false;
    _notify();
    try {
      final available = await _dio.get<Map<String, dynamic>>(_path(id));
      final active = await _dio.get<Map<String, dynamic>>(
        '${_path(id)}/active',
      );
      final list =
          (available.data!['data'] as List)
              .map(
                (value) =>
                    ActivityModeConfig.fromJson(value as Map<String, dynamic>),
              )
              .where(
                (mode) =>
                    mode.activityEnabled && mode.activityMode.json != null,
              )
              .toList()
            ..sort((a, b) {
              final order = a.activityOrder.compareTo(b.activityOrder);
              return order == 0
                  ? (a.activityMode.json ?? '').compareTo(
                      b.activityMode.json ?? '',
                    )
                  : order;
            });
      if (active.data == null || !active.data!.containsKey('data')) {
        throw StateError('Missing activity state envelope');
      }
      final data = active.data!['data'];
      final nextState = data == null
          ? null
          : ActivityModeState.fromJson(data as Map<String, dynamic>);
      if (nextState != null &&
          (nextState.activityStatus.json == null ||
              (nextState.selectedActivityMode != null &&
                  nextState.selectedActivityMode?.json == null))) {
        throw StateError('Unsupported activity state');
      }
      if (list.any((mode) => mode.spaceId != id) ||
          (nextState != null && nextState.spaceId != id)) {
        throw StateError('Activity response belongs to another space');
      }
      if (!_current(id, generation)) return;
      modes = list;
      state = nextState;
      fresh = true;
      // Uncertainty belongs to the submission, even when a read finds server state.
      if (issue == ActivityModeIssue.unavailable) {
        issue = null;
      }
    } catch (_) {
      if (_current(id, generation) && issue == null) {
        issue = ActivityModeIssue.unavailable;
      }
    } finally {
      if (_current(id, generation)) {
        loading = false;
        _notify();
      }
    }
  }

  Future<void> activate(ActivityModeConfig config) async {
    if (!canSubmit || !modes.contains(config)) return;
    await _submit(
      '${config.activityMode.json}/activate',
      {'expected_revision': config.activityRevision},
      expectedMode: config.activityMode.json,
      expectedRevision: config.activityRevision,
    );
  }

  Future<void> deactivate() async {
    final active = state;
    if (!canSubmit || active?.selectedActivityMode == null) return;
    await _submit('deactivate', {'activation_id': active!.activationId});
  }

  Future<void> _submit(
    String action,
    Map<String, dynamic> data, {
    String? expectedMode,
    int? expectedRevision,
  }) async {
    final id = _spaceId!;
    final generation = ++_generation;
    final previousActivationId = state?.activationId;
    busy = true;
    issue = null;
    _notify();
    try {
      final response = await _dio
          .post<Map<String, dynamic>>(
            '${_path(id)}/$action',
            data: {'data': data},
            options: Options(
              receiveTimeout: const Duration(seconds: 35),
              extra: {'retryExhausted': true, 'noActuationReplay': true},
            ),
          )
          .timeout(const Duration(seconds: 35));
      final result = response.data?['data'];
      if (result == null) throw StateError('Missing activity result');
      final next = ActivityModeState.fromJson(result as Map<String, dynamic>);
      if (next.spaceId != id ||
          next.activationId.isEmpty ||
          (action == 'deactivate' &&
              (next.selectedActivityMode != null ||
                  next.activityStatus.json != 'deactivated' ||
                  next.activationId == data['activation_id'])) ||
          (action != 'deactivate' &&
              (next.activationId == previousActivationId ||
                  next.selectedActivityMode?.json != expectedMode ||
                  next.selectedActivityRevision != expectedRevision))) {
        throw StateError('Activity response does not confirm this submission');
      }
      if (!_current(id, generation)) return;
      state = next;
    } catch (error) {
      if (!_current(id, generation)) return;
      issue = error is DioException && error.response?.statusCode == 409
          ? ActivityModeIssue.conflict
          : ActivityModeIssue.unconfirmed;
      fresh = false;
      _refreshAfterAction = true;
    } finally {
      if (_current(id, generation)) {
        busy = false;
        _notify();
        if (_refreshAfterAction) {
          _refreshAfterAction = false;
          await refresh();
        }
      }
    }
  }

  bool _current(String id, int generation) =>
      !_disposed && _spaceId == id && _generation == generation;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _generation++;
    super.dispose();
  }
}

/// Owns independent read/action sessions for retained pages and pushed routes.
/// Sharing transport must never share a page's selected-space identity.
class ActivityModesRegistry {
  final Dio _dio;
  final Set<ActivityModesRepository> _sessions = {};
  bool _disposed = false;

  ActivityModesRegistry({required Dio dio}) : _dio = dio;

  ActivityModesRepository create() {
    if (_disposed) throw StateError('Activity modes registry is disposed');
    final session = ActivityModesRepository(dio: _dio);
    _sessions.add(session);
    return session;
  }

  void release(ActivityModesRepository session) {
    if (_sessions.remove(session)) session.dispose();
  }

  Future<void> refresh([String? spaceId]) async {
    if (_disposed) return;
    await Future.wait([
      for (final session in _sessions.toList())
        if (spaceId == null || session.spaceId == spaceId) session.refresh(),
    ]);
  }

  void markStale() {
    if (_disposed) return;
    for (final session in _sessions.toList()) {
      session.markStale();
    }
  }

  void clearSpace(String spaceId) {
    if (_disposed) return;
    for (final session in _sessions.toList()) {
      if (session.spaceId == spaceId) session.bind(null);
    }
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    for (final session in _sessions.toList()) {
      session.dispose();
    }
    _sessions.clear();
  }
}
