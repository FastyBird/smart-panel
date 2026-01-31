import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_event.dart';
import 'package:flutter/foundation.dart';

enum SecurityEventsState {
	initial,
	loading,
	loaded,
	error,
}

class SecurityEventsRepository extends ChangeNotifier {
	final Dio _dio;

	List<SecurityEventModel> _events = [];
	SecurityEventsState _state = SecurityEventsState.initial;
	String? _errorMessage;

	SecurityEventsRepository({required Dio dio}) : _dio = dio;

	List<SecurityEventModel> get events => _events;
	SecurityEventsState get state => _state;
	String? get errorMessage => _errorMessage;

	Future<void> fetchEvents({int limit = 50}) async {
		_state = SecurityEventsState.loading;
		_errorMessage = null;
		notifyListeners();

		try {
			final response = await _dio.get(
				'/modules/security/events',
				queryParameters: {'limit': limit},
			);

			if (response.statusCode == 200 && response.data != null) {
				final data = response.data is Map<String, dynamic>
					? response.data as Map<String, dynamic>
					: <String, dynamic>{};

				final List<dynamic> eventsList = data.containsKey('data')
					? data['data'] as List<dynamic>
					: [];

				_events = eventsList
					.map((e) => SecurityEventModel.fromJson(e as Map<String, dynamic>))
					.toList();

				// Sort newest first
				_events.sort((a, b) => b.timestamp.compareTo(a.timestamp));

				_state = SecurityEventsState.loaded;
			} else {
				_state = SecurityEventsState.error;
				_errorMessage = 'Unexpected response';
			}
		} catch (e) {
			_state = SecurityEventsState.error;
			_errorMessage = 'Failed to load events';

			if (kDebugMode) {
				debugPrint('[SECURITY MODULE] Error fetching security events: $e');
			}
		}

		notifyListeners();
	}
}
