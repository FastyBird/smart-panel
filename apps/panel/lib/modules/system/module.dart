import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/platform_actions.dart';
import 'package:fastybird_smart_panel/core/utils/application.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/displays/module.dart';
import 'package:fastybird_smart_panel/modules/system/constants.dart';
import 'package:fastybird_smart_panel/modules/system/export.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_in_progress.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_in_progress.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_in_progress.dart';
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

  late SystemService _systemService;

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

    _systemService = SystemService(
      systemInfoRepository: _systemInfoRepository,
      throttleStatusRepository: _throttleStatusRepository,
    );

    locator.registerSingleton(_systemInfoRepository);
    locator.registerSingleton(_throttleStatusRepository);

    locator.registerSingleton(_systemService);

    // Connect the error reporter so buffered errors can be flushed to the backend
    ErrorReporter.instance.setApiClient(apiClient.systemModule);
  }

  Future<void> initialize(String appUid) async {
    _isLoading = true;

    // Set app version on the error reporter for log context
    try {
      final version = await AppInfo.getAppVersionInfo();
      ErrorReporter.instance.setAppVersion(version.toString());
    } catch (_) {
      // App version is optional context — ignore failures
    }

    // Register system config model with config module
    final configModule = locator<ConfigModuleService>();
    configModule.registerModule<SystemConfigModel>(
      'system-module',
      SystemConfigModel.fromJson,
      updateHandler: _updateSystemConfig,
    );

    // System config is now managed by config module
    // No need to create wrapper or register separately
    await _systemService.initialize(appUid);

    _isLoading = false;

    _socketService.registerEventHandler(
      SystemModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    if (kDebugMode) {
      debugPrint(
        '[SYSTEM MODULE][MODULE] Module was successfully initialized',
      );
    }
  }

  Future<bool> _updateSystemConfig(String name, Map<String, dynamic> data) async {
    // Custom update handler for system config
    try {
      final configModule = locator<ConfigModuleService>();
      final repo = configModule.getModuleRepository<SystemConfigModel>(name);

      // Build update data with all current fields
      final currentConfig = repo.data;
      if (currentConfig == null) {
        if (kDebugMode) {
          debugPrint(
            '[SYSTEM MODULE] Cannot update config: current configuration is null',
          );
        }
        return false;
      }

      final updateDataMap = <String, dynamic>{
        'type': name,
        'language': data['language'] ?? _convertLanguageToApiString(currentConfig.language),
        'timezone': data['timezone'] ?? currentConfig.timezone,
        'time_format': data['time_format'] ?? _convertTimeFormatToApiString(currentConfig.timeFormat),
        if (data.containsKey('log_levels')) 'log_levels': data['log_levels'],
      };

      // Use the repository's raw update method to avoid infinite recursion
      return await repo.updateConfigurationRaw(updateDataMap);
    } catch (e, stackTrace) {
      if (kDebugMode) {
        debugPrint(
          '[SYSTEM MODULE] Error updating system config: ${e.toString()}',
        );
        debugPrint('[SYSTEM MODULE] Stack trace: $stackTrace');
      }
      return false;
    }
  }

  String _convertLanguageToApiString(Language language) {
    return language.value;
  }

  String _convertTimeFormatToApiString(TimeFormat timeFormat) {
    return timeFormat.value;
  }

  bool get isLoading => _isLoading;

  /// Re-fetch system info and throttle status.
  Future<void> refresh() async {
    await _systemInfoRepository.fetchOne();

    try {
      await _throttleStatusRepository.fetchOne();
    } catch (_) {
      // Throttle status may not be available
    }
  }

  void dispose() {
    _socketService.unregisterEventHandler(
      SystemModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    ErrorReporter.instance.clearApiClient();

    if (locator.isRegistered<SystemService>()) {
      locator.unregister<SystemService>();
    }
    if (locator.isRegistered<ThrottleStatusRepository>()) {
      locator.unregister<ThrottleStatusRepository>();
    }
    if (locator.isRegistered<SystemInfoRepository>()) {
      locator.unregister<SystemInfoRepository>();
    }
  }

  /// Check if the system is in gateway mode (display is separate from backend)
  bool get _isGatewayMode {
    try {
      final displaysModule = locator<DisplaysModuleService>();
      return displaysModule.isGatewayMode;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SYSTEM MODULE] Could not determine deployment mode, defaulting to all-in-one: $e',
        );
      }
      return false;
    }
  }

  /// Reboot the device.
  ///
  /// In all-in-one mode: sends command to backend (reboots shared device).
  /// In gateway mode: executes reboot locally on the display device.
  Future<bool> rebootDevice() {
    if (_isGatewayMode) {
      return _rebootDisplayLocally();
    }

    return _rebootViaBackend();
  }

  /// Power off the device.
  ///
  /// In all-in-one mode: sends command to backend (powers off shared device).
  /// In gateway mode: executes power off locally on the display device.
  Future<bool> powerOffDevice() {
    if (_isGatewayMode) {
      return _powerOffDisplayLocally();
    }

    return _powerOffViaBackend();
  }

  /// Factory reset the device.
  ///
  /// In all-in-one mode: sends command to backend (resets backend + panel).
  /// In gateway mode: unregisters display from the backend, then resets local data.
  Future<bool> factoryResetDevice() {
    if (_isGatewayMode) {
      return _factoryResetDisplay();
    }

    return _factoryResetViaBackend();
  }

  // ---- All-in-one mode methods (existing behavior) ----

  Future<bool> _rebootViaBackend() {
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

  Future<bool> _powerOffViaBackend() {
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

  Future<bool> _factoryResetViaBackend() {
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

  // ---- Gateway mode methods (display-specific) ----

  Future<bool> _rebootDisplayLocally() async {
    try {
      if (kDebugMode) {
        debugPrint('[SYSTEM MODULE] Rebooting display locally (gateway mode)');
      }

      _eventBus.fire(RebootInProgressEvent());

      final platformActions = PlatformActionsService();
      final success = await platformActions.reboot();

      if (!success) {
        _eventBus.fire(RebootErrorEvent());
        return false;
      }

      // If reboot command succeeded, the device will reboot shortly
      _eventBus.fire(RebootDoneEvent());
      return true;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SYSTEM MODULE] Local reboot failed: $e');
      }
      _eventBus.fire(RebootErrorEvent());
      return false;
    }
  }

  Future<bool> _powerOffDisplayLocally() async {
    try {
      if (kDebugMode) {
        debugPrint('[SYSTEM MODULE] Powering off display locally (gateway mode)');
      }

      _eventBus.fire(PowerOffInProgressEvent());

      final platformActions = PlatformActionsService();
      final success = await platformActions.powerOff();

      if (!success) {
        _eventBus.fire(PowerOffErrorEvent());
        return false;
      }

      // If power off command succeeded, the device will power off shortly
      _eventBus.fire(PowerOffDoneEvent());
      return true;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SYSTEM MODULE] Local power off failed: $e');
      }
      _eventBus.fire(PowerOffErrorEvent());
      return false;
    }
  }

  Future<bool> _factoryResetDisplay() async {
    try {
      if (kDebugMode) {
        debugPrint(
          '[SYSTEM MODULE] Factory resetting display (gateway mode) - unregistering from backend',
        );
      }

      _eventBus.fire(FactoryResetInProgressEvent());

      // Send the display factory reset command to the backend
      // This will unregister the display and revoke its tokens
      final completer = Completer<bool>();

      _socketService.sendCommand(
        SystemModuleConstants.displayFactoryResetSetEvent,
        null,
        SystemModuleEventHandlerName.systemInternalDisplayAction,
        onAck: (SocketCommandResponseModel? result) {
          bool success = !(result == null || result.status == false);

          if (kDebugMode) {
            debugPrint(
              success
                  ? '[SYSTEM MODULE] Display factory reset command acknowledged'
                  : '[SYSTEM MODULE] Display factory reset command failed',
            );
          }

          completer.complete(success);
        },
      );

      final success = await completer.future;

      if (!success) {
        _eventBus.fire(FactoryResetErrorEvent());
        return false;
      }

      // The backend will delete the display and revoke tokens.
      // The display deleted event handler in DisplaysModuleService will
      // trigger resetToDiscovery() which clears local data.
      _eventBus.fire(FactoryResetDoneEvent());

      // As a fallback, also explicitly trigger reset to discovery
      try {
        final startupManager = locator.get<StartupManagerService>();
        startupManager.resetToDiscovery();
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SYSTEM MODULE] Could not trigger resetToDiscovery: $e',
          );
        }
      }

      return true;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SYSTEM MODULE] Display factory reset failed: $e');
      }
      _eventBus.fire(FactoryResetErrorEvent());
      return false;
    }
  }

  // ---- Socket event handling ----

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    if (event == SystemModuleConstants.systemInfoEvent) {
      _systemInfoRepository.insert(payload);
    } else if (event == SystemModuleConstants.systemRebootEvent ||
        event == SystemModuleConstants.systemPowerOffEvent ||
        event == SystemModuleConstants.systemFactoryResetEvent) {
      _handleSystemActionEvent(event, payload);
    } else if (event == SystemModuleConstants.displayRebootEvent ||
        event == SystemModuleConstants.displayPowerOffEvent ||
        event == SystemModuleConstants.displayFactoryResetEvent) {
      _handleDisplayActionEvent(event, payload);
    }
  }

  void _handleSystemActionEvent(String event, Map<String, dynamic> payload) {
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

  void _handleDisplayActionEvent(String event, Map<String, dynamic> payload) {
    SystemActionModel status = SystemActionModel.fromJson(payload);

    if (event == SystemModuleConstants.displayRebootEvent) {
      if (status.status == 'processing') {
        if (kDebugMode) {
          debugPrint('[SYSTEM MODULE] Display reboot event received - executing local reboot');
        }

        // The backend confirmed the reboot - execute it locally
        _eventBus.fire(RebootInProgressEvent());

        final platformActions = PlatformActionsService();
        platformActions.reboot().then((success) {
          if (!success) {
            _eventBus.fire(RebootErrorEvent());
          }
        });
      }
    } else if (event == SystemModuleConstants.displayPowerOffEvent) {
      if (status.status == 'processing') {
        if (kDebugMode) {
          debugPrint('[SYSTEM MODULE] Display power off event received - executing local power off');
        }

        // The backend confirmed the power off - execute it locally
        _eventBus.fire(PowerOffInProgressEvent());

        final platformActions = PlatformActionsService();
        platformActions.powerOff().then((success) {
          if (!success) {
            _eventBus.fire(PowerOffErrorEvent());
          }
        });
      }
    } else if (event == SystemModuleConstants.displayFactoryResetEvent) {
      if (status.status == 'processing') {
        if (kDebugMode) {
          debugPrint(
            '[SYSTEM MODULE] Display factory reset event received from gateway - resetting locally',
          );
        }

        // Gateway initiated factory reset for this display
        _eventBus.fire(FactoryResetInProgressEvent());

        // The DisplaysModuleService will handle the display deleted event
        // and trigger resetToDiscovery(). We just fire the UI event here.
        _eventBus.fire(FactoryResetDoneEvent());

        // Trigger reset to discovery state
        try {
          final startupManager = locator.get<StartupManagerService>();
          startupManager.resetToDiscovery();
        } catch (e) {
          if (kDebugMode) {
            debugPrint(
              '[SYSTEM MODULE] Could not trigger resetToDiscovery: $e',
            );
          }
        }
      }
    }
  }
}
