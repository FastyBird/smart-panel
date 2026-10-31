import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/spaces_home_control_plugin_data_occupancy_state.dart';
import 'package:flutter/foundation.dart';

typedef OccupancyState = SpacesHomeControlPluginDataOccupancyState;

/// Qualified presence display; no history fallback or occupancy control authority.
class OccupancyRepository extends ChangeNotifier {
  OccupancyRepository({required Dio dio, bool Function()? isConnected})
    : _dio = dio,
      _isConnected = isConnected ?? (() => true);
  final Dio _dio;
  final bool Function() _isConnected;
  CancelToken? _request;
  String? spaceId;
  OccupancyState? state;
  bool fresh = false;
  bool loading = false;
  bool unavailable = false;
  bool _disposed = false;
  int _generation = 0;

  Future<void> bind(String? id) async {
    if (_disposed || spaceId == id) return;
    _generation++;
    _request?.cancel('Space binding changed');
    spaceId = id;
    state = null;
    fresh = false;
    loading = false;
    unavailable = false;
    if (id == null || id.isEmpty) {
      notifyListeners();
      return;
    }
    await refresh();
  }

  void markStale() {
    if (_disposed) return;
    _generation++;
    _request?.cancel('Occupancy state is stale');
    fresh = false;
    loading = false;
    notifyListeners();
  }

  Future<void> refresh() async {
    final id = spaceId;
    if (_disposed || id == null || id.isEmpty) return;
    if (!_isConnected()) {
      markStale();
      return;
    }
    final generation = ++_generation;
    _request?.cancel('Occupancy refresh superseded');
    final request = CancelToken();
    _request = request;
    loading = true;
    fresh = false;
    notifyListeners();
    try {
      final response = await _dio
          .get<Map<String, dynamic>>(
            '/modules/spaces/spaces/$id/occupancy/state',
            options: Options(receiveTimeout: const Duration(seconds: 15)),
            cancelToken: request,
          )
          .timeout(
            const Duration(seconds: 10),
            onTimeout: () {
              request.cancel('Occupancy-state deadline exceeded');
              throw TimeoutException('Occupancy-state deadline exceeded');
            },
          );
      final data = response.data?['data'];
      if (data is! Map<String, dynamic>) {
        throw StateError('Missing occupancy state');
      }
      final next = OccupancyState.fromJson(data);
      if (next.spaceId != id || next.status.json == null) {
        throw StateError('Unsupported occupancy state');
      }
      if (!_current(id, generation)) return;
      if (!_isConnected()) {
        markStale();
        return;
      }
      state = next;
      unavailable = false;
      fresh = true;
    } catch (_) {
      if (_current(id, generation)) unavailable = true;
    } finally {
      if (identical(_request, request)) _request = null;
      if (_current(id, generation)) {
        loading = false;
        notifyListeners();
      }
    }
  }

  bool _current(String id, int generation) =>
      !_disposed && spaceId == id && generation == _generation;
  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _generation++;
    _request?.cancel('Occupancy session disposed');
    super.dispose();
  }
}

/// Each retained page owns a separate space binding. The last release stops polling.
class OccupancyRegistry {
  OccupancyRegistry({required Dio dio}) : _dio = dio;
  final Dio _dio;
  final Set<OccupancyRepository> _sessions = {};
  Timer? _timer;
  bool _disposed = false;
  bool _connected = true;

  OccupancyRepository create() {
    if (_disposed) throw StateError('Occupancy registry is disposed');
    final session = OccupancyRepository(
      dio: _dio,
      isConnected: () => _connected,
    );
    _sessions.add(session);
    _timer ??= Timer.periodic(const Duration(seconds: 15), (_) {
      if (_connected) _refresh(null, true);
    });
    return session;
  }

  void release(OccupancyRepository session) {
    if (_sessions.remove(session)) session.dispose();
    if (_sessions.isEmpty) {
      _timer?.cancel();
      _timer = null;
    }
  }

  Future<void> refresh([String? spaceId]) => _refresh(spaceId, false);

  Future<void> _refresh(String? spaceId, bool periodic) async {
    if (_disposed || !_connected) return;
    await Future.wait([
      for (final session in _sessions.toList())
        if ((spaceId == null || session.spaceId == spaceId) &&
            !(periodic && session.fresh && session.state?.enabled == false))
          session.refresh(),
    ]);
  }

  Future<void> connectionChanged(bool connected) async {
    _connected = connected;
    if (_disposed) return;
    if (connected) {
      await refresh();
    } else {
      for (final session in _sessions.toList()) {
        session.markStale();
      }
    }
  }

  void clearSpace(String id) {
    if (!_disposed) {
      for (final session in _sessions.toList()) {
        if (session.spaceId == id) session.bind(null);
      }
    }
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _timer?.cancel();
    for (final session in _sessions.toList()) {
      session.dispose();
    }
    _sessions.clear();
  }
}
