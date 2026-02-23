import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/features/overlay/types/overlay.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_in_progress.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_in_progress.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_in_progress.dart';

/// System action types for overlay display.
enum SystemActionType {
  reboot,
  powerOff,
  factoryReset,
}

/// Overlay ID for system action overlays.
class SystemActionOverlayIds {
  static const String action = 'system:action';
}

/// Bridges system action events with [OverlayManager].
///
/// Listens to [EventBus] for reboot, power off, and factory reset events
/// and shows/hides a full-screen overlay accordingly.
class SystemActionsOverlayProvider {
  final OverlayManager _overlayManager;
  final EventBus _eventBus;

  bool _isInitialized = false;
  Timer? _hideTimer;

  StreamSubscription? _rebootInProgressSub;
  StreamSubscription? _rebootDoneSub;
  StreamSubscription? _rebootErrorSub;

  StreamSubscription? _powerOffInProgressSub;
  StreamSubscription? _powerOffDoneSub;
  StreamSubscription? _powerOffErrorSub;

  StreamSubscription? _factoryResetInProgressSub;
  StreamSubscription? _factoryResetDoneSub;
  StreamSubscription? _factoryResetErrorSub;

  SystemActionsOverlayProvider({
    required OverlayManager overlayManager,
    required EventBus eventBus,
  })  : _overlayManager = overlayManager,
        _eventBus = eventBus;

  /// Initialize by registering the overlay entry and subscribing to events.
  void init() {
    if (_isInitialized) return;
    _isInitialized = true;

    _overlayManager.register(AppOverlayEntry(
      id: SystemActionOverlayIds.action,
      displayType: OverlayDisplayType.fullScreen,
      priority: 300,
      showProgress: true,
      colorScheme: OverlayColorScheme.primary,
    ));

    _rebootInProgressSub = _eventBus.on<RebootInProgressEvent>().listen((_) {
      _showAction(SystemActionType.reboot);
    });
    _rebootDoneSub = _eventBus.on<RebootDoneEvent>().listen((_) {
      _hideAction(delay: const Duration(seconds: 10));
    });
    _rebootErrorSub = _eventBus.on<RebootErrorEvent>().listen((_) {
      _hideAction(delay: const Duration(seconds: 2));
    });

    _powerOffInProgressSub =
        _eventBus.on<PowerOffInProgressEvent>().listen((_) {
      _showAction(SystemActionType.powerOff);
    });
    _powerOffDoneSub = _eventBus.on<PowerOffDoneEvent>().listen((_) {
      _hideAction(delay: const Duration(seconds: 10));
    });
    _powerOffErrorSub = _eventBus.on<PowerOffErrorEvent>().listen((_) {
      _hideAction(delay: const Duration(seconds: 2));
    });

    _factoryResetInProgressSub =
        _eventBus.on<FactoryResetInProgressEvent>().listen((_) {
      _showAction(SystemActionType.factoryReset);
    });
    _factoryResetDoneSub = _eventBus.on<FactoryResetDoneEvent>().listen((_) {
      _hideAction(delay: const Duration(seconds: 10));
    });
    _factoryResetErrorSub =
        _eventBus.on<FactoryResetErrorEvent>().listen((_) {
      _hideAction(delay: const Duration(seconds: 2));
    });
  }

  /// Clean up listeners and unregister overlay.
  void dispose() {
    if (!_isInitialized) return;
    _isInitialized = false;

    _rebootInProgressSub?.cancel();
    _rebootDoneSub?.cancel();
    _rebootErrorSub?.cancel();

    _powerOffInProgressSub?.cancel();
    _powerOffDoneSub?.cancel();
    _powerOffErrorSub?.cancel();

    _factoryResetInProgressSub?.cancel();
    _factoryResetDoneSub?.cancel();
    _factoryResetErrorSub?.cancel();

    _hideTimer?.cancel();
    _hideTimer = null;

    _overlayManager.unregister(SystemActionOverlayIds.action);
  }

  void _showAction(SystemActionType actionType) {
    _hideTimer?.cancel();
    _hideTimer = null;

    final (title, message) = _getMessages(actionType);

    _overlayManager.show(
      SystemActionOverlayIds.action,
      displayType: OverlayDisplayType.fullScreen,
      closable: false,
      showProgress: true,
      colorScheme: OverlayColorScheme.primary,
      title: title,
      message: message,
    );
  }

  (LocalizedString, LocalizedString) _getMessages(SystemActionType actionType) {
    return switch (actionType) {
      SystemActionType.reboot => (
        (l) => l.message_info_app_reboot_title,
        (l) => l.message_info_app_reboot_description,
      ),
      SystemActionType.powerOff => (
        (l) => l.message_info_app_power_off_title,
        (l) => l.message_info_app_power_off_description,
      ),
      SystemActionType.factoryReset => (
        (l) => l.message_info_factory_reset_title,
        (l) => l.message_info_factory_reset_description,
      ),
    };
  }

  void _hideAction({Duration delay = Duration.zero}) {
    _hideTimer?.cancel();

    if (delay == Duration.zero) {
      _hideTimer = null;
      _overlayManager.hide(SystemActionOverlayIds.action);
    } else {
      _hideTimer = Timer(delay, () {
        _hideTimer = null;
        _overlayManager.hide(SystemActionOverlayIds.action);
      });
    }
  }
}
