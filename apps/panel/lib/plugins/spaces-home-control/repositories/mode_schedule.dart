import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/spaces_home_control_plugin_data_schedule_state.dart';
import 'package:flutter/foundation.dart';

typedef ModeScheduleState = SpacesHomeControlPluginDataScheduleState;

/// Read-only planned activity. A plan is never evidence of device convergence.
class ModeScheduleRepository extends ChangeNotifier {
  ModeScheduleRepository({required Dio dio}) : _dio = dio;
  final Dio _dio;
  String? spaceId;
  ModeScheduleState? state;
  bool fresh = false;
  bool loading = false;
  bool unavailable = false;
  bool _disposed = false;
  int _generation = 0;

  Future<void> bind(String? id) async {
    if (_disposed || spaceId == id) return;
    _generation++;
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
    fresh = false;
    loading = false;
    notifyListeners();
  }

  Future<void> refresh() async {
    final id = spaceId;
    if (_disposed || id == null || id.isEmpty) return;
    final generation = ++_generation;
    loading = true;
    fresh = false;
    notifyListeners();
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/modules/spaces/spaces/$id/schedules/state',
        options: Options(receiveTimeout: const Duration(seconds: 15)),
      );
      final data = response.data?['data'];
      if (data is! Map<String, dynamic>)
        throw StateError('Missing schedule state');
      final next = ModeScheduleState.fromJson(data);
      if (next.spaceId != id ||
          next.status.json == null ||
          (next.lastAttemptStatus != null &&
              next.lastAttemptStatus!.json == null) ||
          [
            next.current,
            next.next,
            next.lastAttempt,
          ].any((item) => item != null && item.mode.json == null)) {
        throw StateError('Unsupported schedule state');
      }
      if (!_current(id, generation)) return;
      state = next;
      unavailable = false;
      fresh = true;
    } catch (_) {
      if (_current(id, generation)) unavailable = true;
    } finally {
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
    super.dispose();
  }
}

/// Each retained page owns a separate space binding. The last release stops polling.
class ModeScheduleRegistry {
  ModeScheduleRegistry({required Dio dio}) : _dio = dio;
  final Dio _dio;
  final Set<ModeScheduleRepository> _sessions = {};
  Timer? _timer;
  bool _disposed = false;
  bool _connected = true;

  ModeScheduleRepository create() {
    if (_disposed) throw StateError('Schedule registry is disposed');
    final session = ModeScheduleRepository(dio: _dio);
    _sessions.add(session);
    _timer ??= Timer.periodic(const Duration(minutes: 1), (_) {
      if (_connected) refresh();
    });
    return session;
  }

  void release(ModeScheduleRepository session) {
    if (_sessions.remove(session)) session.dispose();
    if (_sessions.isEmpty) {
      _timer?.cancel();
      _timer = null;
    }
  }

  Future<void> refresh([String? spaceId]) async {
    if (_disposed || !_connected) return;
    await Future.wait([
      for (final session in _sessions.toList())
        if (spaceId == null || session.spaceId == spaceId) session.refresh(),
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
