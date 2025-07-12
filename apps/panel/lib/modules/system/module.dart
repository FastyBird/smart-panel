import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/system/constants.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_in_progress.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_in_progress.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_in_progress.dart';
import 'package:fastybird_smart_panel/modules/system/export.dart';
import 'package:fastybird_smart_panel/modules/system/models/system_action.dart';
import 'package:flutter/foundation.dart';

class SystemModuleService {
  final SocketService _socketService;
  final EventBus _eventBus;

  late SystemInfoRepository _systemInfoRepository;
  late ThrottleStatusRepository _throttleStatusRepository;

  late bool processingReboot = false;
  late bool processingPowerOff = false;
  late bool processingFactoryReset = false;

  bool _isLoading = true;

  SystemModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
    required EventBus eventBus,
  })  : _socketService = socketService,
        _eventBus = eventBus {
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
      SystemModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      SystemModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
  }

  Future<bool> rebootDevice() {
    final completer = Completer<bool>();

    _socketService.sendCommand(
      SystemModuleConstants.systemRebootSetEvent,
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
      SystemModuleConstants.systemPowerOffSetEvent,
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
      SystemModuleConstants.systemFactoryResetSetEvent,
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
    if (event == SystemModuleConstants.systemInfoEvent) {
      _systemInfoRepository.insertSystemInfo(payload);
    } else if (event == SystemModuleConstants.systemRebootEvent ||
        event == SystemModuleConstants.systemPowerOffEvent ||
        event == SystemModuleConstants.systemFactoryResetEvent) {
      SystemActionModel status = SystemActionModel.fromJson(payload);

      if (event == SystemModuleConstants.systemRebootEvent) {
        if (status.status == 'processing') {
          if (kDebugMode) {
            debugPrint(
              '[SYSTEM MODULE] System is rebooting',
            );
          }

          processingReboot = true;

          _eventBus.fire(RebootInProgressEvent());
        } else if (processingReboot == true) {
          processingReboot = false;

          _eventBus.fire(
            status.status == 'ok' ? RebootDoneEvent() : RebootErrorEvent(),
          );
        }
      } else if (event == SystemModuleConstants.systemPowerOffEvent) {
        if (status.status == 'processing') {
          if (kDebugMode) {
            debugPrint(
              '[SYSTEM MODULE] System is powering off',
            );
          }

          processingPowerOff = true;

          _eventBus.fire(PowerOffInProgressEvent());
        } else if (processingPowerOff == true) {
          processingPowerOff = false;

          _eventBus.fire(
            status.status == 'ok' ? PowerOffDoneEvent() : PowerOffErrorEvent(),
          );
        }
      } else if (event == SystemModuleConstants.systemFactoryResetEvent) {
        if (status.status == 'processing') {
          if (kDebugMode) {
            debugPrint(
              '[SYSTEM MODULE] System is reset to factory state',
            );
          }

          processingFactoryReset = true;

          _eventBus.fire(FactoryResetInProgressEvent());
        } else if (processingFactoryReset == true) {
          processingFactoryReset = false;

          _eventBus.fire(
            status.status == 'ok'
                ? FactoryResetDoneEvent()
                : FactoryResetErrorEvent(),
          );
        }
      }
    }
  }
}
