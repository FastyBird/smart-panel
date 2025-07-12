import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/app/routes.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/factory_reset_in_progress.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/power_off_in_progress.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_done.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_error.dart';
import 'package:fastybird_smart_panel/modules/system/events/reboot_in_progress.dart';

class SystemActionsService {
  final EventBus _eventBus;

  StreamSubscription? _rebootInProgressSub;
  StreamSubscription? _rebootDoneSub;
  StreamSubscription? _rebootErrorSub;

  StreamSubscription? _powerOffInProgressSub;
  StreamSubscription? _powerOffDoneSub;
  StreamSubscription? _powerOffErrorSub;

  StreamSubscription? _factoryResetInProgressSub;
  StreamSubscription? _factoryResetDoneSub;
  StreamSubscription? _factoryResetErrorSub;

  SystemActionsService(this._eventBus);

  void init() {
    _rebootInProgressSub = _eventBus.on<RebootInProgressEvent>().listen(
      (event) {
        _openScreen(AppRouteNames.reboot);
      },
    );

    _rebootDoneSub = _eventBus.on<RebootDoneEvent>().listen(
      (event) {
        _closeScreen(AppRouteNames.reboot, delay: 10000);
      },
    );

    _rebootErrorSub = _eventBus.on<RebootErrorEvent>().listen(
      (event) {
        _closeScreen(AppRouteNames.reboot);
      },
    );

    _powerOffInProgressSub = _eventBus.on<PowerOffInProgressEvent>().listen(
      (event) {
        _openScreen(AppRouteNames.powerOff);
      },
    );

    _powerOffDoneSub = _eventBus.on<PowerOffDoneEvent>().listen(
      (event) {
        _closeScreen(AppRouteNames.powerOff, delay: 10000);
      },
    );

    _powerOffErrorSub = _eventBus.on<PowerOffErrorEvent>().listen(
      (event) {
        _closeScreen(AppRouteNames.powerOff);
      },
    );

    _factoryResetInProgressSub =
        _eventBus.on<FactoryResetInProgressEvent>().listen(
      (event) {
        _openScreen(AppRouteNames.factoryReset);
      },
    );

    _factoryResetDoneSub = _eventBus.on<FactoryResetDoneEvent>().listen(
      (event) {
        _closeScreen(AppRouteNames.factoryReset, delay: 10000);
      },
    );

    _factoryResetErrorSub = _eventBus.on<FactoryResetErrorEvent>().listen(
      (event) {
        _closeScreen(AppRouteNames.factoryReset);
      },
    );
  }

  void dispose() {
    _rebootInProgressSub?.cancel();
    _rebootDoneSub?.cancel();
    _rebootErrorSub?.cancel();

    _powerOffInProgressSub?.cancel();
    _powerOffDoneSub?.cancel();
    _powerOffErrorSub?.cancel();

    _factoryResetInProgressSub?.cancel();
    _factoryResetDoneSub?.cancel();
    _factoryResetErrorSub?.cancel();
  }

  void _openScreen(String route) {
    final currentRoute = locator<NavigationService>().getCurrentRouteName();

    if (currentRoute != route) {
      locator<NavigationService>().navigateTo(route);
    }
  }

  void _closeScreen(String route, {int delay = 2000}) {
    final currentRoute = locator<NavigationService>().getCurrentRouteName();

    if (currentRoute == route) {
      Future.delayed(
        Duration(milliseconds: delay),
        () {
          locator<NavigationService>().goBack();
        },
      );
    }
  }
}
