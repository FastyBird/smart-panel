// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'pages_device_detail_plugin_device_detail_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

PagesDeviceDetailPluginDeviceDetailPage
    _$PagesDeviceDetailPluginDeviceDetailPageFromJson(
        Map<String, dynamic> json) {
  return _PagesDeviceDetailPluginDeviceDetailPage.fromJson(json);
}

/// @nodoc
mixin _$PagesDeviceDetailPluginDeviceDetailPage {
  /// A unique identifier for the dashboard page.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page, displayed in the UI.
  String get title => throw _privateConstructorUsedError;

  /// The icon representing the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// A list of data sources used by the page, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardModuleDataSource> get dataSource =>
      throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The display order of the dashboard page in the navigation or list.
  int get order => throw _privateConstructorUsedError;

  /// Serializes this PagesDeviceDetailPluginDeviceDetailPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PagesDeviceDetailPluginDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PagesDeviceDetailPluginDeviceDetailPageCopyWith<
          PagesDeviceDetailPluginDeviceDetailPage>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PagesDeviceDetailPluginDeviceDetailPageCopyWith<$Res> {
  factory $PagesDeviceDetailPluginDeviceDetailPageCopyWith(
          PagesDeviceDetailPluginDeviceDetailPage value,
          $Res Function(PagesDeviceDetailPluginDeviceDetailPage) then) =
      _$PagesDeviceDetailPluginDeviceDetailPageCopyWithImpl<$Res,
          PagesDeviceDetailPluginDeviceDetailPage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String? icon,
      @JsonKey(name: 'data_source') List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      int order});
}

/// @nodoc
class _$PagesDeviceDetailPluginDeviceDetailPageCopyWithImpl<$Res,
        $Val extends PagesDeviceDetailPluginDeviceDetailPage>
    implements $PagesDeviceDetailPluginDeviceDetailPageCopyWith<$Res> {
  _$PagesDeviceDetailPluginDeviceDetailPageCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PagesDeviceDetailPluginDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? icon = freezed,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? order = null,
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
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleDataSource>,
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
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PagesDeviceDetailPluginDeviceDetailPageImplCopyWith<$Res>
    implements $PagesDeviceDetailPluginDeviceDetailPageCopyWith<$Res> {
  factory _$$PagesDeviceDetailPluginDeviceDetailPageImplCopyWith(
          _$PagesDeviceDetailPluginDeviceDetailPageImpl value,
          $Res Function(_$PagesDeviceDetailPluginDeviceDetailPageImpl) then) =
      __$$PagesDeviceDetailPluginDeviceDetailPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String? icon,
      @JsonKey(name: 'data_source') List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      int order});
}

/// @nodoc
class __$$PagesDeviceDetailPluginDeviceDetailPageImplCopyWithImpl<$Res>
    extends _$PagesDeviceDetailPluginDeviceDetailPageCopyWithImpl<$Res,
        _$PagesDeviceDetailPluginDeviceDetailPageImpl>
    implements _$$PagesDeviceDetailPluginDeviceDetailPageImplCopyWith<$Res> {
  __$$PagesDeviceDetailPluginDeviceDetailPageImplCopyWithImpl(
      _$PagesDeviceDetailPluginDeviceDetailPageImpl _value,
      $Res Function(_$PagesDeviceDetailPluginDeviceDetailPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of PagesDeviceDetailPluginDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? icon = freezed,
    Object? dataSource = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? order = null,
  }) {
    return _then(_$PagesDeviceDetailPluginDeviceDetailPageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleDataSource>,
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
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PagesDeviceDetailPluginDeviceDetailPageImpl
    implements _PagesDeviceDetailPluginDeviceDetailPage {
  const _$PagesDeviceDetailPluginDeviceDetailPageImpl(
      {required this.id,
      required this.type,
      required this.title,
      required this.icon,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      this.order = 0})
      : _dataSource = dataSource;

  factory _$PagesDeviceDetailPluginDeviceDetailPageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$PagesDeviceDetailPluginDeviceDetailPageImplFromJson(json);

  /// A unique identifier for the dashboard page.
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page, displayed in the UI.
  @override
  final String title;

  /// The icon representing the dashboard page.
  @override
  final String? icon;

  /// A list of data sources used by the page, typically for real-time updates.
  final List<DashboardModuleDataSource> _dataSource;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleDataSource> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The display order of the dashboard page in the navigation or list.
  @override
  @JsonKey()
  final int order;

  @override
  String toString() {
    return 'PagesDeviceDetailPluginDeviceDetailPage(id: $id, type: $type, title: $title, icon: $icon, dataSource: $dataSource, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, order: $order)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PagesDeviceDetailPluginDeviceDetailPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.order, order) || other.order == order));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      title,
      icon,
      const DeepCollectionEquality().hash(_dataSource),
      createdAt,
      updatedAt,
      device,
      order);

  /// Create a copy of PagesDeviceDetailPluginDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PagesDeviceDetailPluginDeviceDetailPageImplCopyWith<
          _$PagesDeviceDetailPluginDeviceDetailPageImpl>
      get copyWith =>
          __$$PagesDeviceDetailPluginDeviceDetailPageImplCopyWithImpl<
              _$PagesDeviceDetailPluginDeviceDetailPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PagesDeviceDetailPluginDeviceDetailPageImplToJson(
      this,
    );
  }
}

abstract class _PagesDeviceDetailPluginDeviceDetailPage
    implements PagesDeviceDetailPluginDeviceDetailPage {
  const factory _PagesDeviceDetailPluginDeviceDetailPage(
      {required final String id,
      required final String type,
      required final String title,
      required final String? icon,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleDataSource> dataSource,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String device,
      final int order}) = _$PagesDeviceDetailPluginDeviceDetailPageImpl;

  factory _PagesDeviceDetailPluginDeviceDetailPage.fromJson(
          Map<String, dynamic> json) =
      _$PagesDeviceDetailPluginDeviceDetailPageImpl.fromJson;

  /// A unique identifier for the dashboard page.
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page, displayed in the UI.
  @override
  String get title;

  /// The icon representing the dashboard page.
  @override
  String? get icon;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleDataSource> get dataSource;

  /// The timestamp when the dashboard page was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the dashboard page was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// The display order of the dashboard page in the navigation or list.
  @override
  int get order;

  /// Create a copy of PagesDeviceDetailPluginDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PagesDeviceDetailPluginDeviceDetailPageImplCopyWith<
          _$PagesDeviceDetailPluginDeviceDetailPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
