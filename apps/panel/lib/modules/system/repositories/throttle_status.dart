import 'package:fastybird_smart_panel/modules/system/models/throttle_status.dart';
import 'package:fastybird_smart_panel/modules/system/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class ThrottleStatusRepository extends Repository<ThrottleStatusModel> {
  ThrottleStatusRepository({required super.apiClient});

  Future<bool> refresh() async {
    try {
      await fetchThrottleStatus();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> insertThrottleStatus(Map<String, dynamic> json) async {
    try {
      ThrottleStatusModel newData = ThrottleStatusModel.fromJson(json);

      if (data != newData) {
        if (kDebugMode) {
          debugPrint(
            '[SYSTEM MODULE] Throttle info was successfully updated',
          );
        }

        data = newData;

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SYSTEM MODULE] Throttle info model could not be created',
        );
      }

      /// Failed to create new model
    }
  }

  Future<void> fetchThrottleStatus() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getSystemModuleSystemThrottle();

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insertThrottleStatus(raw);
      },
      'fetch throttle status',
    );
  }
}
