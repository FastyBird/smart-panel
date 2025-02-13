// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_device_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardDevicePage _$DashboardDevicePageFromJson(Map<String, dynamic> json) {
  return _DashboardDevicePage.fromJson(json);
}

/// @nodoc
mixin _$DashboardDevicePage {
  /// A unique identifier for the dashboard page.
  String get id => throw _privateConstructorUsedError;

  /// The title of the dashboard page, displayed in the UI.
  String get title => throw _privateConstructorUsedError;

  /// The icon representing the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// The display order of the dashboard page in the navigation or list.
  int get order => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the dashboard page was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// Indicates that this is a device-specific dashboard page.
  String get type => throw _privateConstructorUsedError;

  /// Serializes this DashboardDevicePage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardDevicePageCopyWith<DashboardDevicePage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardDevicePageCopyWith<$Res> {
  factory $DashboardDevicePageCopyWith(
          DashboardDevicePage value, $Res Function(DashboardDevicePage) then) =
      _$DashboardDevicePageCopyWithImpl<$Res, DashboardDevicePage>;
  @useResult
  $Res call(
      {String id,
      String title,
      String? icon,
      int order,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String type});
}

/// @nodoc
class _$DashboardDevicePageCopyWithImpl<$Res, $Val extends DashboardDevicePage>
    implements $DashboardDevicePageCopyWith<$Res> {
  _$DashboardDevicePageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? icon = freezed,
    Object? order = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
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
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardDevicePageImplCopyWith<$Res>
    implements $DashboardDevicePageCopyWith<$Res> {
  factory _$$DashboardDevicePageImplCopyWith(_$DashboardDevicePageImpl value,
          $Res Function(_$DashboardDevicePageImpl) then) =
      __$$DashboardDevicePageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String? icon,
      int order,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String type});
}

/// @nodoc
class __$$DashboardDevicePageImplCopyWithImpl<$Res>
    extends _$DashboardDevicePageCopyWithImpl<$Res, _$DashboardDevicePageImpl>
    implements _$$DashboardDevicePageImplCopyWith<$Res> {
  __$$DashboardDevicePageImplCopyWithImpl(_$DashboardDevicePageImpl _value,
      $Res Function(_$DashboardDevicePageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? icon = freezed,
    Object? order = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? type = null,
  }) {
    return _then(_$DashboardDevicePageImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
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
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardDevicePageImpl implements _DashboardDevicePage {
  const _$DashboardDevicePageImpl(
      {required this.id,
      required this.title,
      required this.icon,
      required this.order,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      this.type = 'device'});

  factory _$DashboardDevicePageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardDevicePageImplFromJson(json);

  /// A unique identifier for the dashboard page.
  @override
  final String id;

  /// The title of the dashboard page, displayed in the UI.
  @override
  final String title;

  /// The icon representing the dashboard page.
  @override
  final String? icon;

  /// The display order of the dashboard page in the navigation or list.
  @override
  final int order;

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

  /// Indicates that this is a device-specific dashboard page.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardDevicePage(id: $id, title: $title, icon: $icon, order: $order, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardDevicePageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, title, icon, order, createdAt, updatedAt, device, type);

  /// Create a copy of DashboardDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardDevicePageImplCopyWith<_$DashboardDevicePageImpl> get copyWith =>
      __$$DashboardDevicePageImplCopyWithImpl<_$DashboardDevicePageImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardDevicePageImplToJson(
      this,
    );
  }
}

abstract class _DashboardDevicePage implements DashboardDevicePage {
  const factory _DashboardDevicePage(
      {required final String id,
      required final String title,
      required final String? icon,
      required final int order,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String device,
      final String type}) = _$DashboardDevicePageImpl;

  factory _DashboardDevicePage.fromJson(Map<String, dynamic> json) =
      _$DashboardDevicePageImpl.fromJson;

  /// A unique identifier for the dashboard page.
  @override
  String get id;

  /// The title of the dashboard page, displayed in the UI.
  @override
  String get title;

  /// The icon representing the dashboard page.
  @override
  String? get icon;

  /// The display order of the dashboard page in the navigation or list.
  @override
  int get order;

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

  /// Indicates that this is a device-specific dashboard page.
  @override
  String get type;

  /// Create a copy of DashboardDevicePage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardDevicePageImplCopyWith<_$DashboardDevicePageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
