import 'package:flutter/material.dart';

class NavigationService {
  final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

  String? _currentRoute;

  Future<dynamic>? navigateTo(String routeName, {Object? arguments}) {
    _currentRoute = routeName;

    return navigatorKey.currentState?.pushNamed(
      routeName,
      arguments: arguments,
    );
  }

  void goBack() {
    return navigatorKey.currentState?.pop();
  }

  String? getCurrentRouteName() => _currentRoute;
}
