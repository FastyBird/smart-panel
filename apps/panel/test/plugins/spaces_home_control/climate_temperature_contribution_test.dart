import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/climate_state/climate_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/climate_temperature_notice.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  ClimateStateModel parse(Map<String, dynamic> extra) =>
      ClimateStateModel.fromJson({
        'has_climate': true,
        'current_temperature': 23.0,
        ...extra,
      }, spaceId: 'room');

  test(
    'legacy room readings remain usable without contribution diagnostics',
    () {
      final state = parse({});
      expect(state.currentTemperature, 23);
      expect(state.temperatureContribution, isNull);
    },
  );

  test(
    'conflicting representatives withhold temperature and retain selection',
    () {
      final state = parse({
        'temperature_contribution': {
          'status': 'coverage_conflict',
          'selected_property_ids': ['aggregate-a', 'aggregate-b'],
          'excluded_property_ids': ['physical-a'],
        },
      });
      expect(state.currentTemperature, isNull);
      expect(state.temperatureContribution!.hasConflict, isTrue);
      expect(state.temperatureContribution!.selectedPropertyIds, [
        'aggregate-a',
        'aggregate-b',
      ]);
      expect(state.temperatureContribution!.excludedPropertyIds, [
        'physical-a',
      ]);
    },
  );

  test(
    'valid coverage with no available representative withholds temperature',
    () {
      final state = parse({
        'temperature_contribution': {
          'status': 'ok',
          'selected_property_ids': ['aggregate'],
          'unavailable_property_ids': ['aggregate'],
        },
      });
      expect(state.currentTemperature, isNull);
      expect(state.temperatureContribution!.isUnavailable, isTrue);
      final partial = parse({
        'temperature_contribution': {
          'status': 'ok',
          'selected_property_ids': ['aggregate', 'independent'],
          'unavailable_property_ids': ['aggregate'],
        },
      });
      expect(partial.currentTemperature, 23);
      expect(partial.temperatureContribution!.isUnavailable, isFalse);
    },
  );

  test('stale or unknown coverage cannot retain a numeric room reading', () {
    for (final status in ['coverage_stale', 'future_unknown_status']) {
      final state = parse({
        'temperature_contribution': {'status': status},
      });
      expect(state.currentTemperature, isNull);
      expect(state.temperatureContribution!.isUnavailable, isTrue);
    }
    expect(
      parse({
        'temperature_contribution': {'status': 'ok'},
      }).currentTemperature,
      23,
    );
  });

  Future<void> show(
    WidgetTester tester,
    ClimateTemperatureContribution? contribution, {
    String language = 'en',
  }) => tester.pumpWidget(
    MaterialApp(
      locale: Locale(language),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ClimateTemperatureNotice(contribution: contribution),
      ),
    ),
  );

  testWidgets(
    'conflict explains participation repair in the selected language',
    (tester) async {
      await show(
        tester,
        const ClimateTemperatureContribution(status: 'coverage_conflict'),
        language: 'cs',
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('se překrývají'), findsOneWidget);
      expect(find.textContaining('vyberte jednoho zástupce'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'unavailable coverage explains why no room temperature is shown',
    (tester) async {
      await show(
        tester,
        const ClimateTemperatureContribution(status: 'coverage_stale'),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('Check sensor configuration'), findsOneWidget);
      expect(find.textContaining('overlap'), findsNothing);
    },
  );

  testWidgets('ordinary legacy and resolved room readings show no notice', (
    tester,
  ) async {
    await show(tester, null);
    await tester.pumpAndSettle();
    expect(find.byType(Text), findsNothing);
    await show(tester, const ClimateTemperatureContribution(status: 'ok'));
    await tester.pumpAndSettle();
    expect(find.byType(Text), findsNothing);
  });
}
