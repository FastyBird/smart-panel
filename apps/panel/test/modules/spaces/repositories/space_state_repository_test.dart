import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_climate_state.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_lighting_state.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_suggestion.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_undo_state.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/intents/models/intents/intent.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/suggestion/suggestion.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/undo/undo_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:retrofit/retrofit.dart';

// Mock classes
class MockSpacesModuleClient extends Mock implements SpacesModuleClient {}

/// Fake SocketService that provides minimal implementation for testing
class FakeSocketService extends SocketService {
  @override
  bool get isConnected => true;

  @override
  Future<void> sendCommand(
    String event,
    dynamic data,
    String handler, {
    Function(SocketCommandResponseModel?)? onAck,
  }) async {
    onAck?.call(SocketCommandResponseModel(status: true, message: 'ok'));
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
  late MockSpacesModuleClient mockClient;
  late FakeIntentsRepository fakeIntentsRepository;
  late FakeSocketService fakeSocketService;
  late SpaceStateRepository repository;

  setUp(() {
    mockClient = MockSpacesModuleClient();
    fakeIntentsRepository = FakeIntentsRepository();
    fakeSocketService = FakeSocketService();

    repository = SpaceStateRepository(
      apiClient: mockClient,
      intentsRepository: fakeIntentsRepository,
      commandDispatch: CommandDispatchService(socketService: fakeSocketService),
    );
  });

  tearDown(() {
    repository.dispose();
    reset(mockClient);
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
            'lighting_mode': 'relax',
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
        expect(result.lightingMode, equals(LightingMode.relax));
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
