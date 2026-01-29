import 'dart:async';

import 'package:fastybird_smart_panel/modules/system/export.dart';
import 'package:fastybird_smart_panel/modules/system/views/system_info/view.dart';
import 'package:fastybird_smart_panel/modules/system/views/throttle_status/view.dart';
import 'package:flutter/foundation.dart';

class SystemService extends ChangeNotifier {
  final SystemInfoRepository _systemInfoRepository;
  final ThrottleStatusRepository _throttleStatusRepository;

  SystemInfoView? _systemInfo;
  ThrottleStatusView? _throttleStatus;

  Timer? _updateDebounce;

  SystemService({
    required SystemInfoRepository systemInfoRepository,
    required ThrottleStatusRepository throttleStatusRepository,
  })  : _systemInfoRepository = systemInfoRepository,
        _throttleStatusRepository = throttleStatusRepository;

  Future<void> initialize(String appUid) async {
    await _systemInfoRepository.fetchOne();

    try {
      await _throttleStatusRepository.fetchOne();
    } catch (e) {
      // This error could be ignored
    }

    _systemInfoRepository.addListener(_scheduleUpdate);
    _throttleStatusRepository.addListener(_scheduleUpdate);

    _updateData();
  }

  SystemInfoView? get systemInfo => _systemInfo;

  ThrottleStatusView? get throttleStatus => _throttleStatus;

  SystemInfoView? getSystemInfo() {
    return _systemInfo;
  }

  ThrottleStatusView? getThrottleStatus() {
    return _throttleStatus;
  }

  void _scheduleUpdate() {
    _updateDebounce?.cancel();
    _updateDebounce = Timer(const Duration(milliseconds: 50), _updateData);
  }

  void _updateData() {
    final systemInfoModel = _systemInfoRepository.data;
    final systemInfo = systemInfoModel != null
        ? SystemInfoView(systemInfoModel: systemInfoModel)
        : null;
    final throttleStatusModel = _throttleStatusRepository.data;
    final throttleStatus = throttleStatusModel != null
        ? ThrottleStatusView(throttleStatusModel: throttleStatusModel)
        : null;

    late bool triggerNotifyListeners = false;

    if (_systemInfo != systemInfo) {
      _systemInfo = systemInfo;

      triggerNotifyListeners = true;
    }

    if (_throttleStatus != throttleStatus) {
      _throttleStatus = throttleStatus;

      triggerNotifyListeners = true;
    }

    if (triggerNotifyListeners) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _updateDebounce?.cancel();

    _systemInfoRepository.removeListener(_scheduleUpdate);
    _throttleStatusRepository.removeListener(_scheduleUpdate);

    super.dispose();
  }
}
