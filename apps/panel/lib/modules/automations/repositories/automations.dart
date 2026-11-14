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
class AutomationsRepository extends ChangeNotifier {
  final AutomationsModuleClient _apiClient;

  Map<String, AutomationModel> _data = {};

  AutomationsRepository({required AutomationsModuleClient apiClient})
    : _apiClient = apiClient;

  List<AutomationModel> get automations => _data.values.toList();

  AutomationModel? getAutomation(String id) => _data[id];

  /// Inserts or replaces automations from raw JSON, skipping what cannot be read.
  void insert(List<Map<String, dynamic>> jsonList) {
    final next = {..._data};

    for (final json in jsonList) {
      try {
        final automation = AutomationModel.fromJson(json);
        next[automation.id] = automation;
      } catch (e) {
        if (kDebugMode) {
          debugPrint('[AUTOMATIONS MODULE] Failed to parse automation: $e');
        }
      }
    }

    _replace(next);
  }

  void delete(String id) {
    if (!_data.containsKey(id)) return;

    _replace({..._data}..remove(id));
  }

  void clear() => _replace({});

  /// Reads every automation. The list replaces what is held, so an automation
  /// deleted while an event was missed disappears too. A failed read keeps the
  /// current list: the panel must start even when the backend refuses it.
  Future<void> fetchAll() async {
    try {
      final response = await _apiClient.getAutomationsModuleAutomations();
      final raw = response.response.data;

      if (response.response.statusCode != 200 ||
          raw is! Map ||
          raw['data'] is! List) {
        return;
      }

      final next = <String, AutomationModel>{};

      for (final item in (raw['data'] as List).whereType<Map>()) {
        try {
          final automation = AutomationModel.fromJson(
            Map<String, dynamic>.from(item),
          );
          next[automation.id] = automation;
        } catch (e) {
          if (kDebugMode) {
            debugPrint('[AUTOMATIONS MODULE] Failed to parse automation: $e');
          }
        }
      }

      _replace(next);
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

  /// Switches an automation on or off and stores what the backend answered.
  ///
  /// Throws an [AutomationToggleException] when it did not go through.
  Future<AutomationModel> setEnabled(String id, bool enabled) async {
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

      _replace({..._data, id: automation});

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

  void _replace(Map<String, AutomationModel> next) {
    if (mapEquals(_data, next)) return;

    _data = next;
    notifyListeners();
  }
}
