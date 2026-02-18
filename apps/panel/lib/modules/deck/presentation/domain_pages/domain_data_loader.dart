import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// States for domain data loading.
///
/// Represents the lifecycle of data loading in domain views:
/// - [loading]: Initial fetch is in progress
/// - [loaded]: Data was successfully loaded
/// - [error]: Fetch failed, requires retry
/// - [empty]: Loaded successfully but no data exists
/// - [notConfigured]: Domain exists but is not configured (no roles/bindings)
enum DomainLoadState {
  loading,
  loaded,
  error,
  empty,
  notConfigured,
}

/// Mixin for unified domain data loading behavior.
///
/// Provides consistent loading, error handling, and retry patterns
/// across all domain views (lights, climate, shading, media, sensors).
///
/// Usage:
/// ```dart
/// class _MyDomainViewPageState extends State<MyDomainViewPage>
///     with DomainDataLoader<MyDomainViewPage> {
///
///   @override
///   void initState() {
///     super.initState();
///     loadDomainData();
///   }
///
///   @override
///   bool hasExistingData() => _myService?.getCachedData() != null;
///
///   @override
///   Future<void> fetchData() async {
///     await _myService?.fetchData();
///   }
///
///   @override
///   bool isDataEmpty() => _myService?.getCachedData()?.isEmpty ?? true;
/// }
/// ```
mixin DomainDataLoader<T extends StatefulWidget> on State<T> {
  DomainLoadState _loadState = DomainLoadState.loading;
  String? _errorMessage;

  /// Current load state.
  DomainLoadState get loadState => _loadState;

  /// Error message when [loadState] is [DomainLoadState.error].
  String? get errorMessage => _errorMessage;

  /// True when initial fetch is in progress.
  bool get isLoading => _loadState == DomainLoadState.loading;

  /// True when fetch failed.
  bool get hasError => _loadState == DomainLoadState.error;

  /// True when data was successfully loaded.
  bool get isLoaded => _loadState == DomainLoadState.loaded;

  /// True when loaded but no data exists.
  bool get isEmpty => _loadState == DomainLoadState.empty;

  /// Subclasses implement to check if cached data already exists.
  ///
  /// Return true if data is available locally (no fetch needed).
  bool hasExistingData();

  /// Subclasses implement to fetch data from the backend.
  ///
  /// This is called when [hasExistingData] returns false.
  /// Should throw on error.
  Future<void> fetchData();

  /// Subclasses implement to check if loaded data is empty.
  ///
  /// Called after successful fetch to determine if [DomainLoadState.empty]
  /// should be used instead of [DomainLoadState.loaded].
  bool isDataEmpty();

  /// Unified data loading flow.
  ///
  /// Call this from initState:
  /// 1. If cached data exists, immediately transition to loaded/empty state
  /// 2. Otherwise, fetch data and update state accordingly
  Future<void> loadDomainData() async {
    // If data already cached, skip fetch
    if (hasExistingData()) {
      if (mounted) {
        setState(() {
          _loadState =
              isDataEmpty() ? DomainLoadState.empty : DomainLoadState.loaded;
        });
      }
      return;
    }

    // Fetch data
    try {
      await fetchData();
      if (mounted) {
        setState(() {
          _loadState =
              isDataEmpty() ? DomainLoadState.empty : DomainLoadState.loaded;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DomainDataLoader] Failed to fetch data: $e');
      }
      if (mounted) {
        setState(() {
          _loadState = DomainLoadState.error;
          _errorMessage = e.toString();
        });
      }
    }
  }

  /// Retry loading after an error.
  ///
  /// Resets state to loading and calls [loadDomainData] again.
  Future<void> retryLoad() async {
    if (mounted) {
      setState(() {
        _loadState = DomainLoadState.loading;
        _errorMessage = null;
      });
    }
    await loadDomainData();
  }

  /// Sets the load state directly.
  ///
  /// Useful for manual state management when the mixin's automatic
  /// flow doesn't fit the specific use case.
  void setLoadState(DomainLoadState state, {String? errorMessage}) {
    if (mounted) {
      setState(() {
        _loadState = state;
        _errorMessage = errorMessage;
      });
    }
  }
}
