// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_res_page_tile_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardResPageTileDataUnion _$DashboardResPageTileDataUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'device':
      return DashboardResPageTileDataUnionDevice.fromJson(json);
    case 'clock':
      return DashboardResPageTileDataUnionClock.fromJson(json);
    case 'weather-day':
      return DashboardResPageTileDataUnionWeatherDay.fromJson(json);
    case 'weather-forecast':
      return DashboardResPageTileDataUnionWeatherForecast.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardResPageTileDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardResPageTileDataUnion {
  /// A unique identifier for the dashboard tile.
  String get id => throw _privateConstructorUsedError;

  /// The row position of the tile in the grid.
  int get row => throw _privateConstructorUsedError;

  /// The column position of the tile in the grid.
  int get col => throw _privateConstructorUsedError;

  /// A list of data sources used by the tile, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource =>
      throw _privateConstructorUsedError;

  /// The timestamp when the dashboard tile was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard tile was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// The unique identifier of the associated page.
  String get page => throw _privateConstructorUsedError;

  /// The number of rows the tile spans.
  @JsonKey(name: 'row_span')
  int get rowSpan => throw _privateConstructorUsedError;

  /// The number of columns the tile spans.
  @JsonKey(name: 'col_span')
  int get colSpan => throw _privateConstructorUsedError;

  /// Indicates that this is a device-specific tile.
  String get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
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
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
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
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardResPageTileDataUnionDevice value) device,
    required TResult Function(DashboardResPageTileDataUnionClock value) clock,
    required TResult Function(DashboardResPageTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardResPageTileDataUnionWeatherForecast value)
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageTileDataUnionDevice value)? device,
    TResult? Function(DashboardResPageTileDataUnionClock value)? clock,
    TResult? Function(DashboardResPageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardResPageTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageTileDataUnionDevice value)? device,
    TResult Function(DashboardResPageTileDataUnionClock value)? clock,
    TResult Function(DashboardResPageTileDataUnionWeatherDay value)? weatherDay,
    TResult Function(DashboardResPageTileDataUnionWeatherForecast value)?
        weatherForecast,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardResPageTileDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardResPageTileDataUnionCopyWith<DashboardResPageTileDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardResPageTileDataUnionCopyWith<$Res> {
  factory $DashboardResPageTileDataUnionCopyWith(
          DashboardResPageTileDataUnion value,
          $Res Function(DashboardResPageTileDataUnion) then) =
      _$DashboardResPageTileDataUnionCopyWithImpl<$Res,
          DashboardResPageTileDataUnion>;
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String page,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String type});
}

/// @nodoc
class _$DashboardResPageTileDataUnionCopyWithImpl<$Res,
        $Val extends DashboardResPageTileDataUnion>
    implements $DashboardResPageTileDataUnionCopyWith<$Res> {
  _$DashboardResPageTileDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? page = null,
    Object? rowSpan = null,
    Object? colSpan = null,
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
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardResPageTileDataUnionDeviceImplCopyWith<$Res>
    implements $DashboardResPageTileDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageTileDataUnionDeviceImplCopyWith(
          _$DashboardResPageTileDataUnionDeviceImpl value,
          $Res Function(_$DashboardResPageTileDataUnionDeviceImpl) then) =
      __$$DashboardResPageTileDataUnionDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String? icon,
      String page,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String type});
}

/// @nodoc
class __$$DashboardResPageTileDataUnionDeviceImplCopyWithImpl<$Res>
    extends _$DashboardResPageTileDataUnionCopyWithImpl<$Res,
        _$DashboardResPageTileDataUnionDeviceImpl>
    implements _$$DashboardResPageTileDataUnionDeviceImplCopyWith<$Res> {
  __$$DashboardResPageTileDataUnionDeviceImplCopyWithImpl(
      _$DashboardResPageTileDataUnionDeviceImpl _value,
      $Res Function(_$DashboardResPageTileDataUnionDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? icon = freezed,
    Object? page = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? type = null,
  }) {
    return _then(_$DashboardResPageTileDataUnionDeviceImpl(
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageTileDataUnionDeviceImpl
    implements DashboardResPageTileDataUnionDevice {
  const _$DashboardResPageTileDataUnionDeviceImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      required this.icon,
      required this.page,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0,
      this.type = 'device'})
      : _dataSource = dataSource;

  factory _$DashboardResPageTileDataUnionDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageTileDataUnionDeviceImplFromJson(json);

  /// A unique identifier for the dashboard tile.
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The icon representing the device tile.
  @override
  final String? icon;

  /// The unique identifier of the associated page.
  @override
  final String page;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  /// Indicates that this is a device-specific tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardResPageTileDataUnion.device(id: $id, row: $row, col: $col, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, icon: $icon, page: $page, rowSpan: $rowSpan, colSpan: $colSpan, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageTileDataUnionDeviceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      device,
      icon,
      page,
      rowSpan,
      colSpan,
      type);

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageTileDataUnionDeviceImplCopyWith<
          _$DashboardResPageTileDataUnionDeviceImpl>
      get copyWith => __$$DashboardResPageTileDataUnionDeviceImplCopyWithImpl<
          _$DashboardResPageTileDataUnionDeviceImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherForecast,
  }) {
    return device(id, row, col, dataSource, createdAt, updatedAt, this.device,
        icon, page, rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherForecast,
  }) {
    return device?.call(id, row, col, dataSource, createdAt, updatedAt,
        this.device, icon, page, rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (device != null) {
      return device(id, row, col, dataSource, createdAt, updatedAt, this.device,
          icon, page, rowSpan, colSpan, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardResPageTileDataUnionDevice value) device,
    required TResult Function(DashboardResPageTileDataUnionClock value) clock,
    required TResult Function(DashboardResPageTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardResPageTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return device(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageTileDataUnionDevice value)? device,
    TResult? Function(DashboardResPageTileDataUnionClock value)? clock,
    TResult? Function(DashboardResPageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardResPageTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return device?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageTileDataUnionDevice value)? device,
    TResult Function(DashboardResPageTileDataUnionClock value)? clock,
    TResult Function(DashboardResPageTileDataUnionWeatherDay value)? weatherDay,
    TResult Function(DashboardResPageTileDataUnionWeatherForecast value)?
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
    return _$$DashboardResPageTileDataUnionDeviceImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageTileDataUnionDevice
    implements DashboardResPageTileDataUnion {
  const factory DashboardResPageTileDataUnionDevice(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String device,
      required final String? icon,
      required final String page,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span') final int colSpan,
      final String type}) = _$DashboardResPageTileDataUnionDeviceImpl;

  factory DashboardResPageTileDataUnionDevice.fromJson(
          Map<String, dynamic> json) =
      _$DashboardResPageTileDataUnionDeviceImpl.fromJson;

  /// A unique identifier for the dashboard tile.
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource;

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated device.
  String get device;

  /// The icon representing the device tile.
  String? get icon;

  /// The unique identifier of the associated page.
  @override
  String get page;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Indicates that this is a device-specific tile.
  @override
  String get type;

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageTileDataUnionDeviceImplCopyWith<
          _$DashboardResPageTileDataUnionDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardResPageTileDataUnionClockImplCopyWith<$Res>
    implements $DashboardResPageTileDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageTileDataUnionClockImplCopyWith(
          _$DashboardResPageTileDataUnionClockImpl value,
          $Res Function(_$DashboardResPageTileDataUnionClockImpl) then) =
      __$$DashboardResPageTileDataUnionClockImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String page,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String type});
}

/// @nodoc
class __$$DashboardResPageTileDataUnionClockImplCopyWithImpl<$Res>
    extends _$DashboardResPageTileDataUnionCopyWithImpl<$Res,
        _$DashboardResPageTileDataUnionClockImpl>
    implements _$$DashboardResPageTileDataUnionClockImplCopyWith<$Res> {
  __$$DashboardResPageTileDataUnionClockImplCopyWithImpl(
      _$DashboardResPageTileDataUnionClockImpl _value,
      $Res Function(_$DashboardResPageTileDataUnionClockImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? page = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? type = null,
  }) {
    return _then(_$DashboardResPageTileDataUnionClockImpl(
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageTileDataUnionClockImpl
    implements DashboardResPageTileDataUnionClock {
  const _$DashboardResPageTileDataUnionClockImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.page,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0,
      this.type = 'clock'})
      : _dataSource = dataSource;

  factory _$DashboardResPageTileDataUnionClockImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageTileDataUnionClockImplFromJson(json);

  /// A unique identifier for the dashboard tile.
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated page.
  @override
  final String page;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  /// Indicates that this is a clock tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardResPageTileDataUnion.clock(id: $id, row: $row, col: $col, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, page: $page, rowSpan: $rowSpan, colSpan: $colSpan, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageTileDataUnionClockImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      page,
      rowSpan,
      colSpan,
      type);

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageTileDataUnionClockImplCopyWith<
          _$DashboardResPageTileDataUnionClockImpl>
      get copyWith => __$$DashboardResPageTileDataUnionClockImplCopyWithImpl<
          _$DashboardResPageTileDataUnionClockImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherForecast,
  }) {
    return clock(id, row, col, dataSource, createdAt, updatedAt, page, rowSpan,
        colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherForecast,
  }) {
    return clock?.call(id, row, col, dataSource, createdAt, updatedAt, page,
        rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (clock != null) {
      return clock(id, row, col, dataSource, createdAt, updatedAt, page,
          rowSpan, colSpan, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardResPageTileDataUnionDevice value) device,
    required TResult Function(DashboardResPageTileDataUnionClock value) clock,
    required TResult Function(DashboardResPageTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardResPageTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return clock(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageTileDataUnionDevice value)? device,
    TResult? Function(DashboardResPageTileDataUnionClock value)? clock,
    TResult? Function(DashboardResPageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardResPageTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return clock?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageTileDataUnionDevice value)? device,
    TResult Function(DashboardResPageTileDataUnionClock value)? clock,
    TResult Function(DashboardResPageTileDataUnionWeatherDay value)? weatherDay,
    TResult Function(DashboardResPageTileDataUnionWeatherForecast value)?
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
    return _$$DashboardResPageTileDataUnionClockImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageTileDataUnionClock
    implements DashboardResPageTileDataUnion {
  const factory DashboardResPageTileDataUnionClock(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String page,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span') final int colSpan,
      final String type}) = _$DashboardResPageTileDataUnionClockImpl;

  factory DashboardResPageTileDataUnionClock.fromJson(
          Map<String, dynamic> json) =
      _$DashboardResPageTileDataUnionClockImpl.fromJson;

  /// A unique identifier for the dashboard tile.
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource;

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated page.
  @override
  String get page;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Indicates that this is a clock tile.
  @override
  String get type;

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageTileDataUnionClockImplCopyWith<
          _$DashboardResPageTileDataUnionClockImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardResPageTileDataUnionWeatherDayImplCopyWith<$Res>
    implements $DashboardResPageTileDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageTileDataUnionWeatherDayImplCopyWith(
          _$DashboardResPageTileDataUnionWeatherDayImpl value,
          $Res Function(_$DashboardResPageTileDataUnionWeatherDayImpl) then) =
      __$$DashboardResPageTileDataUnionWeatherDayImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String page,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String type});
}

/// @nodoc
class __$$DashboardResPageTileDataUnionWeatherDayImplCopyWithImpl<$Res>
    extends _$DashboardResPageTileDataUnionCopyWithImpl<$Res,
        _$DashboardResPageTileDataUnionWeatherDayImpl>
    implements _$$DashboardResPageTileDataUnionWeatherDayImplCopyWith<$Res> {
  __$$DashboardResPageTileDataUnionWeatherDayImplCopyWithImpl(
      _$DashboardResPageTileDataUnionWeatherDayImpl _value,
      $Res Function(_$DashboardResPageTileDataUnionWeatherDayImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? page = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? type = null,
  }) {
    return _then(_$DashboardResPageTileDataUnionWeatherDayImpl(
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageTileDataUnionWeatherDayImpl
    implements DashboardResPageTileDataUnionWeatherDay {
  const _$DashboardResPageTileDataUnionWeatherDayImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.page,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0,
      this.type = 'weather-day'})
      : _dataSource = dataSource;

  factory _$DashboardResPageTileDataUnionWeatherDayImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageTileDataUnionWeatherDayImplFromJson(json);

  /// A unique identifier for the dashboard tile.
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated page.
  @override
  final String page;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  /// Indicates that this is a day weather tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardResPageTileDataUnion.weatherDay(id: $id, row: $row, col: $col, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, page: $page, rowSpan: $rowSpan, colSpan: $colSpan, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageTileDataUnionWeatherDayImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      page,
      rowSpan,
      colSpan,
      type);

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageTileDataUnionWeatherDayImplCopyWith<
          _$DashboardResPageTileDataUnionWeatherDayImpl>
      get copyWith =>
          __$$DashboardResPageTileDataUnionWeatherDayImplCopyWithImpl<
              _$DashboardResPageTileDataUnionWeatherDayImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherForecast,
  }) {
    return weatherDay(id, row, col, dataSource, createdAt, updatedAt, page,
        rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherForecast,
  }) {
    return weatherDay?.call(id, row, col, dataSource, createdAt, updatedAt,
        page, rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherDay != null) {
      return weatherDay(id, row, col, dataSource, createdAt, updatedAt, page,
          rowSpan, colSpan, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardResPageTileDataUnionDevice value) device,
    required TResult Function(DashboardResPageTileDataUnionClock value) clock,
    required TResult Function(DashboardResPageTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardResPageTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherDay(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageTileDataUnionDevice value)? device,
    TResult? Function(DashboardResPageTileDataUnionClock value)? clock,
    TResult? Function(DashboardResPageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardResPageTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherDay?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageTileDataUnionDevice value)? device,
    TResult Function(DashboardResPageTileDataUnionClock value)? clock,
    TResult Function(DashboardResPageTileDataUnionWeatherDay value)? weatherDay,
    TResult Function(DashboardResPageTileDataUnionWeatherForecast value)?
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
    return _$$DashboardResPageTileDataUnionWeatherDayImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageTileDataUnionWeatherDay
    implements DashboardResPageTileDataUnion {
  const factory DashboardResPageTileDataUnionWeatherDay(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String page,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span') final int colSpan,
      final String type}) = _$DashboardResPageTileDataUnionWeatherDayImpl;

  factory DashboardResPageTileDataUnionWeatherDay.fromJson(
          Map<String, dynamic> json) =
      _$DashboardResPageTileDataUnionWeatherDayImpl.fromJson;

  /// A unique identifier for the dashboard tile.
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource;

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated page.
  @override
  String get page;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Indicates that this is a day weather tile.
  @override
  String get type;

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageTileDataUnionWeatherDayImplCopyWith<
          _$DashboardResPageTileDataUnionWeatherDayImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardResPageTileDataUnionWeatherForecastImplCopyWith<$Res>
    implements $DashboardResPageTileDataUnionCopyWith<$Res> {
  factory _$$DashboardResPageTileDataUnionWeatherForecastImplCopyWith(
          _$DashboardResPageTileDataUnionWeatherForecastImpl value,
          $Res Function(_$DashboardResPageTileDataUnionWeatherForecastImpl)
              then) =
      __$$DashboardResPageTileDataUnionWeatherForecastImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      int row,
      int col,
      @JsonKey(name: 'data_source')
      List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String page,
      @JsonKey(name: 'row_span') int rowSpan,
      @JsonKey(name: 'col_span') int colSpan,
      String type});
}

/// @nodoc
class __$$DashboardResPageTileDataUnionWeatherForecastImplCopyWithImpl<$Res>
    extends _$DashboardResPageTileDataUnionCopyWithImpl<$Res,
        _$DashboardResPageTileDataUnionWeatherForecastImpl>
    implements
        _$$DashboardResPageTileDataUnionWeatherForecastImplCopyWith<$Res> {
  __$$DashboardResPageTileDataUnionWeatherForecastImplCopyWithImpl(
      _$DashboardResPageTileDataUnionWeatherForecastImpl _value,
      $Res Function(_$DashboardResPageTileDataUnionWeatherForecastImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? row = null,
    Object? col = null,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? page = null,
    Object? rowSpan = null,
    Object? colSpan = null,
    Object? type = null,
  }) {
    return _then(_$DashboardResPageTileDataUnionWeatherForecastImpl(
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardTileBaseDataSourceUnion>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as String,
      rowSpan: null == rowSpan
          ? _value.rowSpan
          : rowSpan // ignore: cast_nullable_to_non_nullable
              as int,
      colSpan: null == colSpan
          ? _value.colSpan
          : colSpan // ignore: cast_nullable_to_non_nullable
              as int,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardResPageTileDataUnionWeatherForecastImpl
    implements DashboardResPageTileDataUnionWeatherForecast {
  const _$DashboardResPageTileDataUnionWeatherForecastImpl(
      {required this.id,
      required this.row,
      required this.col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.page,
      @JsonKey(name: 'row_span') this.rowSpan = 0,
      @JsonKey(name: 'col_span') this.colSpan = 0,
      this.type = 'weather-forecast'})
      : _dataSource = dataSource;

  factory _$DashboardResPageTileDataUnionWeatherForecastImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardResPageTileDataUnionWeatherForecastImplFromJson(json);

  /// A unique identifier for the dashboard tile.
  @override
  final String id;

  /// The row position of the tile in the grid.
  @override
  final int row;

  /// The column position of the tile in the grid.
  @override
  final int col;

  /// A list of data sources used by the tile, typically for real-time updates.
  final List<DashboardTileBaseDataSourceUnion> _dataSource;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated page.
  @override
  final String page;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  final int rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  final int colSpan;

  /// Indicates that this is a weather forecast tile.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardResPageTileDataUnion.weatherForecast(id: $id, row: $row, col: $col, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, page: $page, rowSpan: $rowSpan, colSpan: $colSpan, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardResPageTileDataUnionWeatherForecastImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.row, row) || other.row == row) &&
            (identical(other.col, col) || other.col == col) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.rowSpan, rowSpan) || other.rowSpan == rowSpan) &&
            (identical(other.colSpan, colSpan) || other.colSpan == colSpan) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      row,
      col,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      page,
      rowSpan,
      colSpan,
      type);

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardResPageTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardResPageTileDataUnionWeatherForecastImpl>
      get copyWith =>
          __$$DashboardResPageTileDataUnionWeatherForecastImplCopyWithImpl<
                  _$DashboardResPageTileDataUnionWeatherForecastImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        device,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        clock,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherDay,
    required TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)
        weatherForecast,
  }) {
    return weatherForecast(id, row, col, dataSource, createdAt, updatedAt, page,
        rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        device,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        clock,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherDay,
    TResult? Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherForecast,
  }) {
    return weatherForecast?.call(id, row, col, dataSource, createdAt, updatedAt,
        page, rowSpan, colSpan, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String? icon,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        device,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        clock,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherDay,
    TResult Function(
            String id,
            int row,
            int col,
            @JsonKey(name: 'data_source')
            List<DashboardTileBaseDataSourceUnion> dataSource,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String page,
            @JsonKey(name: 'row_span') int rowSpan,
            @JsonKey(name: 'col_span') int colSpan,
            String type)?
        weatherForecast,
    required TResult orElse(),
  }) {
    if (weatherForecast != null) {
      return weatherForecast(id, row, col, dataSource, createdAt, updatedAt,
          page, rowSpan, colSpan, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardResPageTileDataUnionDevice value) device,
    required TResult Function(DashboardResPageTileDataUnionClock value) clock,
    required TResult Function(DashboardResPageTileDataUnionWeatherDay value)
        weatherDay,
    required TResult Function(
            DashboardResPageTileDataUnionWeatherForecast value)
        weatherForecast,
  }) {
    return weatherForecast(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardResPageTileDataUnionDevice value)? device,
    TResult? Function(DashboardResPageTileDataUnionClock value)? clock,
    TResult? Function(DashboardResPageTileDataUnionWeatherDay value)?
        weatherDay,
    TResult? Function(DashboardResPageTileDataUnionWeatherForecast value)?
        weatherForecast,
  }) {
    return weatherForecast?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardResPageTileDataUnionDevice value)? device,
    TResult Function(DashboardResPageTileDataUnionClock value)? clock,
    TResult Function(DashboardResPageTileDataUnionWeatherDay value)? weatherDay,
    TResult Function(DashboardResPageTileDataUnionWeatherForecast value)?
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
    return _$$DashboardResPageTileDataUnionWeatherForecastImplToJson(
      this,
    );
  }
}

abstract class DashboardResPageTileDataUnionWeatherForecast
    implements DashboardResPageTileDataUnion {
  const factory DashboardResPageTileDataUnionWeatherForecast(
      {required final String id,
      required final int row,
      required final int col,
      @JsonKey(name: 'data_source')
      required final List<DashboardTileBaseDataSourceUnion> dataSource,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String page,
      @JsonKey(name: 'row_span') final int rowSpan,
      @JsonKey(name: 'col_span') final int colSpan,
      final String type}) = _$DashboardResPageTileDataUnionWeatherForecastImpl;

  factory DashboardResPageTileDataUnionWeatherForecast.fromJson(
          Map<String, dynamic> json) =
      _$DashboardResPageTileDataUnionWeatherForecastImpl.fromJson;

  /// A unique identifier for the dashboard tile.
  @override
  String get id;

  /// The row position of the tile in the grid.
  @override
  int get row;

  /// The column position of the tile in the grid.
  @override
  int get col;

  /// A list of data sources used by the tile, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardTileBaseDataSourceUnion> get dataSource;

  /// The timestamp when the dashboard tile was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard tile was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated page.
  @override
  String get page;

  /// The number of rows the tile spans.
  @override
  @JsonKey(name: 'row_span')
  int get rowSpan;

  /// The number of columns the tile spans.
  @override
  @JsonKey(name: 'col_span')
  int get colSpan;

  /// Indicates that this is a weather forecast tile.
  @override
  String get type;

  /// Create a copy of DashboardResPageTileDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardResPageTileDataUnionWeatherForecastImplCopyWith<
          _$DashboardResPageTileDataUnionWeatherForecastImpl>
      get copyWith => throw _privateConstructorUsedError;
}
