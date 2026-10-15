import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/presentation/measurement_diagnostics.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockDevicesService extends Mock implements DevicesService {}

void main() {
  Widget app(
    ChannelPropertyView property,
    MeasurementDiagnosticsLoader loader,
  ) => MaterialApp(
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(
      body: VirtualMeasurementDiagnostics(property: property, loader: loader),
    ),
  );
  ChannelPropertyView property() => ChannelPropertyView(
    id: 'output',
    type: 'virtual',
    channel: 'channel',
    valueState: const PropertyValueState(
      producer: PropertyProducerState(
        quality: PropertyProducerQuality.unavailable,
        reasons: ['missing'],
        revision: 1,
      ),
    ),
  );

  test(
    'diagnostic labels explain known and unknown codes in the selected locale',
    () {
      final l = lookupAppLocalizations(const Locale('en'));
      expect(
        measurementDiagnosticLabel(l, 'missing:member-id'),
        'Source missing · member-id',
      );
      expect(
        measurementDiagnosticLabel(l, 'new_reason'),
        'Unknown diagnostic (new_reason)',
      );
    },
  );

  testWidgets(
    'shows aggregate member identities and exclusions without claiming availability',
    (tester) async {
      await tester.pumpWidget(
        app(
          property(),
          (_) async => const MeasurementDiagnostics(
            transform: false,
            inputs: [
              MeasurementInputDiagnostic(
                identity: 'deleted member',
                exclusion: 'missing',
              ),
            ],
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Quality: Unavailable'), findsOneWidget);
      expect(find.text('Aggregate members'), findsOneWidget);
      expect(find.textContaining('deleted member: —'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets('distinguishes two resolved inputs from the same channel', (
    tester,
  ) async {
    final service = MockDevicesService();
    locator.registerSingleton<DevicesService>(service);
    addTearDown(() => locator.unregister<DevicesService>());
    final channel = ChannelView(
      id: 'source-channel',
      type: 'generic',
      name: 'Measurements',
      device: 'source-device',
      properties: const [],
    );
    final device = DeviceView(
      id: 'source-device',
      type: 'generic',
      name: 'Meter',
      channels: [channel],
    );
    for (final id in ['voltage', 'current']) {
      when(() => service.getChannelProperty(id)).thenReturn(
        ChannelPropertyView(id: id, type: 'generic', channel: channel.id),
      );
    }
    when(() => service.getChannel(channel.id)).thenReturn(channel);
    when(() => service.getDevice(device.id)).thenReturn(device);
    await tester.pumpWidget(
      app(
        property(),
        (_) async => const MeasurementDiagnostics(
          transform: false,
          inputs: [
            MeasurementInputDiagnostic(
              identity: 'voltage',
              sourceId: 'voltage',
            ),
            MeasurementInputDiagnostic(
              identity: 'current',
              sourceId: 'current',
            ),
          ],
        ),
      ),
    );
    await tester.pump();
    expect(
      find.textContaining('Meter / Measurements / voltage:'),
      findsOneWidget,
    );
    expect(
      find.textContaining('Meter / Measurements / current:'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets('shows converter input error separately from live quality', (
    tester,
  ) async {
    await tester.pumpWidget(
      app(
        property(),
        (_) async => const MeasurementDiagnostics(
          transform: true,
          inputs: [
            MeasurementInputDiagnostic(
              identity: 'voltage input',
              value: 3.3,
              unit: 'V',
              exclusion: 'invalid_domain',
            ),
          ],
          errors: ['invalid_domain'],
        ),
      ),
    );
    await tester.pump();
    expect(find.text('Converter input'), findsOneWidget);
    expect(find.text('Quality: Unavailable'), findsOneWidget);
    expect(find.textContaining('Outside mathematical domain'), findsWidgets);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets(
    'failed diagnostics clears prior data and offers a read-only retry',
    (tester) async {
      await tester.pumpWidget(
        app(property(), (_) async => throw StateError('offline')),
      );
      await tester.pump();
      expect(find.text('Retry diagnostics'), findsOneWidget);
      expect(find.text('Quality: Unavailable'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'binary diagnostics preserve false and outlier exclusion with explicit grid and age',
    (tester) async {
      final now = DateTime.now();
      await tester.pumpWidget(
        app(
          property(),
          (_) async => MeasurementDiagnostics(
            transform: false,
            outputStep: 0.1,
            unit: 'lx',
            inputs: [
              MeasurementInputDiagnostic(
                identity: 'boolean source',
                value: false,
                sampledAt: now.subtract(const Duration(seconds: 2)),
                expiresAt: now.add(const Duration(seconds: 20)),
              ),
              MeasurementInputDiagnostic(
                identity: 'rejected source',
                value: 99,
                weight: 2,
                unit: 'lx',
                exclusion: 'outlier',
                sampledAt: now.subtract(const Duration(seconds: 2)),
                expiresAt: now.add(const Duration(seconds: 20)),
              ),
            ],
          ),
        ),
      );
      await tester.pump();
      expect(
        find.textContaining('boolean source: Not detected'),
        findsOneWidget,
      );
      expect(
        find.textContaining('rejected source: — lx · Outlier excluded'),
        findsOneWidget,
      );
      expect(find.textContaining('Output step: 0.1 lx'), findsOneWidget);
      expect(find.textContaining('Sample age: 2 s'), findsWidgets);
      expect(find.textContaining('Relative weight: 2'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  test(
    'input diagnostics hide values at expiry and when timestamp lies in the future',
    () {
      final now = DateTime.now();
      for (final diagnostic in [
        MeasurementInputDiagnostic(
          identity: 'expired',
          value: false,
          sampledAt: now.subtract(const Duration(seconds: 5)),
          expiresAt: now,
        ),
        MeasurementInputDiagnostic(
          identity: 'future',
          value: 3,
          sampledAt: now.add(const Duration(seconds: 1)),
          expiresAt: now.add(const Duration(seconds: 5)),
        ),
        MeasurementInputDiagnostic(
          identity: 'stale',
          value: 3,
          exclusion: 'stale',
          sampledAt: now,
          expiresAt: now.add(const Duration(seconds: 5)),
        ),
      ]) {
        expect(diagnostic.valueAt(now), isNull);
      }
    },
  );
}
