import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/suggestion/suggestion.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/undo/undo_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/climate_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/covers_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/intent_types.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/light_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/spaces.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

// Mock classes
class MockSpacesRepository extends Mock implements SpacesRepository {}

class MockLightTargetsRepository extends Mock implements LightTargetsRepository {}

class MockClimateTargetsRepository extends Mock implements ClimateTargetsRepository {}

class MockCoversTargetsRepository extends Mock implements CoversTargetsRepository {}

class MockSpaceStateRepository extends Mock implements SpaceStateRepository {}

void main() {
  late MockSpacesRepository mockSpacesRepository;
  late MockLightTargetsRepository mockLightTargetsRepository;
  late MockClimateTargetsRepository mockClimateTargetsRepository;
  late MockCoversTargetsRepository mockCoversTargetsRepository;
  late MockSpaceStateRepository mockSpaceStateRepository;
  late SpacesService service;

  setUp(() {
    mockSpacesRepository = MockSpacesRepository();
    mockLightTargetsRepository = MockLightTargetsRepository();
    mockClimateTargetsRepository = MockClimateTargetsRepository();
    mockCoversTargetsRepository = MockCoversTargetsRepository();
    mockSpaceStateRepository = MockSpaceStateRepository();

    service = SpacesService(
      spacesRepository: mockSpacesRepository,
      lightTargetsRepository: mockLightTargetsRepository,
      climateTargetsRepository: mockClimateTargetsRepository,
      coversTargetsRepository: mockCoversTargetsRepository,
      spaceStateRepository: mockSpaceStateRepository,
    );
  });

  tearDown(() {
    service.dispose();
  });

  group('SpacesService', () {
    group('spaces', () {
      test('returns empty map initially', () {
        expect(service.spaces, isEmpty);
      });
    });

    group('rooms', () {
      test('returns empty list when no spaces', () {
        when(() => mockSpacesRepository.spaces).thenReturn([]);

        expect(service.rooms, isEmpty);
      });
    });

    group('zones', () {
      test('returns empty list when no spaces', () {
        when(() => mockSpacesRepository.spaces).thenReturn([]);

        expect(service.zones, isEmpty);
      });
    });

    group('getSpace', () {
      test('returns null for non-existent space', () {
        expect(service.getSpace('non-existent'), isNull);
      });
    });

    group('getSpaces', () {
      test('returns empty list for non-existent IDs', () {
        expect(service.getSpaces(['non-existent-1', 'non-existent-2']), isEmpty);
      });
    });

    group('getLightTargetsForSpace', () {
      test('returns empty list when no targets exist', () {
        expect(service.getLightTargetsForSpace('space-123'), isEmpty);
      });
    });

    group('getClimateTargetsForSpace', () {
      test('returns empty list when no targets exist', () {
        expect(service.getClimateTargetsForSpace('space-123'), isEmpty);
      });
    });

    group('getLightingState', () {
      test('delegates to SpaceStateRepository', () {
        const spaceId = 'space-123';
        final mockState = LightingStateModel(
          spaceId: spaceId,
          modeConfidence: ModeConfidence.none,
          totalLights: 3,
          lightsOn: 1,
          roles: {},
          other: OtherLightsState(
            isOn: true,
            isOnMixed: false,
            isBrightnessMixed: false,
            isColorTemperatureMixed: false,
            isColorMixed: false,
            isWhiteMixed: false,
            devicesCount: 1,
            devicesOn: 1,
          ),
        );

        when(() => mockSpaceStateRepository.getLightingState(spaceId))
            .thenReturn(mockState);

        final result = service.getLightingState(spaceId);

        expect(result, equals(mockState));
        verify(() => mockSpaceStateRepository.getLightingState(spaceId)).called(1);
      });

      test('returns null when no state exists', () {
        const spaceId = 'space-123';

        when(() => mockSpaceStateRepository.getLightingState(spaceId))
            .thenReturn(null);

        expect(service.getLightingState(spaceId), isNull);
      });
    });

    group('getClimateState', () {
      test('delegates to SpaceStateRepository', () {
        const spaceId = 'space-123';
        final mockState = ClimateStateModel(
          spaceId: spaceId,
          hasClimate: true,
          mode: ClimateMode.heat,
          currentTemperature: 21.5,
          targetTemperature: 22.0,
          minSetpoint: 15.0,
          maxSetpoint: 30.0,
          canSetSetpoint: true,
          supportsHeating: true,
          supportsCooling: false,
          isMixed: false,
          devicesCount: 1,
        );

        when(() => mockSpaceStateRepository.getClimateState(spaceId))
            .thenReturn(mockState);

        final result = service.getClimateState(spaceId);

        expect(result, equals(mockState));
        verify(() => mockSpaceStateRepository.getClimateState(spaceId)).called(1);
      });
    });

    group('getSuggestion', () {
      test('delegates to SpaceStateRepository', () {
        const spaceId = 'space-123';
        final mockSuggestion = SuggestionModel(
          type: SuggestionType.lightingRelax,
          title: 'Switch to relax mode',
          reason: 'It is evening time',
          lightingMode: LightingMode.relax,
        );

        when(() => mockSpaceStateRepository.getSuggestion(spaceId))
            .thenReturn(mockSuggestion);

        final result = service.getSuggestion(spaceId);

        expect(result, equals(mockSuggestion));
        verify(() => mockSpaceStateRepository.getSuggestion(spaceId)).called(1);
      });
    });

    group('getUndoState', () {
      test('delegates to SpaceStateRepository', () {
        const spaceId = 'space-123';
        final mockUndoState = UndoStateModel(
          canUndo: true,
          actionDescription: 'Turn off all lights',
          intentCategory: IntentCategory.lighting,
          expiresInSeconds: 30,
        );

        when(() => mockSpaceStateRepository.getUndoState(spaceId))
            .thenReturn(mockUndoState);

        final result = service.getUndoState(spaceId);

        expect(result, equals(mockUndoState));
        verify(() => mockSpaceStateRepository.getUndoState(spaceId)).called(1);
      });
    });

    group('fetchLightingState', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        final mockState = LightingStateModel(
          spaceId: spaceId,
          modeConfidence: ModeConfidence.exact,
          totalLights: 5,
          lightsOn: 3,
          roles: {},
          other: OtherLightsState(
            isOn: true,
            isOnMixed: false,
            isBrightnessMixed: false,
            isColorTemperatureMixed: false,
            isColorMixed: false,
            isWhiteMixed: false,
            devicesCount: 2,
            devicesOn: 2,
          ),
        );

        when(() => mockSpaceStateRepository.fetchLightingState(spaceId))
            .thenAnswer((_) async => mockState);

        final result = await service.fetchLightingState(spaceId);

        expect(result, equals(mockState));
        verify(() => mockSpaceStateRepository.fetchLightingState(spaceId)).called(1);
      });
    });

    group('fetchClimateState', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        final mockState = ClimateStateModel(
          spaceId: spaceId,
          hasClimate: true,
          mode: ClimateMode.cool,
          currentTemperature: 26.0,
          targetTemperature: 24.0,
          minSetpoint: 18.0,
          maxSetpoint: 28.0,
          canSetSetpoint: true,
          supportsHeating: false,
          supportsCooling: true,
          isMixed: false,
          devicesCount: 1,
        );

        when(() => mockSpaceStateRepository.fetchClimateState(spaceId))
            .thenAnswer((_) async => mockState);

        final result = await service.fetchClimateState(spaceId);

        expect(result, equals(mockState));
        verify(() => mockSpaceStateRepository.fetchClimateState(spaceId)).called(1);
      });
    });

    group('fetchUndoState', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        final mockUndoState = UndoStateModel(
          canUndo: true,
          actionDescription: 'Set mode to work',
          intentCategory: IntentCategory.lighting,
          expiresInSeconds: 25,
        );

        when(() => mockSpaceStateRepository.fetchUndoState(spaceId))
            .thenAnswer((_) async => mockUndoState);

        final result = await service.fetchUndoState(spaceId);

        expect(result, equals(mockUndoState));
        verify(() => mockSpaceStateRepository.fetchUndoState(spaceId)).called(1);
      });
    });

    group('fetchSuggestion', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        final mockSuggestion = SuggestionModel(
          type: SuggestionType.lightingNight,
          title: 'Switch to night mode',
          reason: 'It is late at night',
          lightingMode: LightingMode.night,
        );

        when(() => mockSpaceStateRepository.fetchSuggestion(spaceId))
            .thenAnswer((_) async => mockSuggestion);

        final result = await service.fetchSuggestion(spaceId);

        expect(result, equals(mockSuggestion));
        verify(() => mockSpaceStateRepository.fetchSuggestion(spaceId)).called(1);
      });
    });

    group('turnLightsOff', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';

        when(() => mockSpaceStateRepository.turnLightsOff(spaceId))
            .thenAnswer((_) async => null);

        await service.turnLightsOff(spaceId);

        verify(() => mockSpaceStateRepository.turnLightsOff(spaceId)).called(1);
      });
    });

    group('turnLightsOn', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';

        when(() => mockSpaceStateRepository.turnLightsOn(spaceId))
            .thenAnswer((_) async => null);

        await service.turnLightsOn(spaceId);

        verify(() => mockSpaceStateRepository.turnLightsOn(spaceId)).called(1);
      });
    });

    group('setLightingMode', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        const mode = LightingMode.work;

        when(() => mockSpaceStateRepository.setLightingMode(spaceId, mode))
            .thenAnswer((_) async => null);

        await service.setLightingMode(spaceId, mode);

        verify(() => mockSpaceStateRepository.setLightingMode(spaceId, mode)).called(1);
      });
    });

    group('adjustBrightness', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        const delta = BrightnessDelta.medium;
        const increase = true;

        when(() => mockSpaceStateRepository.adjustBrightness(
              spaceId,
              delta: delta,
              increase: increase,
            )).thenAnswer((_) async => null);

        await service.adjustBrightness(spaceId, delta: delta, increase: increase);

        verify(() => mockSpaceStateRepository.adjustBrightness(
              spaceId,
              delta: delta,
              increase: increase,
            )).called(1);
      });
    });

    group('executeUndo', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        final mockResult = UndoResultModel(
          success: true,
          restoredDevices: 3,
          failedDevices: 0,
          message: 'Restored 3 devices',
        );

        when(() => mockSpaceStateRepository.executeUndo(spaceId))
            .thenAnswer((_) async => mockResult);

        final result = await service.executeUndo(spaceId);

        expect(result, equals(mockResult));
        verify(() => mockSpaceStateRepository.executeUndo(spaceId)).called(1);
      });
    });

    group('fetchAllStateForSpace', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';

        when(() => mockSpaceStateRepository.fetchAllState(spaceId))
            .thenAnswer((_) async {});

        await service.fetchAllStateForSpace(spaceId);

        verify(() => mockSpaceStateRepository.fetchAllState(spaceId)).called(1);
      });
    });

    group('submitSuggestionFeedback', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        const type = SuggestionType.lightingRelax;
        const feedback = SuggestionFeedback.applied;

        when(() => mockSpaceStateRepository.submitSuggestionFeedback(
              spaceId,
              type,
              feedback,
            )).thenAnswer((_) async => null);

        await service.submitSuggestionFeedback(spaceId, type, feedback);

        verify(() => mockSpaceStateRepository.submitSuggestionFeedback(
              spaceId,
              type,
              feedback,
            )).called(1);
      });
    });

    group('setClimateMode', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        const mode = ClimateMode.auto;

        when(() => mockSpaceStateRepository.setClimateMode(spaceId, mode))
            .thenAnswer((_) async => null);

        await service.setClimateMode(spaceId, mode);

        verify(() => mockSpaceStateRepository.setClimateMode(spaceId, mode)).called(1);
      });
    });

    group('adjustSetpoint', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        const delta = SetpointDelta.small;
        const increase = true;

        when(() => mockSpaceStateRepository.adjustSetpoint(
              spaceId,
              delta: delta,
              increase: increase,
            )).thenAnswer((_) async => null);

        await service.adjustSetpoint(spaceId, delta: delta, increase: increase);

        verify(() => mockSpaceStateRepository.adjustSetpoint(
              spaceId,
              delta: delta,
              increase: increase,
            )).called(1);
      });
    });

    group('setSetpoint', () {
      test('delegates to SpaceStateRepository', () async {
        const spaceId = 'space-123';
        const value = 22.5;
        const mode = ClimateMode.heat;

        when(() => mockSpaceStateRepository.setSetpoint(spaceId, value, mode: mode))
            .thenAnswer((_) async => null);

        await service.setSetpoint(spaceId, value, mode: mode);

        verify(() => mockSpaceStateRepository.setSetpoint(spaceId, value, mode: mode)).called(1);
      });
    });
  });
}
