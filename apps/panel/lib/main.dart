import 'dart:ui';

import 'package:fastybird_smart_panel/app/app.dart';
import 'package:fastybird_smart_panel/core/services/error_reporter.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Capture Flutter framework errors (layout, rendering, etc.)
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    ErrorReporter.instance.reportFlutterError(details);
  };

  // Capture uncaught async / platform errors
  PlatformDispatcher.instance.onError = (error, stack) {
    ErrorReporter.instance.reportPlatformError(error, stack);
    return true;
  };

  // Enable fullscreen mode
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersive);

  runApp(MyApp());
}
