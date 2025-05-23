import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/system/constants.dart';
import 'package:fastybird_smart_panel/modules/system/export.dart';

class SystemModuleService {
  final SocketService _socketService;

  late SystemInfoRepository _systemInfoRepository;
  late ThrottleStatusRepository _throttleStatusRepository;

  bool _isLoading = true;

  SystemModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  }) : _socketService = socketService {
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

    _socketService.registerEventHandler(
      SystemModuleConstants.systemInfoEvent,
      _socketEventHandler,
    );
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      SystemModuleConstants.systemInfoEvent,
      _socketEventHandler,
    );
  }

  Future<void> _initializeSystemData() async {
    await _systemInfoRepository.fetchSystemInfo();

    try {
      await _throttleStatusRepository.fetchThrottleStatus();
    } catch (e) {
      // This error could be ignored
    }
  }

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    _systemInfoRepository.insertSystemInfo(payload);
  }
}
