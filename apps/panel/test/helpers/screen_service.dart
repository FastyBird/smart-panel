import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:flutter_test/flutter_test.dart';

/// Registers a [ScreenService] for widget tests that render shared widgets
/// such as the page header. DPR 2 at density 1.0, so one design px is one
/// logical px; a 1280 × 800 screen is the Regular class.
///
/// Keeps an existing registration: the token getters bind the first one.
void registerTestScreenService() {
  TestWidgetsFlutterBinding.ensureInitialized();

  if (locator.isRegistered<ScreenService>()) return;

  locator.registerSingleton<ScreenService>(
    ScreenService(screenWidth: 1280, screenHeight: 800, pixelRatio: 2),
  );
}
