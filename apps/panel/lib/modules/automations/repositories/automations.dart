import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/automations_module/automations_module_client.dart';
import 'package:fastybird_smart_panel/api/models/automations_module_req_set_automation_enabled.dart';
import 'package:fastybird_smart_panel/api/models/automations_module_set_automation_enabled.dart';
import 'package:fastybird_smart_panel/modules/automations/constants.dart';
import 'package:fastybird_smart_panel/modules/automations/models/automation.dart';
import 'package:flutter/foundation.dart';

/// Why switching an automation on or off did not go through.
enum AutomationToggleFailure {
  /// The graph is not complete, so the automation cannot be enabled.
  incomplete,

  /// The automation no longer exists.
  notFound,

  /// Anything else: the backend refused, failed or did not answer in time.
  failed,
}

class AutomationToggleException implements Exception {
  final AutomationToggleFailure failure;

  const AutomationToggleException(this.failure);

  @override
  String toString() => 'AutomationToggleException(${failure.name})';
}

/// The automations the panel knows about, as the backend last reported them.
///
/// Live changes (websocket events) and REST answers (the list, a switch) race:
/// an answer can be read before a change and arrive after it. Every change is
/// therefore numbered, and every request remembers the number it started at.
/// - A deletion seen by any source - a Deleted event, a list that leaves the
///   automation out, a switch answered with 404 - is recorded at its number.
/// - An answer is applied to an automation only when nothing deleted it and no
///   reset happened after the request started; a newer revision then wins, and
///   at the same revision so does a change made after the request started.
/// - A list that started before the last list applied is dropped whole, so an
///   older list can neither re-add nor remove anything relative to a newer one.
/// - Records are pruned only when no request still in flight started before
///   them, so a slow request always finds the changes it missed.
class AutomationsRepository extends ChangeNotifier {
  final AutomationsModuleClient _apiClient;

  Map<String, AutomationModel> _data = {};

  /// The number of the last change, live or from an answer.
  int _seq = 0;

  /// The change number of the last change of each automation.
  final Map<String, int> _changedAt = {};

  /// The change number at which each automation was seen deleted.
  final Map<String, int> _deletedAt = {};

  /// The change number of the last reset; nothing read before it survives.
  int _resetAt = 0;

  /// The start number of the last list that was applied.
  int _listAppliedFrom = -1;

  /// The start numbers of the requests still in flight.
  final List<int> _inFlight = [];

  bool _disposed = false;

  AutomationsRepository({required AutomationsModuleClient apiClient})
    : _apiClient = apiClient;

  List<AutomationModel> get automations => _data.values.toList();

  AutomationModel? getAutomation(String id) => _data[id];

  /// Inserts or replaces automations from a live event, skipping what cannot
  /// be read and what is older than the stored revision. A live event is the
  /// current truth, so it applies even to an automation deleted before; the
  /// deletion stays recorded for the requests that started before it.
  void insert(List<Map<String, dynamic>> jsonList) {
    if (_disposed) return;

    final next = {..._data};

    for (final json in jsonList) {
      final automation = _parse(json);

      if (automation == null) continue;

      final stored = next[automation.id];

      if (stored != null && automation.revision < stored.revision) continue;

      _changedAt[automation.id] = ++_seq;
      next[automation.id] = automation;
    }

    _replace(next);
    _prune();
  }

  void delete(String id) {
    if (_disposed) return;

    _deletedAt[id] = _changedAt[id] = ++_seq;

    _replace({..._data}..remove(id));
    _prune();
  }

  void clear() {
    if (_disposed) return;

    _resetAt = ++_seq;

    _replace({});
    _prune();
  }

  /// Reads every automation and merges the list into what is held, so an
  /// automation deleted while an event was missed disappears too. A failed
  /// read keeps the current list: the panel must start even when the backend
  /// refuses it.
  Future<void> fetchAll() async {
    final startedAt = _begin();

    try {
      final response = await _apiClient.getAutomationsModuleAutomations();
      final raw = response.response.data;

      if (_disposed ||
          response.response.statusCode != 200 ||
          raw is! Map ||
          raw['data'] is! List) {
        return;
      }

      final listed = <String, AutomationModel>{};

      for (final item in (raw['data'] as List).whereType<Map>()) {
        final automation = _parse(Map<String, dynamic>.from(item));

        if (automation != null) listed[automation.id] = automation;
      }

      _mergeList(listed, startedAt);
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[AUTOMATIONS MODULE] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AUTOMATIONS MODULE] Unexpected error: $e');
      }
    } finally {
      _end(startedAt);
    }
  }

  /// Switches an automation on or off and stores what the backend answered,
  /// unless a newer change arrived meanwhile.
  ///
  /// Throws an [AutomationToggleException] when it did not go through.
  Future<AutomationModel> setEnabled(String id, bool enabled) async {
    final startedAt = _begin();

    try {
      final response = await _apiClient
          .setAutomationsModuleAutomationEnabled(
            id: id,
            body: AutomationsModuleReqSetAutomationEnabled(
              data: AutomationsModuleSetAutomationEnabled(enabled: enabled),
            ),
          )
          .timeout(AutomationsModuleConstants.setEnabledTimeout);
      final raw = response.response.data;

      if (raw is! Map || raw['data'] is! Map) {
        throw const AutomationToggleException(AutomationToggleFailure.failed);
      }

      final automation = AutomationModel.fromJson(
        Map<String, dynamic>.from(raw['data'] as Map),
      );

      if (automation.id != id) {
        throw const AutomationToggleException(AutomationToggleFailure.failed);
      }

      if (!_disposed && _accepts(automation, startedAt)) {
        _changedAt[id] = ++_seq;
        _replace({..._data, id: automation});
      }

      return automation;
    } on AutomationToggleException {
      rethrow;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[AUTOMATIONS MODULE] Failed to switch automation $id: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw AutomationToggleException(switch (e.response?.statusCode) {
        422 => AutomationToggleFailure.incomplete,
        404 => AutomationToggleFailure.notFound,
        _ => AutomationToggleFailure.failed,
      });
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AUTOMATIONS MODULE] Failed to switch automation $id: $e');
      }

      throw const AutomationToggleException(AutomationToggleFailure.failed);
    } finally {
      _end(startedAt);
    }
  }

  @override
  void dispose() {
    _disposed = true;

    super.dispose();
  }

  int _begin() {
    _inFlight.add(_seq);

    return _seq;
  }

  void _end(int startedAt) {
    _inFlight.remove(startedAt);
    _prune();
  }

  /// Forgets what no request in flight can have missed: everything numbered at
  /// or before the earliest start, and everything when nothing is in flight.
  void _prune() {
    if (_inFlight.isEmpty) {
      _changedAt.clear();
      _deletedAt.clear();

      return;
    }

    final earliest = _inFlight.reduce((a, b) => a < b ? a : b);

    _changedAt.removeWhere((_, at) => at <= earliest);
    _deletedAt.removeWhere((_, at) => at <= earliest);
  }

  /// Whether an automation read by a request that started at [startedAt] may
  /// replace what is held now.
  bool _accepts(AutomationModel automation, int startedAt) {
    if (_resetAt > startedAt) return false;

    if ((_deletedAt[automation.id] ?? -1) > startedAt) return false;

    final stored = _data[automation.id];

    if (stored == null) return true;

    if (automation.revision != stored.revision) {
      return automation.revision > stored.revision;
    }

    // Same revision: a change made since the request started is newer
    return (_changedAt[automation.id] ?? -1) <= startedAt;
  }

  void _mergeList(Map<String, AutomationModel> listed, int startedAt) {
    // Read before a reset, or before a list that was already applied
    if (_resetAt > startedAt || startedAt < _listAppliedFrom) return;

    _listAppliedFrom = startedAt;

    final next = <String, AutomationModel>{};

    for (final entry in _data.entries) {
      if (listed.containsKey(entry.key) ||
          (_changedAt[entry.key] ?? -1) > startedAt) {
        // Listed (merged below), or changed after the list was asked for
        next[entry.key] = entry.value;
      } else {
        // Left out of the list: deleted, as far as older requests are concerned
        _deletedAt[entry.key] = _changedAt[entry.key] = ++_seq;
      }
    }

    for (final automation in listed.values) {
      if (_accepts(automation, startedAt) &&
          next[automation.id] != automation) {
        _changedAt[automation.id] = ++_seq;
        next[automation.id] = automation;
      }
    }

    _replace(next);
  }

  AutomationModel? _parse(Map<String, dynamic> json) {
    try {
      return AutomationModel.fromJson(json);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AUTOMATIONS MODULE] Failed to parse automation: $e');
      }

      return null;
    }
  }

  void _replace(Map<String, AutomationModel> next) {
    if (_disposed || mapEquals(_data, next)) return;

    _data = next;
    notifyListeners();
  }
}
