import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/automations/models/automation.dart';
import 'package:fastybird_smart_panel/modules/automations/repositories/automations.dart';
import 'package:fastybird_smart_panel/modules/automations/service.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/automations_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _automation(
  String id,
  String name, {
  bool enabled = false,
  String? spaceId = 'room',
  String status = 'ok',
  String? lastRunStatus,
  int revision = 1,
}) => {
  'id': id,
  'name': name,
  'description': null,
  'icon': null,
  'enabled': enabled,
  'space_id': spaceId,
  'mode': 'restart',
  'revision': revision,
  'status': status,
  'last_triggered_at': null,
  'last_run_status': lastRunStatus,
  'created_at': '2026-11-01T00:00:00Z',
  'updated_at': null,
};

/// Holds every switch until the test answers it, so the pending state can be
/// seen; answering stores what the backend would return, as the real one does.
class HeldAutomationsRepository extends AutomationsRepository {
  HeldAutomationsRepository()
    : super(apiClient: ApiClient(Dio()).automationsModule);

  final requests = <({String id, bool enabled})>[];
  Completer<AutomationModel>? _held;
  late String _heldId;
  late bool _heldEnabled;

  @override
  Future<AutomationModel> setEnabled(String id, bool enabled) {
    requests.add((id: id, enabled: enabled));
    _heldId = id;
    _heldEnabled = enabled;

    return (_held = Completer<AutomationModel>()).future;
  }

  void accept() {
    final json = {
      ..._automation(_heldId, getAutomation(_heldId)!.name),
      'space_id': getAutomation(_heldId)!.spaceId,
      'enabled': _heldEnabled,
      'revision': getAutomation(_heldId)!.revision + 1,
    };

    insert([json]);
    _held!.complete(AutomationModel.fromJson(json));
  }

  void refuse(AutomationToggleFailure failure) {
    _held!.completeError(AutomationToggleException(failure));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await locator.reset();
    locator.registerSingleton<ScreenService>(
      ScreenService(screenWidth: 1280, screenHeight: 800, pixelRatio: 1),
      dispose: (service) => service.dispose(),
    );
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 1),
    );
  });

  tearDownAll(() async {
    await locator.reset();
  });

  late HeldAutomationsRepository repository;
  late AutomationsService service;

  setUp(() {
    repository = HeldAutomationsRepository();
    service = AutomationsService(repository: repository);
    // Listens to the repository, as initialize() does after the first read
    repository.addListener(service.notifyListeners);
  });

  tearDown(() {
    repository.removeListener(service.notifyListeners);
    service.dispose();
    repository.dispose();
  });

  Widget app(String spaceId) => MaterialApp(
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(
      body: AutomationsSection(spaceId: spaceId, service: service),
    ),
  );

  Switch switchOf(WidgetTester tester, String id) =>
      tester.widget<Switch>(find.byKey(ValueKey('automation-switch-$id')));

  String statusOf(WidgetTester tester, String id) =>
      tester.widget<Text>(find.byKey(ValueKey('automation-status-$id'))).data!;

  testWidgets(
    'lists the automations of the space with name, status and switch',
    (tester) async {
      repository.insert([
        _automation('a', 'Hallway light', enabled: true),
        _automation('b', 'Blinds at dawn', status: 'suspended'),
        _automation('c', 'Leak alarm', status: 'invalid'),
        _automation(
          'd',
          'Night heating',
          enabled: true,
          lastRunStatus: 'failed',
        ),
        _automation('e', 'Kitchen fan', spaceId: 'kitchen'),
      ]);

      await tester.pumpWidget(app('room'));
      await tester.pumpAndSettle();

      expect(find.text('Automations'), findsOneWidget);
      expect(find.text('Kitchen fan'), findsNothing);
      expect(find.byType(Switch), findsNWidgets(4));

      final names = tester
          .widgetList<Text>(find.byType(Text))
          .map((text) => text.data)
          .where(
            (name) => [
              'Blinds at dawn',
              'Hallway light',
              'Leak alarm',
              'Night heating',
            ].contains(name),
          )
          .toList();

      expect(names, [
        'Blinds at dawn',
        'Hallway light',
        'Leak alarm',
        'Night heating',
      ]);
      expect(switchOf(tester, 'a').value, isTrue);
      expect(statusOf(tester, 'a'), 'On');
      expect(switchOf(tester, 'b').value, isFalse);
      expect(
        statusOf(tester, 'b'),
        'Off · Suspended: it was triggered too often',
      );
      expect(statusOf(tester, 'c'), 'Off · Needs attention in the admin');
      expect(statusOf(tester, 'd'), 'On · Last run failed');

      // Nothing on the panel edits or runs an automation
      expect(find.byType(ElevatedButton), findsNothing);
      expect(find.byType(TextButton), findsNothing);
      expect(find.byType(IconButton), findsNothing);

      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('is hidden while the space has no automations', (tester) async {
    repository.insert([_automation('e', 'Kitchen fan', spaceId: 'kitchen')]);

    await tester.pumpWidget(app('room'));
    await tester.pumpAndSettle();

    expect(find.text('Automations'), findsNothing);
    expect(find.byType(Switch), findsNothing);

    // An automation moved into the space appears without a reload
    repository.insert([_automation('e', 'Kitchen fan', spaceId: 'room')]);
    await tester.pump();

    expect(find.text('Automations'), findsOneWidget);
    expect(find.text('Kitchen fan'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'switches optimistically, locks while pending and follows the backend',
    (tester) async {
      repository.insert([_automation('a', 'Hallway light')]);

      await tester.pumpWidget(app('room'));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('automation-switch-a')));
      await tester.pump();

      expect(switchOf(tester, 'a').value, isTrue);
      expect(switchOf(tester, 'a').onChanged, isNull);
      expect(statusOf(tester, 'a'), 'On');

      // A second tap while pending sends nothing
      await tester.tap(find.byKey(const ValueKey('automation-switch-a')));
      await tester.pump();

      repository.accept();
      await tester.pumpAndSettle();

      expect(repository.requests, [(id: 'a', enabled: true)]);
      expect(repository.getAutomation('a')!.revision, 2);
      expect(switchOf(tester, 'a').value, isTrue);
      expect(switchOf(tester, 'a').onChanged, isNotNull);

      // A change made in the admin arrives over the websocket
      repository.insert([
        _automation('a', 'Hallway light', enabled: false, revision: 3),
      ]);
      await tester.pump();

      expect(switchOf(tester, 'a').value, isFalse);

      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('rolls the switch back and says why when it fails', (
    tester,
  ) async {
    repository.insert([_automation('a', 'Hallway light')]);

    await tester.pumpWidget(app('room'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('automation-switch-a')));
    await tester.pump();

    expect(switchOf(tester, 'a').value, isTrue);

    repository.refuse(AutomationToggleFailure.incomplete);
    await tester.pump();

    expect(switchOf(tester, 'a').value, isFalse);
    expect(switchOf(tester, 'a').onChanged, isNotNull);
    expect(
      find.text('This automation is not complete and cannot be switched on.'),
      findsOneWidget,
    );

    // Let the toast time out
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox());
  });
}
