import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/system/repositories/export.dart';

class SystemModuleService {
  late SystemInfoRepository _systemInfoRepository;
  late ThrottleStatusRepository _throttleStatusRepository;

  bool _isLoading = true;

  SystemModuleService({
    required ApiClient apiClient,
  }) {
    _systemInfoRepository = SystemInfoRepository(
      apiClient: apiClient.systemModule,
    );
    _throttleStatusRepository = ThrottleStatusRepository(
      apiClient: apiClient.systemModule,
    );

    locator.registerSingleton(_systemInfoRepository);
    locator.registerSingleton(_throttleStatusRepository);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _initializeSystemData();

    _isLoading = false;
  }

  bool get isLoading => _isLoading;

  Future<void> _initializeSystemData() async {
    await _systemInfoRepository.fetchSystemInfo();

    try {
      await _throttleStatusRepository.fetchThrottleStatus();
    } catch (e) {
      // This error could be ignored
    }
  }
}
