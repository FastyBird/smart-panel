import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_status.dart';
import 'package:flutter/foundation.dart';

class SecurityStatusRepository extends ChangeNotifier {
	final Dio _dio;

	SecurityStatusModel _status = SecurityStatusModel.empty;

	SecurityStatusRepository({required Dio dio}) : _dio = dio;

	SecurityStatusModel get status => _status;

	Future<void> fetchStatus() async {
		try {
			final response = await _dio.get('/v1/modules/security/status');

			if (response.statusCode == 200 && response.data != null) {
				final data = response.data is Map<String, dynamic>
					? response.data as Map<String, dynamic>
					: <String, dynamic>{};

				// Handle wrapped response (data.data pattern)
				final statusData = data.containsKey('data')
					? data['data'] as Map<String, dynamic>
					: data;

				_status = SecurityStatusModel.fromJson(statusData);
				notifyListeners();
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[SECURITY MODULE] Error fetching security status: $e');
			}
		}
	}

	void updateFromJson(Map<String, dynamic> json) {
		try {
			_status = SecurityStatusModel.fromJson(json);
			notifyListeners();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[SECURITY MODULE] Error parsing security status update: $e');
			}
		}
	}
}
