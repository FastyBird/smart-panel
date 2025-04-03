// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_device_detail_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardDeviceDetailPage _$DashboardDeviceDetailPageFromJson(
    Map<String, dynamic> json) {
  return _DashboardDeviceDetailPage.fromJson(json);
}

/// @nodoc
mixin _$DashboardDeviceDetailPage {
  /// A unique identifier for the dashboard page.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page, displayed in the UI.
  String get title => throw _privateConstructorUsedError;

  /// The icon representing the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

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

  /// Serializes this DashboardDeviceDetailPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardDeviceDetailPageCopyWith<DashboardDeviceDetailPage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardDeviceDetailPageCopyWith<$Res> {
  factory $DashboardDeviceDetailPageCopyWith(DashboardDeviceDetailPage value,
          $Res Function(DashboardDeviceDetailPage) then) =
      _$DashboardDeviceDetailPageCopyWithImpl<$Res, DashboardDeviceDetailPage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String? icon,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      int order});
}

/// @nodoc
class _$DashboardDeviceDetailPageCopyWithImpl<$Res,
        $Val extends DashboardDeviceDetailPage>
    implements $DashboardDeviceDetailPageCopyWith<$Res> {
  _$DashboardDeviceDetailPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? icon = freezed,
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
abstract class _$$DashboardDeviceDetailPageImplCopyWith<$Res>
    implements $DashboardDeviceDetailPageCopyWith<$Res> {
  factory _$$DashboardDeviceDetailPageImplCopyWith(
          _$DashboardDeviceDetailPageImpl value,
          $Res Function(_$DashboardDeviceDetailPageImpl) then) =
      __$$DashboardDeviceDetailPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String? icon,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      int order});
}

/// @nodoc
class __$$DashboardDeviceDetailPageImplCopyWithImpl<$Res>
    extends _$DashboardDeviceDetailPageCopyWithImpl<$Res,
        _$DashboardDeviceDetailPageImpl>
    implements _$$DashboardDeviceDetailPageImplCopyWith<$Res> {
  __$$DashboardDeviceDetailPageImplCopyWithImpl(
      _$DashboardDeviceDetailPageImpl _value,
      $Res Function(_$DashboardDeviceDetailPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? icon = freezed,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? order = null,
  }) {
    return _then(_$DashboardDeviceDetailPageImpl(
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
class _$DashboardDeviceDetailPageImpl implements _DashboardDeviceDetailPage {
  const _$DashboardDeviceDetailPageImpl(
      {required this.id,
      required this.type,
      required this.title,
      required this.icon,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      this.order = 0});

  factory _$DashboardDeviceDetailPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardDeviceDetailPageImplFromJson(json);

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
    return 'DashboardDeviceDetailPage(id: $id, type: $type, title: $title, icon: $icon, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, order: $order)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardDeviceDetailPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.icon, icon) || other.icon == icon) &&
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
      runtimeType, id, type, title, icon, createdAt, updatedAt, device, order);

  /// Create a copy of DashboardDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardDeviceDetailPageImplCopyWith<_$DashboardDeviceDetailPageImpl>
      get copyWith => __$$DashboardDeviceDetailPageImplCopyWithImpl<
          _$DashboardDeviceDetailPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardDeviceDetailPageImplToJson(
      this,
    );
  }
}

abstract class _DashboardDeviceDetailPage implements DashboardDeviceDetailPage {
  const factory _DashboardDeviceDetailPage(
      {required final String id,
      required final String type,
      required final String title,
      required final String? icon,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String device,
      final int order}) = _$DashboardDeviceDetailPageImpl;

  factory _DashboardDeviceDetailPage.fromJson(Map<String, dynamic> json) =
      _$DashboardDeviceDetailPageImpl.fromJson;

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

  /// Create a copy of DashboardDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardDeviceDetailPageImplCopyWith<_$DashboardDeviceDetailPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
