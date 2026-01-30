import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_status.dart';
import 'package:flutter/foundation.dart';

class SecurityStatusRepository extends ChangeNotifier {
	final Dio _dio;

	SecurityStatusModel _status = SecurityStatusModel.empty;

	SecurityStatusRepository({required Dio dio}) : _dio = dio;

	SecurityStatusModel get status => _status;

	Map<String, dynamic> _unwrapPayload(Map<String, dynamic> json) {
		return json.containsKey('data') && json['data'] is Map<String, dynamic>
			? json['data'] as Map<String, dynamic>
			: json;
	}

	Future<void> fetchStatus() async {
		try {
			final response = await _dio.get('/modules/security/status');

			if (response.statusCode == 200 && response.data != null) {
				final data = response.data is Map<String, dynamic>
					? response.data as Map<String, dynamic>
					: <String, dynamic>{};

				_status = SecurityStatusModel.fromJson(_unwrapPayload(data));
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
			_status = SecurityStatusModel.fromJson(_unwrapPayload(json));
			notifyListeners();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[SECURITY MODULE] Error parsing security status update: $e');
			}
		}
	}
}
