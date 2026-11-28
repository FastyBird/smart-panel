import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_climate_target_device_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_climate_target_role.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/climate_state/climate_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/climate_targets/climate_target.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/domain_pages/climate_domain_view.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/spaces_service.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/views/climate_targets/view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _Spaces extends Mock implements SpacesService {}

class _Devices extends Mock implements DevicesService {}

class _Thermostat extends Mock implements DeviceView {}

class _Display extends Mock implements DisplayRepository {}

class _Config extends Mock implements ConfigModuleService {}

const _room = '00000000-0000-4000-8000-000000000001';
const _thermostat = '00000000-0000-4000-8000-000000000050';
const _item = DomainViewItem(
  id: 'climate',
  domainType: DomainType.climate,
  roomId: _room,
  title: 'Climate',
  deviceCount: 1,
);

/// One thermostat heating to 22.0; the room reads 21.4 and 46 %.
final _state = ClimateStateModel.fromJson({
  'has_climate': true,
  'mode': 'heat',
  'current_temperature': 21.4,
  'current_humidity': 46,
  'heating_setpoint': 22.0,
  'min_setpoint': 16,
  'max_setpoint': 28,
  'supports_heating': true,
  'is_heating': true,
}, spaceId: _room);

void main() {
  late _Spaces spaces;
  late _Devices devices;
  late BottomNavModeNotifier modes;
  late EventBus bus;

  setUp(() {
    spaces = _Spaces();
    devices = _Devices();
    modes = BottomNavModeNotifier();
    bus = EventBus(sync: true);
    when(() => spaces.addListener(any())).thenReturn(null);
    when(() => spaces.removeListener(any())).thenReturn(null);
    when(() => devices.addListener(any())).thenReturn(null);
    when(() => devices.removeListener(any())).thenReturn(null);
    when(() => spaces.getSpace(any())).thenReturn(null);
    when(() => devices.devicesList).thenReturn(const []);
    when(() => spaces.getClimateTargetsForSpace(_room)).thenReturn([
      ClimateTargetView(
        model: ClimateTargetModel(
          deviceId: _thermostat,
          deviceName: 'Thermostat',
          deviceCategory:
              SpacesModuleDataClimateTargetDeviceCategory.thermostat,
          priority: 0,
          hasTemperature: true,
          hasHumidity: true,
          hasAirQuality: false,
          hasAirParticulate: false,
          hasCarbonDioxide: false,
          hasVolatileOrganicCompounds: false,
          hasPressure: false,
          hasMode: true,
          role: SpacesModuleDataClimateTargetRole.heatingOnly,
          spaceId: _room,
        ),
      ),
    ]);
    final thermostat = _Thermostat();
    when(() => thermostat.id).thenReturn(_thermostat);
    when(() => thermostat.name).thenReturn('Thermostat');
    when(() => thermostat.isOnline).thenReturn(true);
    when(
      () => thermostat.category,
    ).thenReturn(DevicesModuleDeviceCategory.thermostat);
    when(() => devices.getDevice(_thermostat)).thenReturn(thermostat);
    when(() => spaces.getClimateState(_room)).thenReturn(_state);
    when(() => spaces.fetchClimateState(_room)).thenAnswer((_) async => _state);
    when(
      () => spaces.fetchClimateTargetsForSpace(_room),
    ).thenAnswer((_) async {});

    final display = _Display();
    when(() => display.display).thenReturn(null);
    when(() => display.addListener(any())).thenReturn(null);
    when(() => display.removeListener(any())).thenReturn(null);
    locator.registerSingleton<DisplayRepository>(display);
    locator.registerSingleton<ConfigModuleService>(_Config());
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 2),
    );
    locator.registerSingleton<SpacesService>(spaces);
    locator.registerSingleton<DevicesService>(devices);
    locator.registerSingleton<BottomNavModeNotifier>(modes);
    locator.registerSingleton<EventBus>(bus);
  });

  tearDown(() async {
    Toast.dismiss();
    bus.destroy();
    modes.dispose();
    await locator.reset();
  });

  /// Mounts the view on a [canvas] screen, in the [view] the deck's dock or
  /// bar leaves it.
  Future<void> mountAt(WidgetTester tester, Size canvas, Size view) async {
    // One design px is one logical px at DPR 2 and density 1.0.
    locator.registerSingleton<ScreenService>(
      ScreenService(
        screenWidth: canvas.width * 2,
        screenHeight: canvas.height * 2,
        pixelRatio: 2,
      ),
      dispose: (s) => s.dispose(),
    );
    tester.view.physicalSize = canvas * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DevicesService>.value(value: devices),
          ChangeNotifierProvider<BottomNavModeNotifier>.value(value: modes),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('en'),
          home: Align(
            alignment: Alignment.topRight,
            child: SizedBox.fromSize(
              size: view,
              child: const ClimateDomainViewPage(viewItem: _item),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    bus.fire(DeckPageActivatedEvent(itemId: _item.id, item: _item));
    await tester.pumpAndSettle();
  }

  Future<void> unmount(WidgetTester tester) async {
    Toast.dismiss();
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 3));
  }

  testWidgets('the square reaches the room sensors from the header', (
    tester,
  ) async {
    // 240 × 240 less the 40 px bar.
    await mountAt(tester, const Size(240, 240), const Size(240, 200));
    expect(tester.takeException(), isNull);
    // The square keeps the hero alone: no sensor tiles.
    expect(
      find.byKey(const ValueKey('climate-sensor-state_humidity')),
      findsNothing,
    );

    await tester.tap(find.byKey(const ValueKey('climate-sensors-button')));
    await tester.pumpAndSettle();
    expect(find.text('Sensors'), findsOneWidget);
    for (final id in ['state_temp', 'state_humidity']) {
      expect(
        find.byKey(ValueKey('climate-sensors-row-$id')),
        findsOneWidget,
        reason: id,
      );
    }
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('climate-sensors-row-state_humidity')),
        matching: find.textContaining('46'),
      ),
      findsOneWidget,
    );
    await unmount(tester);
  });

  testWidgets('other boards tile the sensors and need no header button', (
    tester,
  ) async {
    // M+ less the 56 px dock.
    await mountAt(tester, const Size(640, 400), const Size(584, 400));
    expect(tester.takeException(), isNull);
    expect(find.byKey(const ValueKey('climate-sensors-button')), findsNothing);
    expect(
      find.byKey(const ValueKey('climate-sensor-state_humidity')),
      findsOneWidget,
    );
    await unmount(tester);
  });
}
