import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/presentation/measurement_diagnostics.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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
}
