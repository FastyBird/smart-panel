import 'package:fastybird_smart_panel/api/models/system_throttle_status.dart';
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

  Future<void> insertThrottleStatus(
    SystemThrottleStatus apiThrottleStatus,
  ) async {
    data = ThrottleStatusModel.fromJson({
      'undervoltage': apiThrottleStatus.undervoltage,
      'frequency_capping': apiThrottleStatus.frequencyCapping,
      'throttling': apiThrottleStatus.throttling,
      'soft_temp_limit': apiThrottleStatus.softTempLimit,
    });

    notifyListeners();
  }

  Future<void> fetchThrottleStatus() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getSystemModuleSystemThrottle();

        insertThrottleStatus(response.data.data);
      },
      'fetch throttle status',
    );
  }
}
