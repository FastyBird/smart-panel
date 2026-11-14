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
/// an answer can be read before a change and arrive after it. The model is
/// request-relative, with no special cases:
/// - Every request takes a fresh number when it starts (`++_seq`), and every
///   applied change takes the next one: a live create, update, delete or
///   reset, an item or removal applied from a list, an applied switch answer
///   and an applied "gone" answer.
/// - A deletion is a change like any other and is recorded as one, whatever
///   reported it: a Deleted event, a list that leaves the automation out, or a
///   switch answered with 404.
/// - An answer is applied to an automation only when nothing changed or
///   deleted it, and no reset happened, after the request started; an item
///   must also be at least the stored revision. A 404 is an answer saying the
///   automation is gone, handled exactly like a list leaving it out.
/// - A list that started before the last applied list is dropped whole.
/// - Records are pruned only up to the earliest start of a request still in
///   flight, and entirely once none is.
class AutomationsRepository extends ChangeNotifier {
  final AutomationsModuleClient _apiClient;

  Map<String, AutomationModel> _data = {};

  /// The number of the last change, live or from an answer.
  int _seq = 0;

  /// The change number of the last change of each automation, deletions
  /// included.
  final Map<String, int> _changedAt = {};

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

    _changedAt[id] = ++_seq;

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

      if (e.response?.statusCode == 404 && !_disposed) {
        final next = {..._data};

        _applyGone(next, id, startedAt);
        _replace(next);
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
    final startedAt = ++_seq;

    _inFlight.add(startedAt);

    return startedAt;
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

      return;
    }

    final earliest = _inFlight.reduce((a, b) => a < b ? a : b);

    _changedAt.removeWhere((_, at) => at <= earliest);
  }

  /// Whether nothing changed [id] - and no reset happened - after a request
  /// that started at [startedAt], so its answer about [id] still holds.
  bool _unchangedSince(String id, int startedAt) =>
      _resetAt < startedAt && (_changedAt[id] ?? -1) < startedAt;

  /// Whether an automation read by a request that started at [startedAt] may
  /// replace what is held now.
  bool _accepts(AutomationModel automation, int startedAt) {
    if (!_unchangedSince(automation.id, startedAt)) return false;

    final stored = _data[automation.id];

    return stored == null || automation.revision >= stored.revision;
  }

  /// A request that started at [startedAt] says [id] is gone.
  void _applyGone(Map<String, AutomationModel> next, String id, int startedAt) {
    if (!_unchangedSince(id, startedAt) || !next.containsKey(id)) return;

    _changedAt[id] = ++_seq;
    next.remove(id);
  }

  void _mergeList(Map<String, AutomationModel> listed, int startedAt) {
    // Read before a reset, or before a list that was already applied
    if (_resetAt > startedAt || startedAt < _listAppliedFrom) return;

    _listAppliedFrom = startedAt;

    final next = {..._data};

    for (final id in _data.keys) {
      if (!listed.containsKey(id)) _applyGone(next, id, startedAt);
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
