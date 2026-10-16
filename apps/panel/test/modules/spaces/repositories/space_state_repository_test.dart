import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/interceptors/retry_interceptor.dart';
import 'package:fastybird_smart_panel/core/interceptors/token_refresh_interceptor.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart' show DeviceView, DevicesModuleDeviceCategory;
import 'package:fastybird_smart_panel/api/models/spaces_module_req_covers_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_covers_intent.dart';

import 'package:fastybird_smart_panel/api/models/spaces_module_res_climate_state.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_lighting_state.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_suggestion.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_undo_state.dart';
import 'package:fastybird_smart_panel/api/spaces_home_control_plugin/spaces_home_control_plugin_client.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/intents/models/intents/intent.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/climate_state/climate_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/suggestion/suggestion.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/undo/undo_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/space_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:retrofit/retrofit.dart';

class UnknownDevices extends Mock implements DevicesService {}

class CoverDisplay extends Mock implements DisplayRepository {}

class FakeCoverRequest extends Fake implements SpacesModuleReqCoversIntent {}

class FakeCoverResponse extends Fake implements SpacesModuleResCoversIntent {}

class CoverAdapter implements HttpClientAdapter {
  int calls = 0;
  int status = 200;
  bool timeout = false;
  bool composite = true;
  RequestOptions? last;
  Completer<void>? gate;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls++;
    last = options;
    if (gate != null) await gate!.future;
    if (timeout) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.receiveTimeout,
      );
    }
    return ResponseBody.fromString(
      jsonEncode({
        'data': {
          'success': true,
          'affected_devices': 1,
          'failed_devices': 0,
          if (composite)
            'composites': [
              {'id': 'parent', 'status': 'confirmed', 'children': []},
            ],
        },
      }),
      status,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

// Mock classes
class MockSpacesHomeControlPluginClient extends Mock
    implements SpacesHomeControlPluginClient {}

/// Fake SocketService that provides minimal implementation for testing
class FakeSocketService extends SocketService {
  int sends = 0;
  bool ackSuccess = true;
  @override
  bool get isConnected => true;

  @override
  Future<void> sendCommand(
    String event,
    dynamic data,
    String handler, {
    Function(SocketCommandResponseModel?)? onAck,
  }) async {
    sends++;
    onAck?.call(SocketCommandResponseModel(status: ackSuccess, message: 'ok'));
  }
}

/// Fake IntentsRepository that provides minimal implementation for testing
class FakeIntentsRepository extends Fake implements IntentsRepository {
  int _counter = 0;

  @override
  IntentModel createLocalSpaceIntent({
    required String spaceId,
    required IntentType type,
    required dynamic value,
    int ttlMs = 5000,
  }) {
    _counter++;
    // Generate a valid UUID-like ID for testing
    final fakeId =
        '00000000-0000-4000-8000-${_counter.toString().padLeft(12, '0')}';
    return IntentModel(
      id: fakeId,
      type: type,
      // Don't pass spaceId to context since test IDs aren't valid UUIDs
      context: IntentContext(origin: IntentOrigin.panelSpaces),
      targets: [],
      value: {'space:$spaceId': value},
      status: IntentStatus.pending,
      ttlMs: ttlMs,
      createdAt: DateTime.now(),
      expiresAt: DateTime.now().add(Duration(milliseconds: ttlMs)),
    );
  }
}

class FakeSpacesModuleResLightingState extends Fake
    implements SpacesModuleResLightingState {}

class FakeSpacesModuleResClimateState extends Fake
    implements SpacesModuleResClimateState {}

class FakeSpacesModuleResUndoState extends Fake
    implements SpacesModuleResUndoState {}

class FakeSpacesModuleResSuggestion extends Fake
    implements SpacesModuleResSuggestion {}

/// Creates a mock HttpResponse with the given raw data and status code.
///
/// The repository extracts data from response.response.data['data'],
/// so we create a typed response where the Dio Response contains the raw data.
HttpResponse<T> createMockHttpResponse<T>(
  T data,
  Map<String, dynamic> rawData,
  int statusCode,
) {
  final response = Response<dynamic>(
    requestOptions: RequestOptions(path: ''),
    statusCode: statusCode,
    data: rawData,
  );
  return HttpResponse<T>(data, response);
}

void main() {
  setUpAll(() => registerFallbackValue(FakeCoverRequest()));
  late MockSpacesHomeControlPluginClient mockClient;
  late FakeIntentsRepository fakeIntentsRepository;
  late FakeSocketService fakeSocketService;
  late SpaceStateRepository repository;

  setUp(() {
    mockClient = MockSpacesHomeControlPluginClient();
    fakeIntentsRepository = FakeIntentsRepository();
    fakeSocketService = FakeSocketService();

    repository = SpaceStateRepository(
      apiClient: mockClient,
      intentsRepository: fakeIntentsRepository,
      commandDispatch: CommandDispatchService(socketService: fakeSocketService),
    );
  });

  tearDown(() async {
    await locator.reset();
    repository.dispose();
    reset(mockClient);
  });

  group('single-shot cover classification', () {
    for (final loading in [false, true]) {
      for (final composite in [false, true]) {
        test(
          'unknown targets loading=$loading use one REST request, server composite=$composite, no WebSocket',
          () async {
            if (loading) {
              final devices = UnknownDevices();
              when(() => devices.devicesLoaded).thenReturn(false);
              locator.registerSingleton<DevicesService>(devices);
            }
            final adapter = CoverAdapter()..composite = composite;
            final dio = Dio()..httpClientAdapter = adapter;
            locator.registerSingleton<Dio>(dio);
            final result = await repository.openCovers('room');
            expect(result?.success, isTrue);
            expect(adapter.calls, 1);
            expect(fakeSocketService.sends, 0);
            expect(adapter.last?.extra['retryExhausted'], isTrue);
            expect(adapter.last?.extra['noActuationReplay'], isTrue);
            expect(adapter.last?.receiveTimeout, const Duration(seconds: 35));
            dio.close();
          },
        );
      }
    }
    for (final status in [401, 500, 0]) {
      test(
        'unknown target HTTP $status cannot be replayed by transport or token refresh interceptors',
        () async {
          final adapter = CoverAdapter()
            ..status = status
            ..timeout = status == 0;
          final display = CoverDisplay();
          final dio = Dio()..httpClientAdapter = adapter;
          dio.interceptors.addAll([
            RetryInterceptor(dio, config: RetryConfig.testConfig),
            TokenRefreshInterceptor(display),
          ]);
          locator.registerSingleton<Dio>(dio);
          expect(await repository.openCovers('room'), isNull);
          expect(adapter.calls, 1);
          expect(fakeSocketService.sends, 0);
          verifyNever(() => display.refreshToken());
          dio.close();
        },
      );
    }
    testWidgets(
      'unknown REST timeout does not replay or accept a late completion',
      (tester) async {
        final adapter = CoverAdapter()..gate = Completer<void>();
        final dio = Dio()..httpClientAdapter = adapter;
        locator.registerSingleton<Dio>(dio);
        final pending = repository.openCovers('room');
        for (var phase = 0; phase < 10 && adapter.calls == 0; phase++) {
          await tester.pump(Duration.zero);
        }
        expect(adapter.calls, 1);
        expect(fakeSocketService.sends, 0);
        await tester.pump(const Duration(seconds: 35));
        expect(await pending, isNull);
        adapter.gate!.complete();
        // Drain Dio's late response interceptor timers without advancing the deadline.
        for (var phase = 0; phase < 10; phase++) {
          await tester.pump(Duration.zero);
        }
        expect(adapter.calls, 1);
        expect(fakeSocketService.sends, 0);
        dio.close();
      },
    );
    test('known ordinary covers retain WebSocket then REST fallback', () async {
      repository.updateCoversState('room', {'has_covers': true});
      fakeSocketService.ackSuccess = false;
      when(
        () => mockClient.createSpacesModuleSpaceCoversIntent(
          id: 'room',
          body: any(named: 'body'),
        ),
      ).thenAnswer(
        (_) async => createMockHttpResponse(FakeCoverResponse(), {
          'data': {'success': true, 'affected_devices': 1, 'failed_devices': 0},
        }, 200),
      );
      expect((await repository.openCovers('room'))?.success, isTrue);
      expect(fakeSocketService.sends, 1);
      verify(
        () => mockClient.createSpacesModuleSpaceCoversIntent(
          id: 'room',
          body: any(named: 'body'),
        ),
      ).called(1);
    });
    test(
      'known group catalogue overrides an older ordinary room classification without replay',
      () async {
        repository.updateCoversState('room', {'has_covers': true});
        final devices = UnknownDevices();
        when(() => devices.devicesLoaded).thenReturn(true);
        when(() => devices.devicesList).thenReturn([
          DeviceView(
            id: 'group',
            name: 'Group',
            type: 'virtual',
            channels: [],
            isCompositeGroup: true,
            category: DevicesModuleDeviceCategory.windowCovering,
            roomId: 'room',
          ),
        ]);
        locator.registerSingleton<DevicesService>(devices);
        fakeSocketService.ackSuccess = false;
        expect(await repository.openCovers('room'), isNull);
        expect(fakeSocketService.sends, 1);
        verifyNever(
          () => mockClient.createSpacesModuleSpaceCoversIntent(
            id: any(named: 'id'),
            body: any(named: 'body'),
          ),
        );
      },
    );
    test(
      'known composite covers do not REST replay an unconfirmed WebSocket submission',
      () async {
        repository.updateCoversState('room', {
          'has_covers': true,
          'group_operations': [
            {'operation': 'open', 'commandable': true},
          ],
        });
        fakeSocketService.ackSuccess = false;
        final adapter = CoverAdapter();
        final dio = Dio()..httpClientAdapter = adapter;
        locator.registerSingleton<Dio>(dio);
        expect(await repository.openCovers('room'), isNull);
        expect(fakeSocketService.sends, 1);
        expect(adapter.calls, 0);
        dio.close();
      },
    );
  });
  group('SpaceStateRepository', () {
    group('isLoading', () {
      test('initially returns false', () {
        expect(repository.isLoading, isFalse);
      });
    });

    group('fetchLightingState', () {
      test('returns LightingStateModel on successful API response', () async {
        const spaceId = 'space-123';
        final rawData = {
          'data': {
            'detected_mode': 'work',
            'mode_confidence': 'exact',
            'mode_match_percentage': 95.0,
            'last_applied_mode': 'work',
            'last_applied_at': '2024-01-01T12:00:00Z',
            'total_lights': 5,
            'lights_on': 3,
            'average_brightness': 75.0,
            'roles': <String, dynamic>{},
            'other': {
              'is_on': true,
              'is_on_mixed': false,
              'brightness': 80,
              'devices_count': 2,
              'devices_on': 2,
              'is_brightness_mixed': false,
              'is_color_temperature_mixed': false,
              'is_color_mixed': false,
              'is_white_mixed': false,
            },
          },
        };

        final httpResponse = createMockHttpResponse<SpacesModuleResLightingState>(
          FakeSpacesModuleResLightingState(),
          rawData,
          200,
        );

        when(() => mockClient.getSpacesModuleSpaceLightingState(id: spaceId))
            .thenAnswer((_) async => httpResponse);

        final result = await repository.fetchLightingState(spaceId);

        expect(result, isNotNull);
        expect(result!.spaceId, equals(spaceId));
        expect(result.detectedMode, equals(LightingMode.work));
        expect(result.modeConfidence, equals(ModeConfidence.exact));
        expect(result.totalLights, equals(5));
        expect(result.lightsOn, equals(3));
        verify(() => mockClient.getSpacesModuleSpaceLightingState(id: spaceId))
            .called(1);
      });

      test('returns null on API error', () async {
        const spaceId = 'space-123';

        when(() => mockClient.getSpacesModuleSpaceLightingState(id: spaceId))
            .thenThrow(DioException(requestOptions: RequestOptions(path: '')));

        final result = await repository.fetchLightingState(spaceId);

        expect(result, isNull);
      });

      test('caches lighting state after successful fetch', () async {
        const spaceId = 'space-123';
        final rawData = {
          'data': {
            'detected_mode': 'relax',
            'mode_confidence': 'approximate',
            'total_lights': 3,
            'lights_on': 1,
            'roles': <String, dynamic>{},
            'other': {
              'is_on': false,
              'is_on_mixed': false,
              'devices_count': 0,
              'devices_on': 0,
              'is_brightness_mixed': false,
              'is_color_temperature_mixed': false,
              'is_color_mixed': false,
              'is_white_mixed': false,
            },
          },
        };

        final httpResponse = createMockHttpResponse<SpacesModuleResLightingState>(
          FakeSpacesModuleResLightingState(),
          rawData,
          200,
        );

        when(() => mockClient.getSpacesModuleSpaceLightingState(id: spaceId))
            .thenAnswer((_) async => httpResponse);

        await repository.fetchLightingState(spaceId);

        final cached = repository.getLightingState(spaceId);
        expect(cached, isNotNull);
        expect(cached!.detectedMode, equals(LightingMode.relax));
      });
    });

    group('fetchClimateState', () {
      test('returns ClimateStateModel on successful API response', () async {
        const spaceId = 'space-123';
        final rawData = {
          'data': {
            'has_climate': true,
            'mode': 'heat',
            'current_temperature': 21.5,
            'current_humidity': 45.0,
            'heating_setpoint': 22.0,
            'cooling_setpoint': 24.0,
            'min_setpoint': 15.0,
            'max_setpoint': 30.0,
                        'supports_heating': true,
            'supports_cooling': true,
            'is_mixed': false,
            'devices_count': 2,
          },
        };

        final httpResponse = createMockHttpResponse<SpacesModuleResClimateState>(
          FakeSpacesModuleResClimateState(),
          rawData,
          200,
        );

        when(() => mockClient.getSpacesModuleSpaceClimate(id: spaceId))
            .thenAnswer((_) async => httpResponse);

        final result = await repository.fetchClimateState(spaceId);

        expect(result, isNotNull);
        expect(result!.spaceId, equals(spaceId));
        expect(result.hasClimate, isTrue);
        expect(result.mode, equals(ClimateMode.heat));
        expect(result.currentTemperature, equals(21.5));
        expect(result.heatingSetpoint, equals(22.0));
        verify(() => mockClient.getSpacesModuleSpaceClimate(id: spaceId))
            .called(1);
      });

      test('returns null on API error', () async {
        const spaceId = 'space-123';

        when(() => mockClient.getSpacesModuleSpaceClimate(id: spaceId))
            .thenThrow(DioException(requestOptions: RequestOptions(path: '')));

        final result = await repository.fetchClimateState(spaceId);

        expect(result, isNull);
      });
    });

    group('fetchUndoState', () {
      test('returns UndoStateModel on successful API response', () async {
        const spaceId = 'space-123';
        final rawData = {
          'data': {
            'can_undo': true,
            'action_description': 'Turn off all lights',
            'intent_category': 'lighting',
            'captured_at': '2024-01-01T12:00:00Z',
            'expires_in_seconds': 30,
          },
        };

        final httpResponse = createMockHttpResponse<SpacesModuleResUndoState>(
          FakeSpacesModuleResUndoState(),
          rawData,
          200,
        );

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => httpResponse);

        final result = await repository.fetchUndoState(spaceId);

        expect(result, isNotNull);
        expect(result!.canUndo, isTrue);
        expect(result.actionDescription, equals('Turn off all lights'));
        expect(result.intentCategory, equals(IntentCategory.lighting));
        expect(result.expiresInSeconds, equals(30));
        verify(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .called(1);
      });

      test('returns null when API returns null data', () async {
        const spaceId = 'space-123';
        final rawData = {'data': null};

        final httpResponse = createMockHttpResponse<SpacesModuleResUndoState>(
          FakeSpacesModuleResUndoState(),
          rawData,
          200,
        );

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => httpResponse);

        final result = await repository.fetchUndoState(spaceId);

        expect(result, isNull);
      });

      test('returns null on API error', () async {
        const spaceId = 'space-123';

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenThrow(DioException(requestOptions: RequestOptions(path: '')));

        final result = await repository.fetchUndoState(spaceId);

        expect(result, isNull);
      });
    });

    group('fetchSuggestion', () {
      test('returns SuggestionModel on successful API response', () async {
        const spaceId = 'space-123';
        final rawData = {
          'data': {
            'type': 'lighting_relax',
            'title': 'Switch to relax mode',
            'reason': 'It is evening time',
            'intent_type': 'lighting',
            'intent_mode': 'relax',
          },
        };

        final httpResponse = createMockHttpResponse<SpacesModuleResSuggestion>(
          FakeSpacesModuleResSuggestion(),
          rawData,
          200,
        );

        when(() => mockClient.getSpacesModuleSpaceSuggestion(id: spaceId))
            .thenAnswer((_) async => httpResponse);

        final result = await repository.fetchSuggestion(spaceId);

        expect(result, isNotNull);
        expect(result!.type, equals(SuggestionType.lightingRelax));
        expect(result.title, equals('Switch to relax mode'));
        expect(result.reason, equals('It is evening time'));
        expect(result.intentType, equals('lighting'));
        expect(result.intentMode, equals('relax'));
        verify(() => mockClient.getSpacesModuleSpaceSuggestion(id: spaceId))
            .called(1);
      });

      test('returns null when API returns null data', () async {
        const spaceId = 'space-123';
        final rawData = {'data': null};

        final httpResponse = createMockHttpResponse<SpacesModuleResSuggestion>(
          FakeSpacesModuleResSuggestion(),
          rawData,
          200,
        );

        when(() => mockClient.getSpacesModuleSpaceSuggestion(id: spaceId))
            .thenAnswer((_) async => httpResponse);

        final result = await repository.fetchSuggestion(spaceId);

        expect(result, isNull);
      });
    });

    group('updateLightingState', () {
      test('updates cached state from JSON', () {
        const spaceId = 'space-123';
        final json = {
          'detected_mode': 'night',
          'mode_confidence': 'exact',
          'total_lights': 2,
          'lights_on': 0,
          'roles': <String, dynamic>{},
          'other': {
            'is_on': false,
            'is_on_mixed': false,
            'devices_count': 0,
            'devices_on': 0,
            'is_brightness_mixed': false,
            'is_color_temperature_mixed': false,
            'is_color_mixed': false,
            'is_white_mixed': false,
          },
        };

        repository.updateLightingState(spaceId, json);

        final cached = repository.getLightingState(spaceId);
        expect(cached, isNotNull);
        expect(cached!.detectedMode, equals(LightingMode.night));
        expect(cached.totalLights, equals(2));
        expect(cached.lightsOn, equals(0));
      });

      test('notifies listeners when state is updated', () {
        const spaceId = 'space-123';
        final json = {
          'detected_mode': 'work',
          'mode_confidence': 'none',
          'total_lights': 1,
          'lights_on': 1,
          'roles': <String, dynamic>{},
          'other': {
            'is_on': true,
            'is_on_mixed': false,
            'devices_count': 1,
            'devices_on': 1,
            'is_brightness_mixed': false,
            'is_color_temperature_mixed': false,
            'is_color_mixed': false,
            'is_white_mixed': false,
          },
        };

        var notified = false;
        repository.addListener(() => notified = true);

        repository.updateLightingState(spaceId, json);

        expect(notified, isTrue);
      });
    });

    group('updateClimateState', () {
      test('updates cached state from JSON', () {
        const spaceId = 'space-123';
        final json = {
          'has_climate': true,
          'mode': 'cool',
          'current_temperature': 26.0,
          'cooling_setpoint': 24.0,
                    'supports_heating': false,
          'supports_cooling': true,
          'is_mixed': false,
          'devices_count': 1,
          'min_setpoint': 18.0,
          'max_setpoint': 28.0,
        };

        repository.updateClimateState(spaceId, json);

        final cached = repository.getClimateState(spaceId);
        expect(cached, isNotNull);
        expect(cached!.mode, equals(ClimateMode.cool));
        expect(cached.currentTemperature, equals(26.0));
        expect(cached.coolingSetpoint, equals(24.0));
      });
    });

    group('clearAll', () {
      test('clears all cached state', () async {
        const spaceId = 'space-123';

        // Setup and fetch some state
        final rawData = {
          'data': {
            'detected_mode': 'work',
            'mode_confidence': 'exact',
            'total_lights': 1,
            'lights_on': 1,
            'roles': <String, dynamic>{},
            'other': {
              'is_on': true,
              'is_on_mixed': false,
              'devices_count': 1,
              'devices_on': 1,
              'is_brightness_mixed': false,
              'is_color_temperature_mixed': false,
              'is_color_mixed': false,
              'is_white_mixed': false,
            },
          },
        };

        final httpResponse = createMockHttpResponse<SpacesModuleResLightingState>(
          FakeSpacesModuleResLightingState(),
          rawData,
          200,
        );

        when(() => mockClient.getSpacesModuleSpaceLightingState(id: spaceId))
            .thenAnswer((_) async => httpResponse);

        await repository.fetchLightingState(spaceId);
        expect(repository.getLightingState(spaceId), isNotNull);

        // Clear all
        repository.clearAll();

        expect(repository.getLightingState(spaceId), isNull);
        expect(repository.getClimateState(spaceId), isNull);
        expect(repository.getUndoState(spaceId), isNull);
        expect(repository.getSuggestion(spaceId), isNull);
      });

      test('resets loading counter', () async {
        repository.clearAll();
        expect(repository.isLoading, isFalse);
      });
    });

    group('clearForSpace', () {
      test('clears only specified space state', () async {
        const spaceId1 = 'space-1';
        const spaceId2 = 'space-2';

        final json = {
          'detected_mode': 'work',
          'mode_confidence': 'exact',
          'total_lights': 1,
          'lights_on': 1,
          'roles': <String, dynamic>{},
          'other': {
            'is_on': true,
            'is_on_mixed': false,
            'devices_count': 1,
            'devices_on': 1,
            'is_brightness_mixed': false,
            'is_color_temperature_mixed': false,
            'is_color_mixed': false,
            'is_white_mixed': false,
          },
        };

        repository.updateLightingState(spaceId1, json);
        repository.updateLightingState(spaceId2, json);

        expect(repository.getLightingState(spaceId1), isNotNull);
        expect(repository.getLightingState(spaceId2), isNotNull);

        repository.clearForSpace(spaceId1);

        expect(repository.getLightingState(spaceId1), isNull);
        expect(repository.getLightingState(spaceId2), isNotNull);
      });
    });

    group('invalidateUndoState', () {
      test('removes cached undo state for space', () async {
        const spaceId = 'space-123';
        final rawData = {
          'data': {
            'can_undo': true,
            'action_description': 'Test action',
            'intent_category': 'lighting',
            'expires_in_seconds': 30,
          },
        };

        final httpResponse = createMockHttpResponse<SpacesModuleResUndoState>(
          FakeSpacesModuleResUndoState(),
          rawData,
          200,
        );

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => httpResponse);

        await repository.fetchUndoState(spaceId);
        expect(repository.getUndoState(spaceId), isNotNull);

        repository.invalidateUndoState(spaceId);

        expect(repository.getUndoState(spaceId), isNull);
      });
    });

    group('concurrent loading tracking', () {
      test('tracks multiple concurrent fetches correctly', () async {
        const spaceId = 'space-123';
        final rawData = {
          'data': {
            'detected_mode': 'work',
            'mode_confidence': 'exact',
            'total_lights': 1,
            'lights_on': 1,
            'roles': <String, dynamic>{},
            'other': {
              'is_on': true,
              'is_on_mixed': false,
              'devices_count': 1,
              'devices_on': 1,
              'is_brightness_mixed': false,
              'is_color_temperature_mixed': false,
              'is_color_mixed': false,
              'is_white_mixed': false,
            },
          },
        };

        final httpResponse = createMockHttpResponse<SpacesModuleResLightingState>(
          FakeSpacesModuleResLightingState(),
          rawData,
          200,
        );

        when(() => mockClient.getSpacesModuleSpaceLightingState(id: spaceId))
            .thenAnswer((_) async => httpResponse);

        // Start multiple fetches concurrently
        final future1 = repository.fetchLightingState(spaceId);
        final future2 = repository.fetchLightingState(spaceId);

        // Wait for both to complete
        await Future.wait([future1, future2]);

        // After all fetches complete, loading should be false
        expect(repository.isLoading, isFalse);
      });
    });
  });
}
