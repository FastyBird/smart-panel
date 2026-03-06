import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_event.dart';
import 'package:flutter/foundation.dart';

enum SecurityEventsState {
	initial,
	loading,
	loaded,
	error,
}

/// Error types for the security events repository.
///
/// Used to store structured error information so the UI can localize
/// error messages using [AppLocalizations] from a widget context.
enum SecurityEventsErrorType {
	unexpectedResponse,
	loadFailed,
}

class SecurityEventsRepository extends ChangeNotifier {
	final Dio _dio;

	List<SecurityEventModel> _events = [];
	SecurityEventsState _state = SecurityEventsState.initial;
	String? _errorMessage;
	SecurityEventsErrorType? _errorType;

	SecurityEventsRepository({required Dio dio}) : _dio = dio;

	List<SecurityEventModel> get events => _events;
	SecurityEventsState get state => _state;
	String? get errorMessage => _errorMessage;
	SecurityEventsErrorType? get errorType => _errorType;

	Future<void> fetchEvents({int limit = 50}) async {
		_state = SecurityEventsState.loading;
		_errorMessage = null;
		_errorType = null;
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
				_errorType = SecurityEventsErrorType.unexpectedResponse;
				_errorMessage = 'Unexpected response';
			}
		} catch (e) {
			_state = SecurityEventsState.error;
			_errorType = SecurityEventsErrorType.loadFailed;
			_errorMessage = 'Failed to load events';

			if (kDebugMode) {
				debugPrint('[SECURITY MODULE] Error fetching security events: $e');
			}
		}

		notifyListeners();
	}
}
