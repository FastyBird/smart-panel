// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_page_tile_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreatePageTileDataUnion
    _$DashboardReqCreatePageTileDataUnionFromJson(Map<String, dynamic> json) {
  switch (json['type']) {
    case 'device':
      return DashboardReqCreatePageTileDataUnionDevice.fromJson(json);
    case 'clock':
      return DashboardReqCreatePageTileDataUnionClock.fromJson(json);
    case 'weather-day':
      return DashboardReqCreatePageTileDataUnionWeatherDay.fromJson(json);
    case 'weather-forecast':
      return DashboardReqCreatePageTileDataUnionWeatherForecast.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardReqCreatePageTileDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardReqCreatePageTileDataUnion {
  /// Unique identifier for the dashboard tile (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// The row position of the tile in the grid.
  int get row => throw _privateConstructorUsedError;

  /// The column position of the tile in the grid.
  int get col => throw _privateConstructorUsedError;

  /// The number of rows the tile spans in the grid.
  @JsonKey(name: 'row_span')
  int get rowSpan => throw _privateConstructorUsedError;

  /// The number of columns the tile spans in the grid.
  @JsonKey(name: 'col_span')
  int get colSpan => throw _privateConstructorUsedError;

  /// A list of data sources used by the tile, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// Specifies the type of tile as a device-specific tile.
  String get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageTileDataUnionDevice value)
        device,
    required TResult Function(DashboardReqCreatePageTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreatePageTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreatePageTileDataUnionWeatherForecast value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageTileDataUnionDevice value)? device,
    TResult? Function(DashboardReqCreatePageTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreatePageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreatePageTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageTileDataUnionDevice value)? device,
    TResult Function(DashboardReqCreatePageTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreatePageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreatePageTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreatePageTileDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreatePageTileDataUnionCopyWith<
          DashboardReqCreatePageTileDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreatePageTileDataUnionCopyWith<$Res> {
  factory $DashboardReqCreatePageTileDataUnionCopyWith(
          DashboardReqCreatePageTileDataUnion value,
          $Res Function(DashboardReqCreatePageTileDataUnion) then) =
      _$DashboardReqCreatePageTileDataUnionCopyWithImpl<$Res,
          DashboardReqCreatePageTileDataUnion>;
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String type});
}

/// @nodoc
class _$DashboardReqCreatePageTileDataUnionCopyWithImpl<$Res,
        $Val extends DashboardReqCreatePageTileDataUnion>
    implements $DashboardReqCreatePageTileDataUnionCopyWith<$Res> {
  _$DashboardReqCreatePageTileDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardReqCreatePageTileDataUnionDeviceImplCopyWith<$Res>
    implements $DashboardReqCreatePageTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreatePageTileDataUnionDeviceImplCopyWith(
          _$DashboardReqCreatePageTileDataUnionDeviceImpl value,
          $Res Function(_$DashboardReqCreatePageTileDataUnionDeviceImpl) then) =
      __$$DashboardReqCreatePageTileDataUnionDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String device,
      String? icon,
      String type});
}

/// @nodoc
class __$$DashboardReqCreatePageTileDataUnionDeviceImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreatePageTileDataUnionDeviceImpl>
    implements _$$DashboardReqCreatePageTileDataUnionDeviceImplCopyWith<$Res> {
  __$$DashboardReqCreatePageTileDataUnionDeviceImplCopyWithImpl(
      _$DashboardReqCreatePageTileDataUnionDeviceImpl _value,
      $Res Function(_$DashboardReqCreatePageTileDataUnionDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
    Object? device = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_$DashboardReqCreatePageTileDataUnionDeviceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
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
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreatePageTileDataUnionDeviceImpl
    implements DashboardReqCreatePageTileDataUnionDevice {
  const _$DashboardReqCreatePageTileDataUnionDeviceImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      required this.device,
      this.icon,
      this.type = 'device'})
      : _dataSource = dataSource;

  factory _$DashboardReqCreatePageTileDataUnionDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageTileDataUnionDeviceImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

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

  /// Specifies the type of tile as a device-specific tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardReqCreatePageTileDataUnion.device(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, device: $device, icon: $icon, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageTileDataUnionDeviceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, row, col, rowSpan, colSpan,
      const DeepCollectionEquality().hash(_dataSource), device, icon, type);

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageTileDataUnionDeviceImplCopyWith<
          _$DashboardReqCreatePageTileDataUnionDeviceImpl>
      get copyWith =>
          __$$DashboardReqCreatePageTileDataUnionDeviceImplCopyWithImpl<
                  _$DashboardReqCreatePageTileDataUnionDeviceImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherForecast,
  }) {
    return device(
        id, row, col, rowSpan, colSpan, dataSource, this.device, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
  }) {
    return device?.call(
        id, row, col, rowSpan, colSpan, dataSource, this.device, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(
          id, row, col, rowSpan, colSpan, dataSource, this.device, icon, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageTileDataUnionDevice value)
        device,
    required TResult Function(DashboardReqCreatePageTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreatePageTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreatePageTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return device(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageTileDataUnionDevice value)? device,
    TResult? Function(DashboardReqCreatePageTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreatePageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreatePageTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return device?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageTileDataUnionDevice value)? device,
    TResult Function(DashboardReqCreatePageTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreatePageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreatePageTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreatePageTileDataUnionDeviceImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreatePageTileDataUnionDevice
    implements DashboardReqCreatePageTileDataUnion {
  const factory DashboardReqCreatePageTileDataUnionDevice(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      required final String device,
      final String? icon,
      final String type}) = _$DashboardReqCreatePageTileDataUnionDeviceImpl;

  factory DashboardReqCreatePageTileDataUnionDevice.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageTileDataUnionDeviceImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// The unique identifier of the associated device.
  String get device;

  /// The icon representing the tile.
  String? get icon;

  /// Specifies the type of tile as a device-specific tile.
  @override
  String get type;

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageTileDataUnionDeviceImplCopyWith<
          _$DashboardReqCreatePageTileDataUnionDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreatePageTileDataUnionClockImplCopyWith<$Res>
    implements $DashboardReqCreatePageTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreatePageTileDataUnionClockImplCopyWith(
          _$DashboardReqCreatePageTileDataUnionClockImpl value,
          $Res Function(_$DashboardReqCreatePageTileDataUnionClockImpl) then) =
      __$$DashboardReqCreatePageTileDataUnionClockImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String type});
}

/// @nodoc
class __$$DashboardReqCreatePageTileDataUnionClockImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreatePageTileDataUnionClockImpl>
    implements _$$DashboardReqCreatePageTileDataUnionClockImplCopyWith<$Res> {
  __$$DashboardReqCreatePageTileDataUnionClockImplCopyWithImpl(
      _$DashboardReqCreatePageTileDataUnionClockImpl _value,
      $Res Function(_$DashboardReqCreatePageTileDataUnionClockImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
    Object? type = null,
  }) {
    return _then(_$DashboardReqCreatePageTileDataUnionClockImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreatePageTileDataUnionClockImpl
    implements DashboardReqCreatePageTileDataUnionClock {
  const _$DashboardReqCreatePageTileDataUnionClockImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'clock'})
      : _dataSource = dataSource;

  factory _$DashboardReqCreatePageTileDataUnionClockImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageTileDataUnionClockImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

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

  /// Specifies the type of tile as a clock.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardReqCreatePageTileDataUnion.clock(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageTileDataUnionClockImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, row, col, rowSpan, colSpan,
      const DeepCollectionEquality().hash(_dataSource), type);

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageTileDataUnionClockImplCopyWith<
          _$DashboardReqCreatePageTileDataUnionClockImpl>
      get copyWith =>
          __$$DashboardReqCreatePageTileDataUnionClockImplCopyWithImpl<
              _$DashboardReqCreatePageTileDataUnionClockImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherForecast,
  }) {
    return clock(id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
  }) {
    return clock?.call(id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(id, row, col, rowSpan, colSpan, dataSource, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageTileDataUnionDevice value)
        device,
    required TResult Function(DashboardReqCreatePageTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreatePageTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreatePageTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageTileDataUnionDevice value)? device,
    TResult? Function(DashboardReqCreatePageTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreatePageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreatePageTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageTileDataUnionDevice value)? device,
    TResult Function(DashboardReqCreatePageTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreatePageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreatePageTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreatePageTileDataUnionClockImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreatePageTileDataUnionClock
    implements DashboardReqCreatePageTileDataUnion {
  const factory DashboardReqCreatePageTileDataUnionClock(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String type}) = _$DashboardReqCreatePageTileDataUnionClockImpl;

  factory DashboardReqCreatePageTileDataUnionClock.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageTileDataUnionClockImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// Specifies the type of tile as a clock.
  @override
  String get type;

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageTileDataUnionClockImplCopyWith<
          _$DashboardReqCreatePageTileDataUnionClockImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreatePageTileDataUnionWeatherDayImplCopyWith<
    $Res> implements $DashboardReqCreatePageTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreatePageTileDataUnionWeatherDayImplCopyWith(
          _$DashboardReqCreatePageTileDataUnionWeatherDayImpl value,
          $Res Function(_$DashboardReqCreatePageTileDataUnionWeatherDayImpl)
              then) =
      __$$DashboardReqCreatePageTileDataUnionWeatherDayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String type});
}

/// @nodoc
class __$$DashboardReqCreatePageTileDataUnionWeatherDayImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreatePageTileDataUnionWeatherDayImpl>
    implements
        _$$DashboardReqCreatePageTileDataUnionWeatherDayImplCopyWith<$Res> {
  __$$DashboardReqCreatePageTileDataUnionWeatherDayImplCopyWithImpl(
      _$DashboardReqCreatePageTileDataUnionWeatherDayImpl _value,
      $Res Function(_$DashboardReqCreatePageTileDataUnionWeatherDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
    Object? type = null,
  }) {
    return _then(_$DashboardReqCreatePageTileDataUnionWeatherDayImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreatePageTileDataUnionWeatherDayImpl
    implements DashboardReqCreatePageTileDataUnionWeatherDay {
  const _$DashboardReqCreatePageTileDataUnionWeatherDayImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'weather-day'})
      : _dataSource = dataSource;

  factory _$DashboardReqCreatePageTileDataUnionWeatherDayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageTileDataUnionWeatherDayImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

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

  /// Specifies the type of tile as a day weather tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardReqCreatePageTileDataUnion.weatherDay(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageTileDataUnionWeatherDayImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, row, col, rowSpan, colSpan,
      const DeepCollectionEquality().hash(_dataSource), type);

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageTileDataUnionWeatherDayImplCopyWith<
          _$DashboardReqCreatePageTileDataUnionWeatherDayImpl>
      get copyWith =>
          __$$DashboardReqCreatePageTileDataUnionWeatherDayImplCopyWithImpl<
                  _$DashboardReqCreatePageTileDataUnionWeatherDayImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherForecast,
  }) {
    return weatherDay(id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
  }) {
    return weatherDay?.call(id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(id, row, col, rowSpan, colSpan, dataSource, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageTileDataUnionDevice value)
        device,
    required TResult Function(DashboardReqCreatePageTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreatePageTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreatePageTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageTileDataUnionDevice value)? device,
    TResult? Function(DashboardReqCreatePageTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreatePageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreatePageTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageTileDataUnionDevice value)? device,
    TResult Function(DashboardReqCreatePageTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreatePageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreatePageTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreatePageTileDataUnionWeatherDayImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreatePageTileDataUnionWeatherDay
    implements DashboardReqCreatePageTileDataUnion {
  const factory DashboardReqCreatePageTileDataUnionWeatherDay(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String type}) = _$DashboardReqCreatePageTileDataUnionWeatherDayImpl;

  factory DashboardReqCreatePageTileDataUnionWeatherDay.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageTileDataUnionWeatherDayImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// Specifies the type of tile as a day weather tile.
  @override
  String get type;

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageTileDataUnionWeatherDayImplCopyWith<
          _$DashboardReqCreatePageTileDataUnionWeatherDayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplCopyWith<
    $Res> implements $DashboardReqCreatePageTileDataUnionCopyWith<$Res> {
  factory _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplCopyWith(
          _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl value,
          $Res Function(
                  _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl)
              then) =
      __$$DashboardReqCreatePageTileDataUnionWeatherForecastImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      @JsonKey(name: 'data_source')
      List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      String type});
}

/// @nodoc
class __$$DashboardReqCreatePageTileDataUnionWeatherForecastImplCopyWithImpl<
        $Res>
    extends _$DashboardReqCreatePageTileDataUnionCopyWithImpl<$Res,
        _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl>
    implements
        _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplCopyWith<
            $Res> {
  __$$DashboardReqCreatePageTileDataUnionWeatherForecastImplCopyWithImpl(
      _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl _value,
      $Res Function(_$DashboardReqCreatePageTileDataUnionWeatherForecastImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? dataSource = null,
    Object? type = null,
  }) {
    return _then(_$DashboardReqCreatePageTileDataUnionWeatherForecastImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      row: null == row
          ? _value.row
          : row // ignore: cast_nullable_to_non_nullable
              as int,
      col: null == col
          ? _value.col
          : col // ignore: cast_nullable_to_non_nullable
              as int,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardCreateTileBaseDataSourceUnion>,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl
    implements DashboardReqCreatePageTileDataUnionWeatherForecast {
  const _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'row_span') required this.rowSpan,
      @JsonKey(name: 'col_span') required this.colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      this.type = 'weather-forecast'})
      : _dataSource = dataSource;

  factory _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplFromJson(json);

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

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

  /// Specifies the type of tile as a weather forecast tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardReqCreatePageTileDataUnion.weatherForecast(id: $id, row: $row, col: $col, rowSpan: $rowSpan, colSpan: $colSpan, dataSource: $dataSource, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, row, col, rowSpan, colSpan,
      const DeepCollectionEquality().hash(_dataSource), type);

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl>
      get copyWith =>
          __$$DashboardReqCreatePageTileDataUnionWeatherForecastImplCopyWithImpl<
                  _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)
        weatherForecast,
  }) {
    return weatherForecast(id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
  }) {
    return weatherForecast?.call(
        id, row, col, rowSpan, colSpan, dataSource, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String device,
            String? icon,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            @JsonKey(name: 'data_source')
            List<DashboardCreateTileBaseDataSourceUnion> dataSource,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(id, row, col, rowSpan, colSpan, dataSource, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqCreatePageTileDataUnionDevice value)
        device,
    required TResult Function(DashboardReqCreatePageTileDataUnionClock value)
        clock,
    required TResult Function(
            DashboardReqCreatePageTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardReqCreatePageTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqCreatePageTileDataUnionDevice value)? device,
    TResult? Function(DashboardReqCreatePageTileDataUnionClock value)? clock,
    TResult? Function(DashboardReqCreatePageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardReqCreatePageTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqCreatePageTileDataUnionDevice value)? device,
    TResult Function(DashboardReqCreatePageTileDataUnionClock value)? clock,
    TResult Function(DashboardReqCreatePageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult Function(DashboardReqCreatePageTileDataUnionWeatherForecast value)?
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
    return _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplToJson(
      this,
    );
  }
}

abstract class DashboardReqCreatePageTileDataUnionWeatherForecast
    implements DashboardReqCreatePageTileDataUnion {
  const factory DashboardReqCreatePageTileDataUnionWeatherForecast(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'row_span') required final int rowSpan,
      @JsonKey(name: 'col_span') required final int colSpan,
      @JsonKey(name: 'data_source')
      required final List<DashboardCreateTileBaseDataSourceUnion> dataSource,
      final String
          type}) = _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl;

  factory DashboardReqCreatePageTileDataUnionWeatherForecast.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl.fromJson;

  /// Unique identifier for the dashboard tile (optional during creation).
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// The number of rows the tile spans in the grid.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans in the grid.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardCreateTileBaseDataSourceUnion> get dataSource;

  /// Specifies the type of tile as a weather forecast tile.
  @override
  String get type;

  /// Create a copy of DashboardReqCreatePageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardReqCreatePageTileDataUnionWeatherForecastImpl>
      get copyWith => throw _privateConstructorUsedError;
}
