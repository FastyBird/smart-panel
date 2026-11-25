import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/services/intents_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/export.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/system_pages/room_overview.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// A room with lights and a thermostat, nothing loaded beyond the counts.
class _Deck extends ChangeNotifier implements DeckService {
  @override
  bool get isLoadingDevices => false;
  @override
  List<DevicesModuleDeviceCategory> get deviceCategories => const [
    DevicesModuleDeviceCategory.lighting,
    DevicesModuleDeviceCategory.lighting,
    DevicesModuleDeviceCategory.thermostat,
  ];
  @override
  int get energyDeviceCount => 0;
  @override
  int get sensorReadingsCount => 0;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Display extends ChangeNotifier implements DisplayRepository {
  @override
  DisplayModel? get display => DisplayModel(
    id: 'display',
    macAddress: '00:11:22:33:44:55',
    version: '1.0.0',
    screenWidth: 800,
    screenHeight: 480,
    pixelRatio: 2,
    unitSize: 10,
    rows: 4,
    cols: 6,
    darkMode: false,
    brightness: 80,
    screenLockDuration: 60,
    screenSaver: true,
    audioOutputSupported: false,
    audioInputSupported: false,
    speaker: false,
    speakerVolume: 0,
    microphone: false,
    microphoneVolume: 0,
    spaceId: 'room',
    createdAt: DateTime(2026, 1, 1),
  );
  @override
  String? get weatherLocationId => null;
  @override
  NumberFormatSetting? get numberFormat => null;
  @override
  TemperatureUnit? get temperatureUnit => null;
  @override
  WindSpeedUnit? get windSpeedUnit => null;
  @override
  PressureUnit? get pressureUnit => null;
  @override
  PrecipitationUnit? get precipitationUnit => null;
  @override
  DistanceUnit? get distanceUnit => null;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Config implements ConfigModuleService {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Intents extends ChangeNotifier implements IntentsService {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Records the lighting intents the page sends.
class _Spaces extends ChangeNotifier implements SpacesService {
  final sent = <String>[];

  @override
  SpaceView? getSpace(String id) => null;
  @override
  LightingStateModel? getLightingState(String spaceId) => null;
  @override
  ClimateStateModel? getClimateState(String spaceId) => null;
  @override
  CoversStateModel? getCoversState(String spaceId) => null;
  @override
  SensorStateModel? getSensorState(String spaceId) => null;
  @override
  Future<LightingStateModel?> fetchLightingState(String spaceId) async => null;
  @override
  Future<ClimateStateModel?> fetchClimateState(String spaceId) async => null;
  @override
  Future<CoversStateModel?> fetchCoversState(String spaceId) async => null;
  @override
  Future<SensorStateModel?> fetchSensorState(String spaceId) async => null;

  @override
  Future<LightingIntentResult?> turnLightsOn(String spaceId) async {
    sent.add('lights on $spaceId');

    return null;
  }

  @override
  Future<LightingIntentResult?> turnRoleOn(
    String spaceId,
    LightingStateRole role,
  ) async {
    sent.add('role on ${role.name} $spaceId');

    return null;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late _Spaces spaces;

  setUpAll(() async {
    await locator.reset();
    // A Compact landscape canvas (400 × 240): two quick actions per card.
    locator.registerSingleton<ScreenService>(
      ScreenService(screenWidth: 800, screenHeight: 480, pixelRatio: 2),
    );
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 2),
    );
    locator.registerSingleton<EventBus>(EventBus());
    locator.registerSingleton<DeckService>(_Deck());
    locator.registerSingleton<DisplayRepository>(_Display());
    locator.registerSingleton<IntentsService>(_Intents());
    locator.registerSingleton<ConfigModuleService>(_Config());
    spaces = _Spaces();
    locator.registerSingleton<SpacesService>(spaces);
  });

  tearDownAll(() async {
    await locator.reset();
  });

  testWidgets('On turns on every light in the room and shows On at once', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(350, 240);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightThemeFor(AppAccent.blue),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('en'),
        home: const Scaffold(
          body: RoomOverviewPage(
            viewItem: SystemViewItem(
              id: 'room',
              viewType: SystemViewType.room,
              roomId: 'room',
              title: 'Living room',
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 100));

    final lights = find.byKey(const ValueKey('room-card-lights'));
    expect(
      find.descendant(of: lights, matching: find.text('Off')),
      findsWidgets,
    );

    await tester.tap(find.descendant(of: lights, matching: find.text('On')));
    await tester.pump(const Duration(milliseconds: 100));

    // The room-level intent, not the main role only.
    expect(spaces.sent, ['lights on room']);
    // The card says On before the room reports back.
    final value = tester
        .widgetList<Text>(
          find.descendant(of: lights, matching: find.byType(Text)),
        )
        .firstWhere((text) => text.textSpan != null);
    expect(value.textSpan!.toPlainText(), 'On');

    // Let the optimistic cleanup and the sky's clock go.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 7));
  });
}
