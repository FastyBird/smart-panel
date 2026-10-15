import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_comfort.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class ComfortSocket extends Mock implements SocketService {}

Map<String, dynamic> configured({bool cooling = false}) => {
  'controller': 'a',
  'revision': 4,
  'graph_revision': 9,
  'clock_policy': 'bounded_absolute_recovery_with_uncertainty_inhibit',
  'configuration': {
    'heating_range': cooling ? null : {'minimum': 0, 'maximum': 30},
    'cooling_range': cooling ? {'minimum': 10, 'maximum': 35} : null,
    'presets': [
      {
        'preset': 'eco',
        'setpoints': {
          'heating_setpoint': cooling ? null : 17,
          'cooling_setpoint': cooling ? 26 : null,
        },
      },
    ],
    'selected_preset': null,
    'user_off': true,
    'automation_enabled': false,
    'temporary_override': {
      'id': 'override-id',
      'source': 'panel',
      'actor_id': 'display:screen:token:credential',
      'revision': 3,
      'status': 'active',
      'expires_at': DateTime.now()
          .toUtc()
          .add(const Duration(minutes: 2))
          .toIso8601String(),
    },
  },
  'effective': {
    'source': 'override',
    'preset': 'eco',
    'heating_setpoint': cooling ? null : 17,
    'cooling_setpoint': cooling ? 26 : null,
  },
};

void main() {
  late Dio dio;
  late Map<String, dynamic> state;
  late List<Map<String, dynamic>> writes;
  late List<String> paths;
  Future<void> open(
    WidgetTester tester, {
    String id = 'a',
    String language = 'en',
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: Locale(language),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SingleChildScrollView(
            child: VirtualThermostatComfort(deviceId: id, onChanged: () {}),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> tap(WidgetTester tester, String key) async {
    final finder = find.byKey(ValueKey(key));
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  setUp(() async {
    await locator.reset();
    state = configured();
    writes = [];
    paths = [];
    dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          paths.add(options.path);
          if (options.method == 'POST') {
            final body = Map<String, dynamic>.from(options.data as Map);
            writes.add(body);
            state['revision'] = (state['revision'] as int) + 1;
            final config = state['configuration'] as Map;
            if (options.path.endsWith('/override/cancel')) {
              (config['temporary_override'] as Map)['status'] = 'cancelled';
              state['effective'] = {
                'source': 'manual',
                'preset': null,
                'heating_setpoint': 21,
                'cooling_setpoint': null,
              };
            }
            if (options.path.endsWith('/selection')) {
              config['selected_preset'] = body['preset'];
              if (body['clear_user_off'] == true) config['user_off'] = false;
            }
          }
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {'data': jsonDecode(jsonEncode(state))},
            ),
          );
        },
      ),
    );
    locator.registerSingleton<Dio>(dio);
  });
  tearDown(() async {
    await locator.reset();
  });

  testWidgets(
    'legacy configuration stays manual with no seeded presets or override controls',
    (tester) async {
      state['configuration'] = null;
      state['effective'] = {
        'source': 'manual',
        'preset': null,
        'heating_setpoint': 0,
        'cooling_setpoint': null,
      };
      await open(tester);
      expect(find.textContaining('not configured'), findsOneWidget);
      expect(find.byKey(const ValueKey('comfort-create')), findsNothing);
      expect(find.textContaining('0 / —'), findsOneWidget);
      expect(writes, isEmpty);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'OFF clear is separate and exact cancellation reloads the current server baseline',
    (tester) async {
      await open(tester);
      await tap(tester, 'comfort-diagnostics');
      expect(
        find.textContaining('display:screen:token:credential'),
        findsOneWidget,
      );
      await tap(tester, 'comfort-clear-off');
      expect(writes.single, {
        'preset': null,
        'clear_user_off': true,
        'expected_revision': 4,
        'expected_graph_revision': 9,
      });
      await tap(tester, 'comfort-cancel');
      expect(writes.last, {
        'override_id': 'override-id',
        'expected_revision': 5,
        'expected_graph_revision': 9,
      });
      expect(
        find.textContaining('manual / Manual baseline · 21'),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('comfort-cancel')), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  for (final cooling in [false, true]) {
    testWidgets(
      'explicit override respects ${cooling ? 'cooling' : 'heating'} capability, blank inputs and nullable unsupported branch',
      (tester) async {
        state = configured(cooling: cooling);
        await open(tester);
        await tap(tester, 'comfort-create');
        expect(
          find.byKey(
            ValueKey(cooling ? 'override-heating' : 'override-cooling'),
          ),
          findsNothing,
        );
        final input = find.byKey(
          ValueKey(cooling ? 'override-cooling' : 'override-heating'),
        );
        expect(tester.widget<TextField>(input).controller!.text, isEmpty);
        expect(
          tester
              .widget<FilledButton>(
                find.byKey(const ValueKey('override-submit')),
              )
              .onPressed,
          isNull,
        );
        await tester.enterText(input, cooling ? '27' : '0');
        await tester.enterText(
          find.byKey(const ValueKey('override-duration')),
          '10',
        );
        await tester.pump();
        await tap(tester, 'override-submit');
        expect(writes.single['setpoints'], {
          'heating_setpoint': cooling ? null : 0.0,
          'cooling_setpoint': cooling ? 27.0 : null,
        });
        expect(writes.single['preset'], isNull);
        expect(
          DateTime.tryParse(writes.single['expires_at'] as String),
          isNotNull,
        );
        expect(writes.single['expected_revision'], 4);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
      },
    );
  }

  testWidgets(
    'localized explicit temperature input accepts a decimal comma without changing wire units',
    (tester) async {
      await open(tester, language: 'cs');
      await tap(tester, 'comfort-create');
      await tester.enterText(
        find.byKey(const ValueKey('override-heating')),
        '17,5',
      );
      await tester.enterText(
        find.byKey(const ValueKey('override-duration')),
        '5',
      );
      await tester.pump();
      await tap(tester, 'override-submit');
      expect((writes.single['setpoints'] as Map)['heating_setpoint'], 17.5);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'baseline preset selection never clears OFF and configured-preset overrides send no synthetic temperatures',
    (tester) async {
      await open(tester);
      await tap(tester, 'comfort-selection');
      await tester.tap(find.text('Eco').last);
      await tester.pumpAndSettle();
      expect(writes.single, {
        'preset': 'eco',
        'clear_user_off': false,
        'expected_revision': 4,
        'expected_graph_revision': 9,
      });
      expect((state['configuration'] as Map)['user_off'], isTrue);
      await tap(tester, 'comfort-create');
      await tap(tester, 'override-preset');
      await tester.tap(find.text('Eco').last);
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('override-heating')), findsNothing);
      await tester.enterText(
        find.byKey(const ValueKey('override-duration')),
        '15',
      );
      await tester.pump();
      await tap(tester, 'override-submit');
      expect(writes.last['preset'], 'eco');
      expect(writes.last['setpoints'], isNull);
      expect((state['configuration'] as Map)['user_off'], isTrue);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'expiry countdown only invalidates state and never posts cancellation or confirms activity',
    (tester) async {
      final override =
          (state['configuration'] as Map)['temporary_override'] as Map;
      override['expires_at'] = DateTime.now()
          .subtract(const Duration(seconds: 1))
          .toUtc()
          .toIso8601String();
      final expiry = override['expires_at'];
      await open(tester);
      final before = paths.length;
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
      expect(paths.length, greaterThan(before));
      expect(writes, isEmpty);
      expect(find.textContaining(expiry as String), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'unknown override status disables actions and exposes server clock policy truthfully',
    (tester) async {
      ((state['configuration'] as Map)['temporary_override'] as Map)['status'] =
          'future-hold';
      state['clock_policy'] = 'future-server-policy';
      await open(tester);
      await tap(tester, 'comfort-diagnostics');
      expect(find.textContaining('future-server-policy'), findsOneWidget);
      expect(
        find.textContaining('unknown states require server confirmation'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<TextButton>(find.byKey(const ValueKey('comfort-create')))
            .onPressed,
        isNull,
      );
      expect(find.byKey(const ValueKey('comfort-cancel')), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'conflict reloads without replay, and an old controller response cannot authorize current controls',
    (tester) async {
      await open(tester);
      dio.interceptors.clear();
      RequestInterceptorHandler? oldRead;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.method == 'POST') {
              writes.add(Map<String, dynamic>.from(options.data as Map));
              state['revision'] = 12;
              handler.reject(
                DioException(
                  requestOptions: options,
                  response: Response(requestOptions: options, statusCode: 422),
                  type: DioExceptionType.badResponse,
                ),
              );
            } else {
              oldRead = handler;
            }
          },
        ),
      );
      await tap(tester, 'comfort-cancel');
      expect(writes, hasLength(1));
      expect(
        tester
            .widget<TextButton>(find.byKey(const ValueKey('comfort-create')))
            .onPressed,
        isNull,
      );
      final old = oldRead;
      await open(tester, id: 'b');
      old!.resolve(
        Response(
          requestOptions: RequestOptions(path: 'old'),
          statusCode: 200,
          data: {'data': configured()},
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('override-id'), findsNothing);
      expect(find.byKey(const ValueKey('comfort-create')), findsNothing);
      expect(writes, hasLength(1));
      oldRead!.resolve(
        Response(
          requestOptions: RequestOptions(path: 'new'),
          statusCode: 200,
          data: {
            'data': {...configured(), 'controller': 'b'},
          },
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('comfort-create')), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'a reconnect invalidates an open override editor even when the revision remains the same',
    (tester) async {
      final socket = ComfortSocket();
      void Function(bool)? connection;
      when(() => socket.addConnectionListener(any())).thenAnswer((call) {
        connection = call.positionalArguments[0] as void Function(bool);
      });
      locator.registerSingleton<SocketService>(socket);
      await open(tester);
      await tap(tester, 'comfort-create');
      await tester.enterText(
        find.byKey(const ValueKey('override-heating')),
        '18',
      );
      await tester.enterText(
        find.byKey(const ValueKey('override-duration')),
        '5',
      );
      await tester.pump();
      connection!(true);
      await tester.pumpAndSettle();
      await tap(tester, 'override-submit');
      expect(writes, isEmpty);
      await tester.pumpWidget(const SizedBox());
    },
  );
  for (final language in ['cs', 'sk', 'de', 'es', 'pl']) {
    testWidgets('renders localized comfort controls in $language', (
      tester,
    ) async {
      await open(tester, language: language);
      expect(find.text('Thermostat comfort'), findsNothing);
      expect(find.byKey(const ValueKey('comfort-create')), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    });
  }
}
