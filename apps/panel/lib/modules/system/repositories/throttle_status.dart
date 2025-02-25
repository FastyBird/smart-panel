import 'dart:convert';

import 'package:fastybird_smart_panel/modules/system/models/throttle_status.dart';
import 'package:fastybird_smart_panel/modules/system/repositories/repository.dart';

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
    data = ThrottleStatusModel.fromJson(json);

    notifyListeners();
  }

  Future<void> fetchThrottleStatus() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getSystemModuleSystemThrottle();

        insertThrottleStatus(jsonDecode(jsonEncode(response.data.data)));
      },
      'fetch throttle status',
    );
  }
}
