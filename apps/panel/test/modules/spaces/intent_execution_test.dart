import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_lighting_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_climate_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_undo_result.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_res_undo_state.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_lighting_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_climate_intent.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/intents/models/intents/intent.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/intent_types.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:retrofit/retrofit.dart';

// Mock classes
class MockSpacesModuleClient extends Mock implements SpacesModuleClient {}

/// Fake SocketService that simulates disconnected state to force API fallback
class FakeDisconnectedSocketService extends SocketService {
  @override
  bool get isConnected => false;

  @override
  Future<void> sendCommand(
    String event,
    dynamic data,
    String handler, {
    Function(SocketCommandResponseModel?)? onAck,
  }) async {
    onAck?.call(SocketCommandResponseModel(status: false, message: 'Not connected'));
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

class FakeSpacesModuleReqLightingIntent extends Fake
    implements SpacesModuleReqLightingIntent {}

class FakeSpacesModuleReqClimateIntent extends Fake
    implements SpacesModuleReqClimateIntent {}

class FakeSpacesModuleResLightingIntent extends Fake
    implements SpacesModuleResLightingIntent {}

class FakeSpacesModuleResClimateIntent extends Fake
    implements SpacesModuleResClimateIntent {}

class FakeSpacesModuleResUndoResult extends Fake
    implements SpacesModuleResUndoResult {}

class FakeSpacesModuleResUndoState extends Fake
    implements SpacesModuleResUndoState {}

/// Creates a mock HttpResponse with the given raw data and status code
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
  late FakeDisconnectedSocketService fakeSocketService;
  late SpaceStateRepository repository;

  setUpAll(() {
    registerFallbackValue(FakeSpacesModuleReqLightingIntent());
    registerFallbackValue(FakeSpacesModuleReqClimateIntent());
  });

  setUp(() {
    mockClient = MockSpacesModuleClient();
    fakeIntentsRepository = FakeIntentsRepository();
    fakeSocketService = FakeDisconnectedSocketService();

    // Use disconnected socket to force API fallback for testing API integration
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

  group('Lighting Intent Execution E2E Tests', () {
    group('Turn Lights Off', () {
      test('successfully turns off all lights in a space', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 5,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResLightingIntent(),
              responseData,
              200,
            ));

        // Mock undo state fetch that happens after intent execution
        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {
                    'data': {
                      'can_undo': true,
                      'action_description': 'Turn off all lights',
                      'intent_category': 'lighting',
                      'expires_in_seconds': 30,
                    }
                  },
                  200,
                ));

        final result = await repository.turnLightsOff(spaceId);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(result.affectedDevices, equals(5));
        expect(result.failedDevices, equals(0));
        verify(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).called(1);
      });

      test('handles partial failure gracefully', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 3,
            'failed_devices': 2,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResLightingIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.turnLightsOff(spaceId);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(result.affectedDevices, equals(3));
        expect(result.failedDevices, equals(2));
      });

      test('returns null on API error', () async {
        const spaceId = 'space-123';

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenThrow(DioException(requestOptions: RequestOptions(path: '')));

        final result = await repository.turnLightsOff(spaceId);

        expect(result, isNull);
      });
    });

    group('Turn Lights On', () {
      test('successfully turns on all lights in a space', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 5,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResLightingIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.turnLightsOn(spaceId);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(result.affectedDevices, equals(5));
      });
    });

    group('Set Lighting Mode', () {
      test('successfully sets work mode', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 5,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResLightingIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.setLightingMode(spaceId, LightingMode.work);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });

      test('successfully sets relax mode', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 5,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResLightingIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.setLightingMode(spaceId, LightingMode.relax);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });

      test('successfully sets night mode', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 5,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResLightingIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.setLightingMode(spaceId, LightingMode.night);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });
    });

    group('Adjust Brightness', () {
      test('successfully increases brightness with small delta', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 3,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResLightingIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.adjustBrightness(
          spaceId,
          delta: BrightnessDelta.small,
          increase: true,
        );

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });

      test('successfully decreases brightness with large delta', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 3,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResLightingIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.adjustBrightness(
          spaceId,
          delta: BrightnessDelta.large,
          increase: false,
        );

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });
    });

    group('Role-based Control', () {
      test('successfully turns on main lights', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 2,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResLightingIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.turnRoleOn(spaceId, LightingStateRole.main);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(result.affectedDevices, equals(2));
      });

      test('successfully sets ambient light brightness', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 3,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceLightingIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResLightingIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.setRoleBrightness(
          spaceId,
          LightingStateRole.ambient,
          50,
        );

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });
    });
  });

  group('Climate Intent Execution E2E Tests', () {
    group('Adjust Setpoint', () {
      test('successfully increases temperature with small delta', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 2,
            'failed_devices': 0,
            'heating_setpoint': 22.5,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceClimateIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResClimateIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.adjustSetpoint(
          spaceId,
          delta: SetpointDelta.small,
          increase: true,
        );

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(result.heatingSetpoint, equals(22.5));
      });

      test('successfully decreases temperature with medium delta', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 1,
            'failed_devices': 0,
            'heating_setpoint': 21.0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceClimateIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResClimateIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.adjustSetpoint(
          spaceId,
          delta: SetpointDelta.medium,
          increase: false,
        );

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });
    });

    group('Set Exact Setpoint', () {
      test('successfully sets exact temperature', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 2,
            'failed_devices': 0,
            'heating_setpoint': 23.0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceClimateIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResClimateIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.setSetpoint(
          spaceId,
          23.0,
          mode: ClimateMode.heat,
        );

        expect(result, isNotNull);
        expect(result!.success, isTrue);
        expect(result.heatingSetpoint, equals(23.0));
      });

      test('returns null on API error', () async {
        const spaceId = 'space-123';

        when(() => mockClient.createSpacesModuleSpaceClimateIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenThrow(DioException(requestOptions: RequestOptions(path: '')));

        final result = await repository.setSetpoint(
          spaceId,
          23.0,
          mode: ClimateMode.heat,
        );

        expect(result, isNull);
      });
    });

    group('Set Climate Mode', () {
      test('successfully sets heat mode', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 1,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceClimateIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResClimateIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.setClimateMode(spaceId, ClimateMode.heat);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });

      test('successfully sets cool mode', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 1,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceClimateIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResClimateIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.setClimateMode(spaceId, ClimateMode.cool);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });

      test('successfully sets auto mode', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 1,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceClimateIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResClimateIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.setClimateMode(spaceId, ClimateMode.auto);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });

      test('successfully turns off climate', () async {
        const spaceId = 'space-123';
        final responseData = {
          'data': {
            'success': true,
            'affected_devices': 1,
            'failed_devices': 0,
          },
        };

        when(() => mockClient.createSpacesModuleSpaceClimateIntent(
              id: spaceId,
              body: any(named: 'body'),
            )).thenAnswer((_) async => createMockHttpResponse(
              FakeSpacesModuleResClimateIntent(),
              responseData,
              200,
            ));

        when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
            .thenAnswer((_) async => createMockHttpResponse(
                  FakeSpacesModuleResUndoState(),
                  {'data': null},
                  200,
                ));

        final result = await repository.setClimateMode(spaceId, ClimateMode.off);

        expect(result, isNotNull);
        expect(result!.success, isTrue);
      });
    });
  });

  group('Undo Execution E2E Tests', () {
    test('successfully executes undo after lighting intent', () async {
      const spaceId = 'space-123';

      // First execute an intent
      when(() => mockClient.createSpacesModuleSpaceLightingIntent(
            id: spaceId,
            body: any(named: 'body'),
          )).thenAnswer((_) async => createMockHttpResponse(
            FakeSpacesModuleResLightingIntent(),
            {
              'data': {
                'success': true,
                'affected_devices': 5,
                'failed_devices': 0,
              }
            },
            200,
          ));

      when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
          .thenAnswer((_) async => createMockHttpResponse(
                FakeSpacesModuleResUndoState(),
                {
                  'data': {
                    'can_undo': true,
                    'action_description': 'Turn off all lights',
                    'intent_category': 'lighting',
                    'expires_in_seconds': 30,
                  }
                },
                200,
              ));

      await repository.turnLightsOff(spaceId);

      // Verify undo state is available
      await repository.fetchUndoState(spaceId);
      final undoState = repository.getUndoState(spaceId);
      expect(undoState, isNotNull);
      expect(undoState!.canUndo, isTrue);

      // Now execute undo
      when(() => mockClient.createSpacesModuleSpaceUndo(id: spaceId))
          .thenAnswer((_) async => createMockHttpResponse(
                FakeSpacesModuleResUndoResult(),
                {
                  'data': {
                    'success': true,
                    'restored_devices': 5,
                    'failed_devices': 0,
                    'message': 'Restored 5 devices',
                  }
                },
                200,
              ));

      final undoResult = await repository.executeUndo(spaceId);

      expect(undoResult, isNotNull);
      expect(undoResult!.success, isTrue);
      expect(undoResult.restoredDevices, equals(5));
      expect(undoResult.failedDevices, equals(0));

      // Undo state should be cleared after execution
      expect(repository.getUndoState(spaceId), isNull);
    });

    test('undo returns null when undo window expired', () async {
      const spaceId = 'space-123';

      when(() => mockClient.createSpacesModuleSpaceUndo(id: spaceId))
          .thenAnswer((_) async => createMockHttpResponse(
                FakeSpacesModuleResUndoResult(),
                {'data': null},
                200,
              ));

      final undoResult = await repository.executeUndo(spaceId);

      expect(undoResult, isNull);
    });

    test('undo returns null on API error', () async {
      const spaceId = 'space-123';

      when(() => mockClient.createSpacesModuleSpaceUndo(id: spaceId))
          .thenThrow(DioException(requestOptions: RequestOptions(path: '')));

      final undoResult = await repository.executeUndo(spaceId);

      expect(undoResult, isNull);
    });
  });

  group('Intent Execution with State Refresh', () {
    test('intent execution triggers undo state refresh', () async {
      const spaceId = 'space-123';

      when(() => mockClient.createSpacesModuleSpaceLightingIntent(
            id: spaceId,
            body: any(named: 'body'),
          )).thenAnswer((_) async => createMockHttpResponse(
            FakeSpacesModuleResLightingIntent(),
            {
              'data': {
                'success': true,
                'affected_devices': 5,
                'failed_devices': 0,
              }
            },
            200,
          ));

      when(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId))
          .thenAnswer((_) async => createMockHttpResponse(
                FakeSpacesModuleResUndoState(),
                {
                  'data': {
                    'can_undo': true,
                    'action_description': 'Turn off all lights',
                    'intent_category': 'lighting',
                    'expires_in_seconds': 30,
                  }
                },
                200,
              ));

      await repository.turnLightsOff(spaceId);

      // Verify that undo state was fetched after intent execution
      verify(() => mockClient.getSpacesModuleSpaceUndoState(id: spaceId)).called(1);
    });
  });
}
