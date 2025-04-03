// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_tiles_page_tiles_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateTilesPageTilesUnion _$DashboardCreateTilesPageTilesUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'device-preview':
      return DashboardCreateTilesPageTilesUnionDevicePreview.fromJson(json);
    case 'clock':
      return DashboardCreateTilesPageTilesUnionClock.fromJson(json);
    case 'weather-day':
      return DashboardCreateTilesPageTilesUnionWeatherDay.fromJson(json);
    case 'weather-forecast':
      return DashboardCreateTilesPageTilesUnionWeatherForecast.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardCreateTilesPageTilesUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardCreateTilesPageTilesUnion {
  /// Unique identifier for the dashboard tile (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the tile type
  String get type => throw _privateConstructorUsedError;

  /// The row position of the tile in the grid.
  int get row => throw _privateConstructorUsedError;

  /// The column position of the tile in the grid.
  int get col => throw _privateConstructorUsedError;

  /// A list of data sources used by the tile, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// The number of rows the tile spans in the grid.
  @JsonKey(name: 'row_span')
  int get rowSpan => throw _privateConstructorUsedError;

  /// The number of columns the tile spans in the grid.
  @JsonKey(name: 'col_span')
  int get colSpan => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardCreateTilesPageTilesUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardCreateTilesPageTilesUnionClock value)
        clock,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherForecast value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateTilesPageTilesUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateTilesPageTilesUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateTilesPageTilesUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateTilesPageTilesUnionCopyWith<
          DashboardCreateTilesPageTilesUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  factory $DashboardCreateTilesPageTilesUnionCopyWith(
          DashboardCreateTilesPageTilesUnion value,
          $Res Function(DashboardCreateTilesPageTilesUnion) then) =
      _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
          DashboardCreateTilesPageTilesUnion>;
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
        $Val extends DashboardCreateTilesPageTilesUnion>
    implements $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  _$DashboardCreateTilesPageTilesUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateTilesPageTilesUnionDevicePreviewImplCopyWith<
    $Res> implements $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateTilesPageTilesUnionDevicePreviewImplCopyWith(
          _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl value,
          $Res Function(_$DashboardCreateTilesPageTilesUnionDevicePreviewImpl)
              then) =
      __$$DashboardCreateTilesPageTilesUnionDevicePreviewImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String device,
      String? icon,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardCreateTilesPageTilesUnionDevicePreviewImplCopyWithImpl<$Res>
    extends _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl>
    implements
        _$$DashboardCreateTilesPageTilesUnionDevicePreviewImplCopyWith<$Res> {
  __$$DashboardCreateTilesPageTilesUnionDevicePreviewImplCopyWithImpl(
      _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl _value,
      $Res Function(_$DashboardCreateTilesPageTilesUnionDevicePreviewImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? device = null,
    Object? icon = freezed,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardCreateTilesPageTilesUnionDevicePreviewImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl
    implements DashboardCreateTilesPageTilesUnionDevicePreview {
  const _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      required this.device,
      this.icon,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateTilesPageTilesUnionDevicePreviewImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The icon representing the tile.
  @override
  final String? icon;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  @override
  String toString() {
    return 'DashboardCreateTilesPageTilesUnion.devicePreview(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, device: $device, icon: $icon, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      device,
      icon,
      rowSpan,
      colSpan);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTilesPageTilesUnionDevicePreviewImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl>
      get copyWith =>
          __$$DashboardCreateTilesPageTilesUnionDevicePreviewImplCopyWithImpl<
                  _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return devicePreview(
        id, type, row, col, dataSource, device, icon, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return devicePreview?.call(
        id, type, row, col, dataSource, device, icon, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (devicePreview != null) {
      return devicePreview(
          id, type, row, col, dataSource, device, icon, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardCreateTilesPageTilesUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardCreateTilesPageTilesUnionClock value)
        clock,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return devicePreview(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateTilesPageTilesUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return devicePreview?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateTilesPageTilesUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (devicePreview != null) {
      return devicePreview(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTilesPageTilesUnionDevicePreviewImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateTilesPageTilesUnionDevicePreview
    implements DashboardCreateTilesPageTilesUnion {
  const factory DashboardCreateTilesPageTilesUnionDevicePreview(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      required final String device,
      final String? icon,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int
          colSpan}) = _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl;

  factory DashboardCreateTilesPageTilesUnionDevicePreview.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// The unique identifier of the associated device.
  String get device;

  /// The icon representing the tile.
  String? get icon;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTilesPageTilesUnionDevicePreviewImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionDevicePreviewImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateTilesPageTilesUnionClockImplCopyWith<$Res>
    implements $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateTilesPageTilesUnionClockImplCopyWith(
          _$DashboardCreateTilesPageTilesUnionClockImpl value,
          $Res Function(_$DashboardCreateTilesPageTilesUnionClockImpl) then) =
      __$$DashboardCreateTilesPageTilesUnionClockImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardCreateTilesPageTilesUnionClockImplCopyWithImpl<$Res>
    extends _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateTilesPageTilesUnionClockImpl>
    implements _$$DashboardCreateTilesPageTilesUnionClockImplCopyWith<$Res> {
  __$$DashboardCreateTilesPageTilesUnionClockImplCopyWithImpl(
      _$DashboardCreateTilesPageTilesUnionClockImpl _value,
      $Res Function(_$DashboardCreateTilesPageTilesUnionClockImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardCreateTilesPageTilesUnionClockImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateTilesPageTilesUnionClockImpl
    implements DashboardCreateTilesPageTilesUnionClock {
  const _$DashboardCreateTilesPageTilesUnionClockImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardCreateTilesPageTilesUnionClockImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateTilesPageTilesUnionClockImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  @override
  String toString() {
    return 'DashboardCreateTilesPageTilesUnion.clock(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTilesPageTilesUnionClockImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, row, col,
      const DeepCollectionEquality().hash(_dataSource), rowSpan, colSpan);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTilesPageTilesUnionClockImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionClockImpl>
      get copyWith =>
          __$$DashboardCreateTilesPageTilesUnionClockImplCopyWithImpl<
              _$DashboardCreateTilesPageTilesUnionClockImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return clock(id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return clock?.call(id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(id, type, row, col, dataSource, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardCreateTilesPageTilesUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardCreateTilesPageTilesUnionClock value)
        clock,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateTilesPageTilesUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateTilesPageTilesUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTilesPageTilesUnionClockImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateTilesPageTilesUnionClock
    implements DashboardCreateTilesPageTilesUnion {
  const factory DashboardCreateTilesPageTilesUnionClock(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int colSpan}) = _$DashboardCreateTilesPageTilesUnionClockImpl;

  factory DashboardCreateTilesPageTilesUnionClock.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateTilesPageTilesUnionClockImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTilesPageTilesUnionClockImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionClockImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWith<$Res>
    implements $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWith(
          _$DashboardCreateTilesPageTilesUnionWeatherDayImpl value,
          $Res Function(_$DashboardCreateTilesPageTilesUnionWeatherDayImpl)
              then) =
      __$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWithImpl<$Res>
    extends _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateTilesPageTilesUnionWeatherDayImpl>
    implements
        _$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWith<$Res> {
  __$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWithImpl(
      _$DashboardCreateTilesPageTilesUnionWeatherDayImpl _value,
      $Res Function(_$DashboardCreateTilesPageTilesUnionWeatherDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardCreateTilesPageTilesUnionWeatherDayImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateTilesPageTilesUnionWeatherDayImpl
    implements DashboardCreateTilesPageTilesUnionWeatherDay {
  const _$DashboardCreateTilesPageTilesUnionWeatherDayImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardCreateTilesPageTilesUnionWeatherDayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateTilesPageTilesUnionWeatherDayImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  @override
  String toString() {
    return 'DashboardCreateTilesPageTilesUnion.weatherDay(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTilesPageTilesUnionWeatherDayImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, row, col,
      const DeepCollectionEquality().hash(_dataSource), rowSpan, colSpan);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionWeatherDayImpl>
      get copyWith =>
          __$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWithImpl<
                  _$DashboardCreateTilesPageTilesUnionWeatherDayImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return weatherDay(id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return weatherDay?.call(id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(id, type, row, col, dataSource, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardCreateTilesPageTilesUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardCreateTilesPageTilesUnionClock value)
        clock,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateTilesPageTilesUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateTilesPageTilesUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTilesPageTilesUnionWeatherDayImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateTilesPageTilesUnionWeatherDay
    implements DashboardCreateTilesPageTilesUnion {
  const factory DashboardCreateTilesPageTilesUnionWeatherDay(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int colSpan}) = _$DashboardCreateTilesPageTilesUnionWeatherDayImpl;

  factory DashboardCreateTilesPageTilesUnionWeatherDay.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateTilesPageTilesUnionWeatherDayImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTilesPageTilesUnionWeatherDayImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionWeatherDayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWith<
    $Res> implements $DashboardCreateTilesPageTilesUnionCopyWith<$Res> {
  factory _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWith(
          _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl value,
          $Res Function(_$DashboardCreateTilesPageTilesUnionWeatherForecastImpl)
              then) =
      __$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan});
}

/// @nodoc
class __$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWithImpl<
        $Res>
    extends _$DashboardCreateTilesPageTilesUnionCopyWithImpl<$Res,
        _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl>
    implements
        _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWith<$Res> {
  __$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWithImpl(
      _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl _value,
      $Res Function(_$DashboardCreateTilesPageTilesUnionWeatherForecastImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? rowSpan = null,
    Object? colSpan = null,
  }) {
    return _then(_$DashboardCreateTilesPageTilesUnionWeatherForecastImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl
    implements DashboardCreateTilesPageTilesUnionWeatherForecast {
  const _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl(
      {required this.id,
      required this.type,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0})
      : _dataSource = dataSource;

  factory _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// Discriminator for the tile type
  @override
  final String type;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardCreateTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  @override
  String toString() {
    return 'DashboardCreateTilesPageTilesUnion.weatherForecast(id: $id, type: $type, row: $row, col: $col, dataSource: $dataSource, rowSpan: $rowSpan, colSpan: $colSpan)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, row, col,
      const DeepCollectionEquality().hash(_dataSource), rowSpan, colSpan);

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl>
      get copyWith =>
          __$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWithImpl<
                  _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        devicePreview,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        clock,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherDay,
    required TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)
        weatherForecast,
  }) {
    return weatherForecast(id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult? Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
  }) {
    return weatherForecast?.call(
        id, type, row, col, dataSource, rowSpan, colSpan);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        devicePreview,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        clock,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherDay,
    TResult Function(
            String id,
            String type,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(id, type, row, col, dataSource, rowSpan, colSpan);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardCreateTilesPageTilesUnionDevicePreview value)
        devicePreview,
    required TResult Function(DashboardCreateTilesPageTilesUnionClock value)
        clock,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardCreateTilesPageTilesUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateTilesPageTilesUnionDevicePreview value)?
        devicePreview,
    TResult? Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateTilesPageTilesUnionDevicePreview value)?
        devicePreview,
    TResult Function(DashboardCreateTilesPageTilesUnionClock value)? clock,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardCreateTilesPageTilesUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateTilesPageTilesUnionWeatherForecast
    implements DashboardCreateTilesPageTilesUnion {
  const factory DashboardCreateTilesPageTilesUnionWeatherForecast(
      {required final String id,
      required final String type,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span')
      final int
          colSpan}) = _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl;

  factory DashboardCreateTilesPageTilesUnionWeatherForecast.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// Discriminator for the tile type
  @override
  String get type;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Create a copy of DashboardCreateTilesPageTilesUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateTilesPageTilesUnionWeatherForecastImplCopyWith<
          _$DashboardCreateTilesPageTilesUnionWeatherForecastImpl>
      get copyWith => throw _privateConstructorUsedError;
}
