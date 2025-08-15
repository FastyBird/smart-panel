import 'package:fastybird_smart_panel/modules/system/export.dart';
import 'package:fastybird_smart_panel/modules/system/views/displays_profiles/view.dart';
import 'package:fastybird_smart_panel/modules/system/views/system_info/view.dart';
import 'package:fastybird_smart_panel/modules/system/views/throttle_status/view.dart';
import 'package:flutter/foundation.dart';

class SystemService extends ChangeNotifier {
  final DisplaysProfilesRepository _displaysProfilesRepository;
  final SystemInfoRepository _systemInfoRepository;
  final ThrottleStatusRepository _throttleStatusRepository;

  DisplayProfileView? _displayProfile;
  SystemInfoView? _systemInfo;
  ThrottleStatusView? _throttleStatus;

  SystemService({
    required DisplaysProfilesRepository displaysProfilesRepository,
    required SystemInfoRepository systemInfoRepository,
    required ThrottleStatusRepository throttleStatusRepository,
  })  : _displaysProfilesRepository = displaysProfilesRepository,
        _systemInfoRepository = systemInfoRepository,
        _throttleStatusRepository = throttleStatusRepository;

  Future<void> initialize(String appUid) async {
    await _displaysProfilesRepository.fetchOne(appUid);

    await _systemInfoRepository.fetchOne();

    try {
      await _throttleStatusRepository.fetchOne();
    } catch (e) {
      // This error could be ignored
    }

    _displaysProfilesRepository.addListener(_updateData);
    _systemInfoRepository.addListener(_updateData);
    _throttleStatusRepository.addListener(_updateData);

    _updateData();
  }

  DisplayProfileView? get displayProfile => _displayProfile;

  SystemInfoView? get systemInfo => _systemInfo;

  ThrottleStatusView? get throttleStatus => _throttleStatus;

  DisplayProfileView? getDisplayProfile() {
    return _displayProfile;
  }

  SystemInfoView? getSystemInfo() {
    return _systemInfo;
  }

  ThrottleStatusView? getThrottleStatus() {
    return _throttleStatus;
  }

  void _updateData() {
    final displayProfileModel = _displaysProfilesRepository.data;
    final displayProfile = displayProfileModel != null
        ? DisplayProfileView(displayProfileModel: displayProfileModel)
        : null;
    final systemInfoModel = _systemInfoRepository.data;
    final systemInfo = systemInfoModel != null
        ? SystemInfoView(systemInfoModel: systemInfoModel)
        : null;
    final throttleStatusModel = _throttleStatusRepository.data;
    final throttleStatus = throttleStatusModel != null
        ? ThrottleStatusView(throttleStatusModel: throttleStatusModel)
        : null;

    late bool triggerNotifyListeners = false;

    if (_displayProfile != displayProfile) {
      _displayProfile = displayProfile;

      triggerNotifyListeners = true;
    }

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
    super.dispose();

    _displaysProfilesRepository.removeListener(_updateData);
    _systemInfoRepository.removeListener(_updateData);
    _throttleStatusRepository.removeListener(_updateData);
  }
}
