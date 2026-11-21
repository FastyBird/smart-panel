import 'package:fastybird_smart_panel/app/app.dart';
import 'package:fastybird_smart_panel/modules/system/services/error_reporter.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Capture Flutter framework errors (layout, rendering, etc.)
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    try {
      ErrorReporter.instance.reportFlutterError(details);
    } catch (_) {
      // Never throw from a reporter — avoid infinite recursion.
    }
  };

  // Capture uncaught async / platform errors
  PlatformDispatcher.instance.onError = (error, stack) {
    try {
      ErrorReporter.instance.reportPlatformError(error, stack);
    } catch (_) {
      // Never throw from a reporter — avoid infinite recursion.
    }
    return true;
  };

  // Bundled fonts ship their licences as assets
  LicenseRegistry.addLicense(_fontLicenses);

  // Enable fullscreen mode
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersive);

  runApp(MyApp());
}

Stream<LicenseEntry> _fontLicenses() async* {
  yield LicenseEntryWithLineBreaks(
    const ['Roboto'],
    await rootBundle.loadString('assets/fonts/Roboto-LICENSE.txt'),
  );
  yield LicenseEntryWithLineBreaks(
    const ['Barlow Semi Condensed'],
    await rootBundle.loadString('assets/fonts/BarlowSemiCondensed-OFL.txt'),
  );
}
