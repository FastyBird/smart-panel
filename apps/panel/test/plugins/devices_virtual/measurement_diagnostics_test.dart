import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
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
  test(
    'source-generated API decodes both dew-point roles and retained missing identity through the actual diagnostics loader',
    () async {
      final now = DateTime.now();
      final calls = <String>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            calls.add(options.path);
            handler.resolve(
              Response(
                requestOptions: options,
                data: {
                  'status': 'success',
                  'timestamp': now.toIso8601String(),
                  'request_id': 'fixture',
                  'path': options.path,
                  'method': 'GET',
                  'metadata': {
                    'request_duration_ms': 1.0,
                    'server_time': now.toIso8601String(),
                    'cpu_usage': 0.0,
                  },
                  'data': {
                    'output_property': 'output',
                    'schema_version': 1,
                    'formula_version': 'magnus-water-17.62-243.12-v1',
                    'revision': 1,
                    'graph_revision': 5,
                    'maximum_age_seconds': 30,
                    'maximum_skew_seconds': 2,
                    'quantity': 'dew_point',
                    'unit': '°C',
                    'quality': 'unavailable',
                    'current_value': null,
                    'expires_at': null,
                    'errors': ['missingRH', 'lineage'],
                    'sources': [
                      {
                        'role': 'dry_bulb',
                        'source_property': 't',
                        'source_identity': 't',
                        'contract_fingerprint': 't-fingerprint',
                        'quantity': 'temperature',
                        'unit': '°C',
                        'domain': {
                          'minimum': -45,
                          'maximum': 60,
                          'minimumExclusive': true,
                        },
                        'current_value': 20,
                        'sampled_at': now.toIso8601String(),
                        'age_seconds': 0,
                        'errors': [],
                      },
                      {
                        'role': 'relative_humidity',
                        'source_property': null,
                        'source_identity': 'retained-rh',
                        'contract_fingerprint': 'rh-fingerprint',
                        'quantity': 'humidity',
                        'unit': '%',
                        'domain': {
                          'minimum': 0,
                          'maximum': 100,
                          'minimumExclusive': true,
                        },
                        'current_value': null,
                        'sampled_at': null,
                        'age_seconds': null,
                        'errors': ['missing'],
                      },
                    ],
                  },
                },
              ),
            );
          },
        ),
      );
      locator.registerSingleton<ApiClient>(
        ApiClient(dio, baseUrl: 'http://fixture.invalid'),
      );
      try {
        final diagnostics = await loadMeasurementDiagnostics('output');
        expect(calls, hasLength(1));
        expect(calls.single, contains('/dew-points/output'));
        expect(diagnostics.dewPoint, isTrue);
        expect(diagnostics.transform, isFalse);
        expect(diagnostics.errors, ['missingRH', 'lineage']);
        expect(diagnostics.inputs.map((input) => input.role), [
          'dry_bulb',
          'relative_humidity',
        ]);
        expect(diagnostics.inputs[1].identity, 'retained-rh');
        expect(diagnostics.inputs[1].sourceId, isNull);
        expect(diagnostics.inputs[0].unit, '°C');
        expect(diagnostics.inputs[1].unit, '%');
        expect(
          diagnostics.inputs.every((input) => input.valueAt(now) == null),
          isTrue,
        );
      } finally {
        locator.unregister<ApiClient>();
        dio.close();
      }
    },
  );
  testWidgets(
    'dew-point diagnostics label BOTH roles and retained source blockers without claiming a live ambient temperature',
    (tester) async {
      await tester.pumpWidget(
        app(
          property(),
          (_) async => const MeasurementDiagnostics(
            transform: false,
            dewPoint: true,
            inputs: [
              MeasurementInputDiagnostic(
                identity: 'temperature-id',
                role: 'dry_bulb',
                unit: '°C',
              ),
              MeasurementInputDiagnostic(
                identity: 'retained-rh',
                role: 'relative_humidity',
                unit: '%',
                exclusion: 'missing',
              ),
            ],
            errors: ['lineage'],
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Dew point'), findsOneWidget);
      expect(find.textContaining('Dry-bulb temperature'), findsOneWidget);
      expect(find.textContaining('Relative humidity'), findsOneWidget);
      expect(find.textContaining('retained-rh: —'), findsOneWidget);
      expect(find.text('Quality: Unavailable'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  test(
    'unknown or lineage input failures cannot display a qualified numeric value',
    () {
      final now = DateTime.now();
      for (final reason in [
        'lineage',
        'skew',
        'awaiting_fresh_sample',
        'new_protection_failure',
      ]) {
        expect(
          MeasurementInputDiagnostic(
            identity: 'input',
            value: 20,
            exclusion: reason,
            sampledAt: now,
            expiresAt: now.add(const Duration(seconds: 30)),
          ).valueAt(now),
          isNull,
        );
      }
    },
  );
}
