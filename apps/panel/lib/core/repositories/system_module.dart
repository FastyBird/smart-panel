import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/system_system_info.dart';
import 'package:fastybird_smart_panel/api/models/system_throttle_status.dart';
import 'package:fastybird_smart_panel/api/system_module/system_module_client.dart';
import 'package:fastybird_smart_panel/core/models/general/system.dart';
import 'package:flutter/foundation.dart';

class SystemModuleRepository extends ChangeNotifier {
  final SystemModuleClient _apiClient;

  late SystemInfoModel _systemInfo;
  late ThrottleStatusModel? _throttleStatus;

  bool _isLoading = true;

  SystemModuleRepository({
    required SystemModuleClient apiClient,
  }) : _apiClient = apiClient;

  Future<void> initialize() async {
    _isLoading = true;

    await _loadSystemInfo();

    await _loadThrottleStatus();

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  SystemInfoModel get systemInfo => _systemInfo;

  ThrottleStatusModel? get throttleStatus => _throttleStatus;

  Future<bool> refresh() async {
    try {
      await _loadSystemInfo();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> _loadSystemInfo() async {
    var resSystemInfo = await _fetchSystemInfo();

    _systemInfo = SystemInfoModel.fromJson({
      'cpu_load': resSystemInfo.cpuLoad,
      'memory': {
        'total': resSystemInfo.memory.total,
        'used': resSystemInfo.memory.used,
        'free': resSystemInfo.memory.free,
      },
      'storage': resSystemInfo.storage
          .map((item) => {
                'fs': item.fs,
                'used': item.used,
                'size': item.size,
                'available': item.available,
              })
          .toList(),
      'temperature': {
        'cpu': resSystemInfo.temperature.cpu,
        'gpu': resSystemInfo.temperature.gpu,
      },
      'os': {
        'platform': resSystemInfo.os.platform,
        'distro': resSystemInfo.os.distro,
        'release': resSystemInfo.os.release,
        'uptime': resSystemInfo.os.uptime,
      },
      'network': resSystemInfo.network
          .map((item) => {
                'interface': item.interfaceValue,
                'rx_bytes': item.rxBytes,
                'tx_bytes': item.txBytes,
              })
          .toList(),
      'display': {
        'resolution_x': resSystemInfo.display.resolutionX,
        'resolution_y': resSystemInfo.display.resolutionY,
        'current_res_x': resSystemInfo.display.currentResX,
        'current_res_y': resSystemInfo.display.currentResY,
      },
    });
  }

  Future<void> _loadThrottleStatus() async {
    try {
      var resThrottleStatus = await _fetchThrottleStatus();

      _throttleStatus = ThrottleStatusModel.fromJson({
        'undervoltage': resThrottleStatus.undervoltage,
        'frequency_capping': resThrottleStatus.frequencyCapping,
        'throttling': resThrottleStatus.throttling,
        'soft_temp_limit': resThrottleStatus.softTempLimit,
      });
    } catch (e) {
      // Could be ignored
    }
  }

  Future<SystemSystemInfo> _fetchSystemInfo() async {
    return _handleApiCall(
      () async {
        final response = await _apiClient.getSystemModuleSystemInfo();

        return response.data.data;
      },
      'fetch system info',
    );
  }

  Future<SystemThrottleStatus> _fetchThrottleStatus() async {
    return _handleApiCall(
      () async {
        final response = await _apiClient.getSystemModuleSystemThrottle();

        return response.data.data;
      },
      'fetch throttle status',
    );
  }

  Future<T> _handleApiCall<T>(
    Future<T> Function() apiCall,
    String operation,
  ) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to call backend service');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
