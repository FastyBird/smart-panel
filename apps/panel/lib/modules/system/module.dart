import 'dart:async';

import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/system/constants.dart';
import 'package:fastybird_smart_panel/modules/system/export.dart';
import 'package:flutter/foundation.dart';

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

  Future<bool> rebootDevice() {
    final completer = Completer<bool>();

    _socketService.sendCommand(
      SystemModuleConstants.systemRebootEvent,
      null,
      SystemModuleEventHandlerName.systemInternalPlatformAction,
      onAck: (SocketCommandResponseModel? result) {
        bool success = !(result == null || result.status == false);

        if (kDebugMode) {
          debugPrint(
            success
                ? '[SYSTEM MODULE] Successfully process reboot request command'
                : '[SYSTEM MODULE] Failed process reboot request command',
          );
        }

        completer.complete(success);
      },
    );

    return completer.future;
  }

  Future<bool> powerOffDevice() {
    final completer = Completer<bool>();

    _socketService.sendCommand(
      SystemModuleConstants.systemPowerOffEvent,
      null,
      SystemModuleEventHandlerName.systemInternalPlatformAction,
      onAck: (SocketCommandResponseModel? result) {
        bool success = !(result == null || result.status == false);

        if (kDebugMode) {
          debugPrint(
            success
                ? '[SYSTEM MODULE] Successfully process power off request command'
                : '[SYSTEM MODULE] Failed process power off request command',
          );
        }

        completer.complete(success);
      },
    );

    return completer.future;
  }

  Future<bool> factoryResetDevice() {
    final completer = Completer<bool>();

    _socketService.sendCommand(
      SystemModuleConstants.systemFactoryResetEvent,
      null,
      SystemModuleEventHandlerName.systemInternalPlatformAction,
      onAck: (SocketCommandResponseModel? result) {
        bool success = !(result == null || result.status == false);

        if (kDebugMode) {
          debugPrint(
            success
                ? '[SYSTEM MODULE] Successfully process factory reset request command'
                : '[SYSTEM MODULE] Failed process factory reset request command',
          );
        }

        completer.complete(success);
      },
    );

    return completer.future;
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
