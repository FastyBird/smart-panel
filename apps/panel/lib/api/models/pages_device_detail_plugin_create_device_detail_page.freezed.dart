// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'pages_device_detail_plugin_create_device_detail_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

PagesDeviceDetailPluginCreateDeviceDetailPage
    _$PagesDeviceDetailPluginCreateDeviceDetailPageFromJson(
        Map<String, dynamic> json) {
  return _PagesDeviceDetailPluginCreateDeviceDetailPage.fromJson(json);
}

/// @nodoc
mixin _$PagesDeviceDetailPluginCreateDeviceDetailPage {
  /// The unique identifier for the dashboard page (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// A list of data sources used by the page, typically for real-time updates.
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource =>
      throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this PagesDeviceDetailPluginCreateDeviceDetailPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PagesDeviceDetailPluginCreateDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PagesDeviceDetailPluginCreateDeviceDetailPageCopyWith<
          PagesDeviceDetailPluginCreateDeviceDetailPage>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PagesDeviceDetailPluginCreateDeviceDetailPageCopyWith<$Res> {
  factory $PagesDeviceDetailPluginCreateDeviceDetailPageCopyWith(
          PagesDeviceDetailPluginCreateDeviceDetailPage value,
          $Res Function(PagesDeviceDetailPluginCreateDeviceDetailPage) then) =
      _$PagesDeviceDetailPluginCreateDeviceDetailPageCopyWithImpl<$Res,
          PagesDeviceDetailPluginCreateDeviceDetailPage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      @JsonKey(name: 'data_source')
      List<DashboardModuleCreateDataSource> dataSource,
      String device,
      int order,
      String? icon});
}

/// @nodoc
class _$PagesDeviceDetailPluginCreateDeviceDetailPageCopyWithImpl<$Res,
        $Val extends PagesDeviceDetailPluginCreateDeviceDetailPage>
    implements $PagesDeviceDetailPluginCreateDeviceDetailPageCopyWith<$Res> {
  _$PagesDeviceDetailPluginCreateDeviceDetailPageCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PagesDeviceDetailPluginCreateDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? dataSource = null,
    Object? device = null,
    Object? order = null,
    Object? icon = freezed,
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
      dataSource: null == dataSource
          ? _value.dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleCreateDataSource>,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PagesDeviceDetailPluginCreateDeviceDetailPageImplCopyWith<
        $Res>
    implements $PagesDeviceDetailPluginCreateDeviceDetailPageCopyWith<$Res> {
  factory _$$PagesDeviceDetailPluginCreateDeviceDetailPageImplCopyWith(
          _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl value,
          $Res Function(_$PagesDeviceDetailPluginCreateDeviceDetailPageImpl)
              then) =
      __$$PagesDeviceDetailPluginCreateDeviceDetailPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      @JsonKey(name: 'data_source')
      List<DashboardModuleCreateDataSource> dataSource,
      String device,
      int order,
      String? icon});
}

/// @nodoc
class __$$PagesDeviceDetailPluginCreateDeviceDetailPageImplCopyWithImpl<$Res>
    extends _$PagesDeviceDetailPluginCreateDeviceDetailPageCopyWithImpl<$Res,
        _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl>
    implements
        _$$PagesDeviceDetailPluginCreateDeviceDetailPageImplCopyWith<$Res> {
  __$$PagesDeviceDetailPluginCreateDeviceDetailPageImplCopyWithImpl(
      _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl _value,
      $Res Function(_$PagesDeviceDetailPluginCreateDeviceDetailPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of PagesDeviceDetailPluginCreateDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? dataSource = null,
    Object? device = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$PagesDeviceDetailPluginCreateDeviceDetailPageImpl(
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
      dataSource: null == dataSource
          ? _value._dataSource
          : dataSource // ignore: cast_nullable_to_non_nullable
              as List<DashboardModuleCreateDataSource>,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl
    implements _PagesDeviceDetailPluginCreateDeviceDetailPage {
  const _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl(
      {required this.id,
      required this.type,
      required this.title,
      @JsonKey(name: 'data_source')
      required final List<DashboardModuleCreateDataSource> dataSource,
      required this.device,
      this.order = 0,
      this.icon})
      : _dataSource = dataSource;

  factory _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$PagesDeviceDetailPluginCreateDeviceDetailPageImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page.
  @override
  final String title;

  /// A list of data sources used by the page, typically for real-time updates.
  final List<DashboardModuleCreateDataSource> _dataSource;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource {
    if (_dataSource is EqualUnmodifiableListView) return _dataSource;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_dataSource);
  }

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The position of the page in the dashboard’s list.
  @override
  @JsonKey()
  final int order;

  /// The icon associated with the dashboard page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'PagesDeviceDetailPluginCreateDeviceDetailPage(id: $id, type: $type, title: $title, dataSource: $dataSource, device: $device, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            const DeepCollectionEquality()
                .equals(other._dataSource, _dataSource) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type, title,
      const DeepCollectionEquality().hash(_dataSource), device, order, icon);

  /// Create a copy of PagesDeviceDetailPluginCreateDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PagesDeviceDetailPluginCreateDeviceDetailPageImplCopyWith<
          _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl>
      get copyWith =>
          __$$PagesDeviceDetailPluginCreateDeviceDetailPageImplCopyWithImpl<
                  _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PagesDeviceDetailPluginCreateDeviceDetailPageImplToJson(
      this,
    );
  }
}

abstract class _PagesDeviceDetailPluginCreateDeviceDetailPage
    implements PagesDeviceDetailPluginCreateDeviceDetailPage {
  const factory _PagesDeviceDetailPluginCreateDeviceDetailPage(
          {required final String id,
          required final String type,
          required final String title,
          @JsonKey(name: 'data_source')
          required final List<DashboardModuleCreateDataSource> dataSource,
          required final String device,
          final int order,
          final String? icon}) =
      _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl;

  factory _PagesDeviceDetailPluginCreateDeviceDetailPage.fromJson(
          Map<String, dynamic> json) =
      _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page.
  @override
  String get title;

  /// A list of data sources used by the page, typically for real-time updates.
  @override
  @JsonKey(name: 'data_source')
  List<DashboardModuleCreateDataSource> get dataSource;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of PagesDeviceDetailPluginCreateDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PagesDeviceDetailPluginCreateDeviceDetailPageImplCopyWith<
          _$PagesDeviceDetailPluginCreateDeviceDetailPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
