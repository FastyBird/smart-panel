import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const runtimeEvent = 'DevicesVirtualPlugin.Thermostat.RuntimeChanged';

class ThermostatSocket extends SocketService {
  final handlers = <String, void Function(String, Map<String, dynamic>)>{};
  void Function(bool)? connection;
  @override
  void registerEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) callback,
  ) => handlers[event] = callback;
  @override
  void unregisterEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) callback,
  ) => handlers.remove(event);
  @override
  void addConnectionListener(void Function(bool) listener) =>
      connection = listener;
  @override
  void removeConnectionListener(void Function(bool) listener) =>
      connection = null;
  void hint(String controller, String epoch, int sequence) =>
      handlers[runtimeEvent]?.call(runtimeEvent, {
        'controller': controller,
        'epoch': epoch,
        'sequence': sequence,
      });
}

void main() {
  testWidgets(
    'socket hints fence older reads, acknowledge self events and resync across epochs and device lifecycle',
    (tester) async {
      final socket = ThermostatSocket();
      locator.registerSingleton<SocketService>(socket);
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
      locator.registerSingleton<Dio>(dio);
      addTearDown(() {
        locator.unregister<SocketService>();
        locator.unregister<Dio>();
      });
      var epoch = 'first';
      var sequence = 0;
      var mode = 'off';
      var revision = 1;
      var staleConfigurationOnce = false;
      var runtimeReads = 0;
      var hold = false;
      final held = <void Function()>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            final runtime = options.path.endsWith('/runtime');
            final controller = options.path.contains('/other')
                ? 'other'
                : 'controller';
            final capturedEpoch = epoch;
            final capturedSequence = runtime ? ++sequence : sequence;
            final capturedMode = mode;
            final capturedRevision = revision;
            final configRevision = !runtime && staleConfigurationOnce
                ? revision - 1
                : revision;
            if (!runtime) staleConfigurationOnce = false;
            if (runtime) {
              runtimeReads++;
              // GET inspect publishes exactly this snapshot through the generic gateway.
              socket.hint(controller, capturedEpoch, capturedSequence);
            }
            void respond() => handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': runtime
                      ? {
                          'epoch': capturedEpoch,
                          'sequence': capturedSequence,
                          'configuration_revision': capturedRevision,
                          'requested_mode': capturedMode,
                          'readiness': 'ready',
                          'reasons': [],
                          'branches': [],
                        }
                      : {
                          'requested_mode': capturedMode,
                          'revision': configRevision,
                          'policy': {},
                          'settings': [],
                        },
                },
              ),
            );
            if (hold) {
              held.add(respond);
            } else {
              respond();
            }
          },
        ),
      );
      Widget detail(String id) => MaterialApp(
        home: VirtualThermostatDeviceDetail(
          device: ThermostatDeviceView(
            id: id,
            type: 'virtual',
            name: id,
            channels: const [],
          ),
        ),
      );
      await tester.pumpWidget(detail('controller'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(runtimeReads, 1);
      expect(find.text('Requested mode: off'), findsOneWidget);
      socket.hint('unrelated', epoch, 100);
      await tester.pump(const Duration(milliseconds: 200));
      expect(runtimeReads, 1);

      hold = true;
      await tester.pump(const Duration(seconds: 5));
      await tester.pump();
      expect(held.length, 2);
      mode = 'heat';
      sequence = 100;
      socket.hint('controller', epoch, sequence);
      hold = false;
      for (final respond in held.toList()) {
        respond();
      }
      held.clear();
      await tester.pump();
      // The old OFF response cannot be applied after a newer hint.
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump();
      expect(find.text('Requested mode: heat'), findsOneWidget);
      expect(runtimeReads, 3);
      await tester.pump(const Duration(seconds: 1));
      expect(
        runtimeReads,
        3,
      ); // Matching inspect hint never creates a fetch loop.

      hold = true;
      socket.hint('controller', epoch, ++sequence);
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump();
      expect(held.length, 2);
      epoch = 'restarted';
      sequence = 0;
      mode = 'cool';
      hold = false;
      socket.connection?.call(true);
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump();
      expect(find.text('Requested mode: cool'), findsOneWidget);
      expect(runtimeReads, 5);
      // Old connection responses arriving last cannot overwrite the new epoch.
      for (final respond in held.toList()) {
        respond();
      }
      held.clear();
      await tester.pump();
      expect(find.text('Requested mode: cool'), findsOneWidget);
      // A delayed event from a previous epoch is just a hint, never a rollback.
      socket.hint('controller', 'first', 99999);
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('Requested mode: cool'), findsOneWidget);
      expect(runtimeReads, 6);

      staleConfigurationOnce = true;
      revision = 2;
      mode = 'heat';
      socket.hint('controller', epoch, ++sequence);
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump();
      // A configuration/runtime pair spanning an edit must not be applied.
      expect(find.text('Requested mode: cool'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump();
      expect(find.text('Requested mode: heat'), findsOneWidget);
      expect(runtimeReads, 8);

      await tester.pumpWidget(detail('other'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 150));
      final afterChange = runtimeReads;
      socket.hint('controller', 'first', 100000);
      await tester.pump(const Duration(milliseconds: 200));
      expect(runtimeReads, afterChange);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(socket.handlers, isEmpty);
      expect(socket.connection, isNull);
      await tester.pump(const Duration(seconds: 1));
      expect(runtimeReads, afterChange);
    },
  );
}
