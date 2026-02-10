import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';

/// Module service for the energy feature.
///
/// Mirrors [SecurityModuleService]: owns the [EnergyRepository],
/// initializes support detection, and provides a clean lifecycle.
class EnergyModuleService {
	late final EnergyRepository _repository;

	EnergyModuleService({
		required EnergyService energyService,
	}) {
		_repository = EnergyRepository(service: energyService);
	}

	EnergyRepository get repository => _repository;

	/// Checks if energy is supported for the given space and pre-fetches data.
	///
	/// Uses 'home' as the default space for whole-installation energy.
	Future<void> initialize({String spaceId = 'home'}) async {
		try {
			final supported = await _repository.checkSupport(spaceId);

			if (supported) {
				await _repository.fetchData(spaceId);
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[ENERGY MODULE] Error during initialization: $e');
			}
		}
	}

	void dispose() {
		_repository.dispose();
	}
}
