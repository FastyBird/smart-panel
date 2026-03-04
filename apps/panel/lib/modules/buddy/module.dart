import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/buddy/constants.dart';
import 'package:fastybird_smart_panel/modules/buddy/models/buddy_config.dart';
import 'package:fastybird_smart_panel/modules/buddy/repositories/buddy.dart';
import 'package:fastybird_smart_panel/modules/buddy/service.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/suggestion_notification_service.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';

class BuddyModuleService {
	final SocketService _socketService;

	late BuddyRepository _buddyRepository;
	late BuddyService _buddyService;
	late SuggestionNotificationService _notificationService;
	late ModuleConfigRepository<BuddyConfigModel> _buddyConfigRepo;

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

		_notificationService = SuggestionNotificationService(
			onDismissed: (suggestionId) {
				_buddyService.dismissSuggestion(suggestionId);
			},
		);

		// Wire up WebSocket suggestion events to the notification service
		_buddyRepository.onSuggestionCreated = (suggestion) {
			_notificationService.enqueue(suggestion);
		};

		locator.registerSingleton(_buddyRepository);
		locator.registerSingleton(_buddyService);
		locator.registerSingleton(_notificationService);
	}

	Future<void> initialize() async {
		_isLoading = true;

		// Register buddy config model with config module
		final configModule = locator<ConfigModuleService>();
		configModule.registerModule<BuddyConfigModel>(
			'buddy-module',
			BuddyConfigModel.fromJson,
		);

		_buddyConfigRepo = configModule.getModuleRepository<BuddyConfigModel>('buddy-module');

		_buddyService.setConfigRepository(_buddyConfigRepo);

		try {
			await _buddyConfigRepo.fetchConfiguration();
		} catch (e) {
			if (kDebugMode) {
				debugPrint(
					'[BUDDY MODULE] Error fetching buddy config: $e',
				);
			}
		}

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
	SuggestionNotificationService get notificationService => _notificationService;
	ModuleConfigRepository<BuddyConfigModel> get buddyConfigRepo => _buddyConfigRepo;

	void dispose() {
		_socketService.unregisterEventHandler(
			BuddyModuleConstants.moduleWildcardEvent,
			_socketEventHandler,
		);

		_buddyRepository.onSuggestionCreated = null;
		_notificationService.dispose();
		_buddyService.dispose();
		_buddyRepository.dispose();
	}

	void _socketEventHandler(String event, Map<String, dynamic> payload) {
		_buddyRepository.handleSocketEvent(event, payload);
	}
}
