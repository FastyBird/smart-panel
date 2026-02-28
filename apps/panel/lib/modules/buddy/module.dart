import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/buddy/constants.dart';
import 'package:fastybird_smart_panel/modules/buddy/repositories/buddy.dart';
import 'package:fastybird_smart_panel/modules/buddy/service.dart';

class BuddyModuleService {
	final SocketService _socketService;

	late BuddyRepository _buddyRepository;
	late BuddyService _buddyService;

	bool _isLoading = true;

	BuddyModuleService({
		required Dio dio,
		required SocketService socketService,
	}) : _socketService = socketService {
		_buddyRepository = BuddyRepository(
			dio: dio,
		);

		_buddyService = BuddyService(
			buddyRepository: _buddyRepository,
		);

		locator.registerSingleton(_buddyRepository);
		locator.registerSingleton(_buddyService);
	}

	Future<void> initialize() async {
		_isLoading = true;

		try {
			await _buddyService.initialize();
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error during initialization: $e',
				);
			}
			// Non-critical — buddy module failure should not block the app
		}

		_isLoading = false;

		_socketService.registerEventHandler(
			BuddyModuleConstants.moduleWildcardEvent,
			_socketEventHandler,
		);

		if (kDebugMode) {
			debugPrint(
				'[BUDDY MODULE] Module was successfully initialized',
			);
		}
	}

	bool get isLoading => _isLoading;

	BuddyRepository get buddyRepository => _buddyRepository;
	BuddyService get buddyService => _buddyService;

	void dispose() {
		_socketService.unregisterEventHandler(
			BuddyModuleConstants.moduleWildcardEvent,
			_socketEventHandler,
		);
	}

	void _socketEventHandler(String event, Map<String, dynamic> payload) {
		_buddyRepository.handleSocketEvent(event, payload);
	}
}
