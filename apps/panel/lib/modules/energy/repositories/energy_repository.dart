import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/energy/models/energy_breakdown.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_summary.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_timeseries.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';

/// Fetch state for energy data.
enum EnergyDataState {
	initial,
	loading,
	loaded,
	error,
}

/// Repository that manages energy state for the standalone energy screen.
///
/// Wraps [EnergyService] and adds reactive state management via [ChangeNotifier].
/// Also handles support detection: if the backend returns 404/501 for the
/// summary endpoint, energy is considered unsupported.
class EnergyRepository extends ChangeNotifier {
	final EnergyService _service;

	EnergyDataState _state = EnergyDataState.initial;
	bool _isSupported = false;
	bool _supportChecked = false;

	EnergySummary? _summary;
	EnergyTimeseries? _timeseries;
	EnergyBreakdown? _breakdown;
	EnergyRange _selectedRange = EnergyRange.today;

	EnergyRepository({required EnergyService service}) : _service = service;

	// ---------------------------------------------------------------------------
	// GETTERS
	// ---------------------------------------------------------------------------

	EnergyDataState get state => _state;
	bool get isSupported => _isSupported;
	bool get supportChecked => _supportChecked;
	EnergySummary? get summary => _summary;
	EnergyTimeseries? get timeseries => _timeseries;
	EnergyBreakdown? get breakdown => _breakdown;
	EnergyRange get selectedRange => _selectedRange;

	/// Summary for the header widget (fetched separately for "today" range).
	EnergySummary? _headerSummary;
	EnergySummary? get headerSummary => _headerSummary;

	// ---------------------------------------------------------------------------
	// SUPPORT DETECTION
	// ---------------------------------------------------------------------------

	/// Probes the summary endpoint to determine if energy is supported.
	///
	/// Returns true if the backend returns a valid response (even with zeros).
	/// Returns false on 404, 501, or clear "not available" errors.
	/// Caches the result to avoid repeated probing.
	Future<bool> checkSupport(String spaceId) async {
		if (_supportChecked) return _isSupported;

		try {
			final summary = await _service.fetchSummary(spaceId, EnergyRange.today);
			_isSupported = summary != null;
			_headerSummary = summary;
		} on DioException catch (e) {
			final statusCode = e.response?.statusCode;
			if (statusCode == 404 || statusCode == 501) {
				_isSupported = false;
			} else {
				// Network error or other server error — assume unsupported
				_isSupported = false;
			}
		} catch (e) {
			_isSupported = false;
			if (kDebugMode) {
				debugPrint('[ENERGY REPOSITORY] Support check failed: $e');
			}
		}

		_supportChecked = true;
		notifyListeners();
		return _isSupported;
	}

	// ---------------------------------------------------------------------------
	// DATA FETCHING
	// ---------------------------------------------------------------------------

	/// Fetches all energy data for the given space and current range.
	Future<void> fetchData(String spaceId) async {
		_state = EnergyDataState.loading;
		notifyListeners();

		try {
			final results = await Future.wait([
				_service.fetchSummary(spaceId, _selectedRange),
				_service.fetchTimeseries(spaceId, _selectedRange),
				_service.fetchBreakdown(spaceId, _selectedRange, limit: 10),
			]);

			_summary = results[0] as EnergySummary?;
			_timeseries = results[1] as EnergyTimeseries?;
			_breakdown = results[2] as EnergyBreakdown?;
			_state = EnergyDataState.loaded;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[ENERGY REPOSITORY] Error fetching data: $e');
			}
			_state = EnergyDataState.error;
		}

		notifyListeners();
	}

	/// Changes the selected range and re-fetches data.
	Future<void> setRange(String spaceId, EnergyRange range) async {
		if (range == _selectedRange) return;

		_selectedRange = range;
		_summary = null;
		_timeseries = null;
		_breakdown = null;

		await fetchData(spaceId);
	}
}
