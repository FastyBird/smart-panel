import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/security/constants.dart';
import 'package:fastybird_smart_panel/modules/security/repositories/security_status.dart';
import 'package:flutter/foundation.dart';

class SecurityModuleService {
	final SocketService _socketService;
	late final SecurityStatusRepository _statusRepository;

	SecurityModuleService({
		required Dio dio,
		required SocketService socketService,
	}) : _socketService = socketService {
		_statusRepository = SecurityStatusRepository(dio: dio);
		locator.registerSingleton(_statusRepository);
	}

	SecurityStatusRepository get statusRepository => _statusRepository;

	Future<void> initialize() async {
		try {
			await _statusRepository.fetchStatus();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[SECURITY MODULE] Error during initialization: $e');
			}
		}

		_socketService.registerEventHandler(
			SecurityModuleConstants.securityStatusEvent,
			_onSecurityStatusEvent,
		);
	}

	void _onSecurityStatusEvent(String event, Map<String, dynamic> payload) {
		if (kDebugMode) {
			debugPrint('[SECURITY MODULE] Security status event received');
		}
		_statusRepository.updateFromJson(payload);
	}

	void dispose() {
		_socketService.unregisterEventHandler(
			SecurityModuleConstants.securityStatusEvent,
			_onSecurityStatusEvent,
		);
	}
}
