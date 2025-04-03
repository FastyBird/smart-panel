// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_device_detail_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateDeviceDetailPage _$DashboardCreateDeviceDetailPageFromJson(
    Map<String, dynamic> json) {
  return _DashboardCreateDeviceDetailPage.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateDeviceDetailPage {
  /// The unique identifier for the dashboard page (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the dashboard page.
  String get title => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The position of the page in the dashboard’s list.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the dashboard page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateDeviceDetailPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateDeviceDetailPageCopyWith<DashboardCreateDeviceDetailPage>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateDeviceDetailPageCopyWith<$Res> {
  factory $DashboardCreateDeviceDetailPageCopyWith(
          DashboardCreateDeviceDetailPage value,
          $Res Function(DashboardCreateDeviceDetailPage) then) =
      _$DashboardCreateDeviceDetailPageCopyWithImpl<$Res,
          DashboardCreateDeviceDetailPage>;
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String device,
      int order,
      String? icon});
}

/// @nodoc
class _$DashboardCreateDeviceDetailPageCopyWithImpl<$Res,
        $Val extends DashboardCreateDeviceDetailPage>
    implements $DashboardCreateDeviceDetailPageCopyWith<$Res> {
  _$DashboardCreateDeviceDetailPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
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
abstract class _$$DashboardCreateDeviceDetailPageImplCopyWith<$Res>
    implements $DashboardCreateDeviceDetailPageCopyWith<$Res> {
  factory _$$DashboardCreateDeviceDetailPageImplCopyWith(
          _$DashboardCreateDeviceDetailPageImpl value,
          $Res Function(_$DashboardCreateDeviceDetailPageImpl) then) =
      __$$DashboardCreateDeviceDetailPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      String title,
      String device,
      int order,
      String? icon});
}

/// @nodoc
class __$$DashboardCreateDeviceDetailPageImplCopyWithImpl<$Res>
    extends _$DashboardCreateDeviceDetailPageCopyWithImpl<$Res,
        _$DashboardCreateDeviceDetailPageImpl>
    implements _$$DashboardCreateDeviceDetailPageImplCopyWith<$Res> {
  __$$DashboardCreateDeviceDetailPageImplCopyWithImpl(
      _$DashboardCreateDeviceDetailPageImpl _value,
      $Res Function(_$DashboardCreateDeviceDetailPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? title = null,
    Object? device = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardCreateDeviceDetailPageImpl(
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
class _$DashboardCreateDeviceDetailPageImpl
    implements _DashboardCreateDeviceDetailPage {
  const _$DashboardCreateDeviceDetailPageImpl(
      {required this.id,
      required this.type,
      required this.title,
      required this.device,
      this.order = 0,
      this.icon});

  factory _$DashboardCreateDeviceDetailPageImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateDeviceDetailPageImplFromJson(json);

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  final String id;

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the dashboard page.
  @override
  final String title;

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
    return 'DashboardCreateDeviceDetailPage(id: $id, type: $type, title: $title, device: $device, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateDeviceDetailPageImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, type, title, device, order, icon);

  /// Create a copy of DashboardCreateDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateDeviceDetailPageImplCopyWith<
          _$DashboardCreateDeviceDetailPageImpl>
      get copyWith => __$$DashboardCreateDeviceDetailPageImplCopyWithImpl<
          _$DashboardCreateDeviceDetailPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateDeviceDetailPageImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreateDeviceDetailPage
    implements DashboardCreateDeviceDetailPage {
  const factory _DashboardCreateDeviceDetailPage(
      {required final String id,
      required final String type,
      required final String title,
      required final String device,
      final int order,
      final String? icon}) = _$DashboardCreateDeviceDetailPageImpl;

  factory _DashboardCreateDeviceDetailPage.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateDeviceDetailPageImpl.fromJson;

  /// The unique identifier for the dashboard page (optional during creation).
  @override
  String get id;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the dashboard page.
  @override
  String get title;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// The position of the page in the dashboard’s list.
  @override
  int get order;

  /// The icon associated with the dashboard page.
  @override
  String? get icon;

  /// Create a copy of DashboardCreateDeviceDetailPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateDeviceDetailPageImplCopyWith<
          _$DashboardCreateDeviceDetailPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
