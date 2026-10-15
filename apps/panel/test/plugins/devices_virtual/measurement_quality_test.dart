import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/property.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/material.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/property_timeseries.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_detail_content.dart';
import 'package:intl/intl.dart';

class MockChannelPropertyView extends Mock implements ChannelPropertyView {}

class MockDevicesService extends Mock implements DevicesService {}

class MockTimeseriesService extends Mock implements PropertyTimeseriesService {}

void main() {
  final now = DateTime.now().toUtc();
  Map<String, dynamic> property({Map<String, dynamic>? producer}) => {
    'id': '550e8400-e29b-41d4-a716-446655440000',
    'channel': '550e8400-e29b-41d4-a716-446655440001',
    'category': 'value',
    'data_type': 'float',
    'permissions': ['ro'],
    'value_origin': 'derived',
    'unit': 'custom mV',
    'measurement_quantity': 'voltage',
    'value': {
      'value': 12.5,
      'last_updated': now.toIso8601String(),
      'trend': 'rising',
      if (producer != null) 'producer': producer,
    },
  };
  Map<String, dynamic> lease(String quality, DateTime expires) => {
    'quality': quality,
    'reasons': [],
    'revision': 2,
    'evaluated_at': now.toIso8601String(),
    'sampled_at': now.subtract(const Duration(seconds: 2)).toIso8601String(),
    'expires_at': expires.toIso8601String(),
  };

  test('generic quantity and unit survive mapper and live-state updates', () {
    final model = VirtualChannelPropertyModel.fromJson(
      property(producer: lease('good', now.add(const Duration(minutes: 1)))),
    );
    final updated = model.copyWith(valueState: model.valueState);
    expect(updated.measurementQuantity, 'voltage');
    expect(buildChannelPropertyView(updated).unit, 'custom mV');
    expect(buildChannelPropertyView(updated).value, isNotNull);
  });
  test(
    'retained scalar without runtime qualification cannot become a reading',
    () {
      final model = VirtualChannelPropertyModel.fromJson(property());
      for (final retained in [
        model,
        model.copyWith(),
        model.copyWith().copyWith(),
      ]) {
        final view = buildChannelPropertyView(retained);
        expect(view.value, isNull);
        expect(view.valueState?.value?.value, 12.5);
        expect(view.valueState?.lastUpdated, now);
        expect(view.valueState?.trend, ValueTrend.rising);
        expect(
          view.valueState?.producer?.quality,
          PropertyProducerQuality.unavailable,
        );
        expect(view.valueState?.producer?.reasons, ['runtime_unavailable']);
      }
    },
  );
  test(
    'unavailable and expired producer values stay hidden while history remains in state',
    () {
      for (final producer in [
        lease('unavailable', now.add(const Duration(minutes: 1))),
        lease('good', now.subtract(const Duration(seconds: 1))),
      ]) {
        final view = buildChannelPropertyView(
          VirtualChannelPropertyModel.fromJson(property(producer: producer)),
        );
        expect(view.value, isNull);
        expect(view.valueState?.value, isNotNull);
      }
    },
  );
  test(
    'degraded quorum output remains usable only until its original expiry',
    () {
      final producer = PropertyProducerState.fromJson(
        lease('degraded', now.add(const Duration(seconds: 5))),
      );
      expect(producer.isCurrentAt(now), isTrue);
      expect(
        producer.isCurrentAt(now.add(const Duration(seconds: 5))),
        isFalse,
      );
    },
  );
  test('generic FLOAT sensor formatting preserves fractional values', () {
    expect(
      SensorUtils.scaleForCategory(DevicesModuleChannelCategory.analogInput),
      3,
    );
  });
  test(
    'clock rollback and malformed evaluation timestamps cannot keep a lease current',
    () {
      final valid = lease('good', now.add(const Duration(seconds: 30)));
      expect(PropertyProducerState.fromJson(valid).isCurrentAt(now), isTrue);
      for (final evaluated in [
        null,
        'malformed',
        now.add(const Duration(seconds: 1)).toIso8601String(),
      ]) {
        expect(
          PropertyProducerState.fromJson({
            ...valid,
            'evaluated_at': evaluated,
          }).isCurrentAt(now),
          isFalse,
        );
      }
    },
  );
  test(
    'numeric profile grids preserve integer humidity and CO2 and fractional illuminance',
    () {
      Intl.defaultLocale = 'en_US';
      for (final entry in [
        (
          DevicesModuleChannelCategory.humidity,
          'humidity',
          'uchar',
          '%',
          1,
          43,
          '43',
        ),
        (
          DevicesModuleChannelCategory.carbonDioxide,
          'concentration',
          'float',
          'ppm',
          1,
          850,
          '850',
        ),
        (
          DevicesModuleChannelCategory.illuminance,
          'illuminance',
          'float',
          'lx',
          0.1,
          12.3,
          '12.3',
        ),
        (
          DevicesModuleChannelCategory.temperature,
          'temperature',
          'float',
          '°C',
          0.01,
          21.25,
          '21.25',
        ),
      ]) {
        final view = buildChannelPropertyView(
          VirtualChannelPropertyModel.fromJson({
            ...property(
              producer: lease('good', now.add(const Duration(minutes: 1))),
            ),
            'category': entry.$2,
            'data_type': entry.$3,
            'unit': entry.$4,
            'step': entry.$5,
            'measurement_quantity': entry.$2,
            'value': {
              'value': entry.$6,
              'producer': lease('good', now.add(const Duration(minutes: 1))),
            },
          }),
        );
        expect(SensorUtils.valueFormatterForCategory(entry.$1)(view), entry.$7);
        expect(
          SensorUtils.formatNumericValueWithUnit(
            entry.$6,
            entry.$1,
            property: view,
          ),
          '${entry.$7}${entry.$4}',
        );
        if (entry.$1 == DevicesModuleChannelCategory.temperature) {
          expect(
            SensorUtils.formatNumericValueWithUnit(
              21.25,
              entry.$1,
              property: view,
              displayUnits: DisplayUnits.metric,
            ),
            '21.3°C',
          );
          expect(
            SensorUtils.formatNumericValueWithUnit(
              21.25,
              entry.$1,
              property: view,
              displayUnits: const DisplayUnits(
                numberFormat: NumberFormatSetting.commaDot,
                temperature: TemperatureUnit.fahrenheit,
                windSpeed: WindSpeedUnit.metersPerSecond,
                pressure: PressureUnit.hectopascal,
                precipitation: PrecipitationUnit.millimeters,
                distance: DistanceUnit.kilometers,
              ),
            ),
            '70.3°F',
          );
        }
      }
    },
  );
  test(
    'binary profiles keep false evidence distinct from unavailable retained history',
    () {
      final l = lookupAppLocalizations(const Locale('en'));
      for (final category in [
        DevicesModuleChannelCategory.contact,
        DevicesModuleChannelCategory.motion,
        DevicesModuleChannelCategory.occupancy,
      ]) {
        for (final available in [true, false]) {
          final view = buildChannelPropertyView(
            VirtualChannelPropertyModel.fromJson({
              ...property(),
              'category': 'detected',
              'data_type': 'bool',
              'unit': null,
              'value': {
                'value': false,
                'producer': lease(
                  available ? 'degraded' : 'unavailable',
                  now.add(const Duration(minutes: 1)),
                ),
              },
            }),
          );
          final sensor = SensorUtils.buildSensorData(
            ChannelView(
              id: 'channel',
              type: 'virtual',
              device: 'device',
              category: category,
              properties: [view],
            ),
            localizations: l,
          );
          expect(sensor.isDetection, available ? false : null);
          expect(sensor.unit, '');
          expect(view.valueState?.value, isNotNull);
        }
      }
    },
  );
  test('legacy category formatting keeps physical defaults and units', () {
    Intl.defaultLocale = 'en_US';
    final physical = MockChannelPropertyView();
    when(() => physical.type).thenReturn('physical');
    when(() => physical.step).thenReturn(0.1);
    when(() => physical.unit).thenReturn('lx');
    expect(
      SensorUtils.formatNumericValueWithUnit(
        12.3,
        DevicesModuleChannelCategory.illuminance,
        property: physical,
      ),
      '12lux',
    );
    when(() => physical.type).thenReturn('virtual');
    for (final step in [0.0, -1.0, double.nan, double.infinity]) {
      when(() => physical.step).thenReturn(step);
      expect(
        SensorUtils.scaleForProperty(
          DevicesModuleChannelCategory.illuminance,
          physical,
        ),
        0,
      );
    }

    expect(
      SensorUtils.formatNumericValueWithUnit(
        12.3,
        DevicesModuleChannelCategory.illuminance,
      ),
      '12lux',
    );
    expect(
      SensorUtils.formatNumericValueWithUnit(
        21.25,
        DevicesModuleChannelCategory.temperature,
      ),
      '21.3°C',
    );
  });
  testWidgets(
    'sensor history min max and average use virtual lux precision and unit',
    (tester) async {
      Intl.defaultLocale = 'en_US';
      final view = buildChannelPropertyView(
        VirtualChannelPropertyModel.fromJson({
          ...property(),
          'category': 'illuminance',
          'unit': 'lx',
          'step': 0.1,
        }),
      );
      final channel = ChannelView(
        id: 'channel',
        device: 'device',
        type: 'virtual',
        category: DevicesModuleChannelCategory.illuminance,
        properties: [view],
      );
      final screen = ScreenService(
        screenWidth: 1600,
        screenHeight: 1200,
        pixelRatio: 2,
      );
      final timeseries = MockTimeseriesService();
      when(
        () => timeseries.getTimeseries(
          channelId: 'channel',
          propertyId: view.id,
          timeRange: TimeRange.oneDay,
        ),
      ).thenAnswer(
        (_) async => PropertyTimeseries(
          points: [
            TimeseriesPoint(
              time: now.subtract(const Duration(minutes: 1)),
              numericValue: 12.3,
            ),
            TimeseriesPoint(time: now, numericValue: 12.5),
          ],
        ),
      );
      locator.registerSingleton<ScreenService>(screen);
      locator.registerSingleton<VisualDensityService>(
        VisualDensityService(pixelRatio: 2),
      );
      locator.registerSingleton<DevicesService>(MockDevicesService());
      locator.registerSingleton<PropertyTimeseriesService>(timeseries);
      addTearDown(() async {
        await locator.reset();
        screen.dispose();
      });
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: SensorDetailContent(
              sensor: SensorData(
                label: 'Illuminance',
                icon: Icons.light_mode,
                channel: channel,
                property: view,
                unit: 'lx',
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('12.3lx'), findsOneWidget);
      expect(find.text('12.5lx'), findsOneWidget);
      expect(find.text('12.4lx'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'sensor detail refuses a cached binary detection after its producer authority expires',
    (tester) async {
      final view = buildChannelPropertyView(
        VirtualChannelPropertyModel.fromJson({
          ...property(),
          'category': 'detected',
          'data_type': 'bool',
          'unit': null,
          'value': {
            'value': true,
            'producer': lease('good', now.subtract(const Duration(seconds: 1))),
          },
        }),
      );
      final channel = ChannelView(
        id: 'channel',
        device: 'device',
        type: 'virtual',
        category: DevicesModuleChannelCategory.contact,
        properties: [view],
      );
      final screen = ScreenService(
        screenWidth: 1600,
        screenHeight: 1200,
        pixelRatio: 2,
      );
      final timeseries = MockTimeseriesService();
      when(
        () => timeseries.getTimeseries(
          channelId: 'channel',
          propertyId: view.id,
          timeRange: TimeRange.oneDay,
        ),
      ).thenAnswer((_) async => PropertyTimeseries(points: []));
      locator.registerSingleton<ScreenService>(screen);
      locator.registerSingleton<VisualDensityService>(
        VisualDensityService(pixelRatio: 2),
      );
      locator.registerSingleton<DevicesService>(MockDevicesService());
      locator.registerSingleton<PropertyTimeseriesService>(timeseries);
      addTearDown(() async {
        await locator.reset();
        screen.dispose();
      });
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: SensorDetailContent(
              sensor: SensorData(
                label: 'Contact',
                icon: Icons.door_front_door,
                channel: channel,
                property: view,
                isDetection: true,
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(
        find.byWidgetPredicate(
          (widget) => widget is RichText && widget.text.toPlainText() == '--',
        ),
        findsOneWidget,
      );
      expect(find.text('Quality: Unavailable'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
