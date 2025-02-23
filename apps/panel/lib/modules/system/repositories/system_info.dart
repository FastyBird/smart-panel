import 'package:fastybird_smart_panel/api/models/system_system_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/system_info.dart';
import 'package:fastybird_smart_panel/modules/system/repositories/repository.dart';

class SystemInfoRepository extends Repository<SystemInfoModel> {
  SystemInfoRepository({required super.apiClient});

  Future<bool> refresh() async {
    try {
      await fetchSystemInfo();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> insertSystemInfo(SystemSystemInfo apiSystemInfo) async {
    data = SystemInfoModel.fromJson({
      'cpu_load': apiSystemInfo.cpuLoad,
      'memory': {
        'total': apiSystemInfo.memory.total,
        'used': apiSystemInfo.memory.used,
        'free': apiSystemInfo.memory.free,
      },
      'storage': apiSystemInfo.storage
          .map((item) => {
                'fs': item.fs,
                'used': item.used,
                'size': item.size,
                'available': item.available,
              })
          .toList(),
      'temperature': {
        'cpu': apiSystemInfo.temperature.cpu,
        'gpu': apiSystemInfo.temperature.gpu,
      },
      'os': {
        'platform': apiSystemInfo.os.platform,
        'distro': apiSystemInfo.os.distro,
        'release': apiSystemInfo.os.release,
        'uptime': apiSystemInfo.os.uptime,
      },
      'network': apiSystemInfo.network
          .map((item) => {
                'interface': item.interfaceValue,
                'rx_bytes': item.rxBytes,
                'tx_bytes': item.txBytes,
              })
          .toList(),
      'default_network': {
        'interface': apiSystemInfo.defaultNetwork.interfaceValue,
        'ip4': apiSystemInfo.defaultNetwork.ip4,
        'ip6': apiSystemInfo.defaultNetwork.ip6,
        'mac': apiSystemInfo.defaultNetwork.mac,
      },
      'display': {
        'resolution_x': apiSystemInfo.display.resolutionX,
        'resolution_y': apiSystemInfo.display.resolutionY,
        'current_res_x': apiSystemInfo.display.currentResX,
        'current_res_y': apiSystemInfo.display.currentResY,
      },
    });

    notifyListeners();
  }

  Future<void> fetchSystemInfo() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getSystemModuleSystemInfo();

        insertSystemInfo(response.data.data);
      },
      'fetch system info',
    );
  }
}
