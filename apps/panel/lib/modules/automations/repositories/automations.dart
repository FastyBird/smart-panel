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
/// therefore numbered, and an answer is merged against what happened while it
/// was on its way:
/// - an automation is replaced only by the same or a newer revision; at the
///   same revision a live change made after the request started is kept;
/// - an automation deleted (or a reset) after the request started is not
///   brought back by it;
/// - an automation missing from the list is dropped only when nothing changed
///   it after the list was requested.
class AutomationsRepository extends ChangeNotifier {
  final AutomationsModuleClient _apiClient;

  Map<String, AutomationModel> _data = {};

  /// The number of the last change, live or from an answer.
  int _seq = 0;

  /// The change number of the last change of each automation.
  final Map<String, int> _changedAt = {};

  /// The change number at which each automation was deleted.
  final Map<String, int> _deletedAt = {};

  /// The change number of the last reset; nothing before it survives.
  int _resetAt = 0;

  bool _disposed = false;

  AutomationsRepository({required AutomationsModuleClient apiClient})
    : _apiClient = apiClient;

  List<AutomationModel> get automations => _data.values.toList();

  AutomationModel? getAutomation(String id) => _data[id];

  /// Inserts or replaces automations from a live event, skipping what cannot
  /// be read and what is older than the stored revision. A live event about an
  /// automation is proof it exists, so it lifts an earlier deletion.
  void insert(List<Map<String, dynamic>> jsonList) {
    if (_disposed) return;

    final next = {..._data};

    for (final json in jsonList) {
      final automation = _parse(json);

      if (automation == null) continue;

      final stored = next[automation.id];

      if (stored != null && automation.revision < stored.revision) continue;

      _deletedAt.remove(automation.id);
      _changedAt[automation.id] = ++_seq;
      next[automation.id] = automation;
    }

    _replace(next);
  }

  void delete(String id) {
    if (_disposed) return;

    _deletedAt[id] = _changedAt[id] = ++_seq;

    if (!_data.containsKey(id)) return;

    _replace({..._data}..remove(id));
  }

  void clear() {
    if (_disposed) return;

    _resetAt = ++_seq;
    _changedAt.clear();
    _deletedAt.clear();

    _replace({});
  }

  /// Reads every automation and merges the list into what is held, so an
  /// automation deleted while an event was missed disappears too. A failed
  /// read keeps the current list: the panel must start even when the backend
  /// refuses it.
  Future<void> fetchAll() async {
    final startedAt = _seq;

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
    }
  }

  /// Switches an automation on or off and stores what the backend answered,
  /// unless a newer change arrived meanwhile.
  ///
  /// Throws an [AutomationToggleException] when it did not go through.
  Future<AutomationModel> setEnabled(String id, bool enabled) async {
    final startedAt = _seq;

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
    }
  }

  @override
  void dispose() {
    _disposed = true;

    super.dispose();
  }

  /// Whether an automation read by a request that started at [startedAt] may
  /// replace what is held now.
  bool _accepts(AutomationModel automation, int startedAt) {
    if (_resetAt > startedAt) return false;

    final deletedAt = _deletedAt[automation.id];

    if (deletedAt != null && deletedAt > startedAt) return false;

    final stored = _data[automation.id];

    if (stored == null) return true;

    if (automation.revision != stored.revision) {
      return automation.revision > stored.revision;
    }

    // Same revision: a live change made since the request started is newer
    return (_changedAt[automation.id] ?? 0) <= startedAt;
  }

  void _mergeList(Map<String, AutomationModel> listed, int startedAt) {
    // A reset since the request started: the list describes what is gone
    if (_resetAt > startedAt) return;

    final next = <String, AutomationModel>{};

    for (final entry in _data.entries) {
      // Kept when listed (merged below) or changed after the list was asked for
      if (listed.containsKey(entry.key) ||
          (_changedAt[entry.key] ?? 0) > startedAt) {
        next[entry.key] = entry.value;
      }
    }

    for (final automation in listed.values) {
      if (!_accepts(automation, startedAt)) continue;

      next[automation.id] = automation;
    }

    // The list is newer than these deletions, so it decides from now on
    _deletedAt.removeWhere((_, deletedAt) => deletedAt <= startedAt);

    for (final id in next.keys) {
      if (_data[id] != next[id]) _changedAt[id] = ++_seq;
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
