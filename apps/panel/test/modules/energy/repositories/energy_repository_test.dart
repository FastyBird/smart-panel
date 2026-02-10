import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_summary.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockEnergyService extends Mock implements EnergyService {}

void main() {
	late MockEnergyService mockService;
	late EnergyRepository repository;

	setUp(() {
		mockService = MockEnergyService();
		repository = EnergyRepository(service: mockService);
	});

	tearDown(() {
		repository.dispose();
	});

	group('EnergyRepository', () {
		group('checkSupport', () {
			test('returns true when backend returns valid summary', () async {
				final summary = EnergySummary.fromJson({
					'consumption': 10.5,
					'range': 'today',
				});

				when(() => mockService.fetchSummary('home', EnergyRange.today))
					.thenAnswer((_) async => summary);

				final result = await repository.checkSupport('home');

				expect(result, isTrue);
				expect(repository.isSupported, isTrue);
				expect(repository.supportChecked, isTrue);
				expect(repository.headerSummary, isNotNull);
				expect(repository.headerSummary!.consumption, 10.5);
			});

			test('returns false when backend returns null summary', () async {
				when(() => mockService.fetchSummary('home', EnergyRange.today))
					.thenAnswer((_) async => null);

				final result = await repository.checkSupport('home');

				expect(result, isFalse);
				expect(repository.isSupported, isFalse);
				expect(repository.supportChecked, isTrue);
			});

			test('returns false on 404 response', () async {
				when(() => mockService.fetchSummary('home', EnergyRange.today))
					.thenThrow(DioException(
						requestOptions: RequestOptions(path: '/api/energy/spaces/home/summary'),
						response: Response(
							requestOptions: RequestOptions(path: '/api/energy/spaces/home/summary'),
							statusCode: 404,
						),
						type: DioExceptionType.badResponse,
					));

				final result = await repository.checkSupport('home');

				expect(result, isFalse);
				expect(repository.isSupported, isFalse);
				expect(repository.supportChecked, isTrue);
			});

			test('returns false on 501 response', () async {
				when(() => mockService.fetchSummary('home', EnergyRange.today))
					.thenThrow(DioException(
						requestOptions: RequestOptions(path: '/api/energy/spaces/home/summary'),
						response: Response(
							requestOptions: RequestOptions(path: '/api/energy/spaces/home/summary'),
							statusCode: 501,
						),
						type: DioExceptionType.badResponse,
					));

				final result = await repository.checkSupport('home');

				expect(result, isFalse);
				expect(repository.isSupported, isFalse);
			});

			test('caches support check result', () async {
				when(() => mockService.fetchSummary('home', EnergyRange.today))
					.thenAnswer((_) async => EnergySummary.fromJson({
						'consumption': 5.0,
						'range': 'today',
					}));

				await repository.checkSupport('home');
				await repository.checkSupport('home');

				// Should only call the service once (cached)
				verify(() => mockService.fetchSummary('home', EnergyRange.today)).called(1);
			});
		});

		group('summary rendering', () {
			test('summary with production shows hasProduction true', () {
				final summary = EnergySummary.fromJson({
					'consumption': 15.2,
					'production': 8.5,
					'net': 6.7,
					'range': 'today',
				});

				expect(summary.hasProduction, isTrue);
				expect(summary.production, 8.5);
			});

			test('summary without production shows hasProduction false', () {
				final summary = EnergySummary.fromJson({
					'consumption': 15.2,
					'range': 'today',
				});

				expect(summary.hasProduction, isFalse);
				expect(summary.production, isNull);
			});

			test('summary with zero production shows hasProduction false', () {
				final summary = EnergySummary.fromJson({
					'consumption': 10.0,
					'production': 0.0,
					'range': 'today',
				});

				expect(summary.hasProduction, isFalse);
			});
		});

		group('state management', () {
			test('initial state is initial', () {
				expect(repository.state, EnergyDataState.initial);
				expect(repository.summary, isNull);
				expect(repository.timeseries, isNull);
				expect(repository.breakdown, isNull);
			});

			test('selectedRange defaults to today', () {
				expect(repository.selectedRange, EnergyRange.today);
			});
		});
	});
}
