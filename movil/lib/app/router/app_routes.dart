abstract final class AppRoutes {
  static const root = '/';
  static const explore = '/explorar';
  static const tracking = '/seguimiento';
  static const notifications = '/notificaciones';
  static const account = '/cuenta';
  static const access = '/acceso';
  static const register = '/registro';
  static const session = '/sesion';

  static const exploreName = 'explore';
  static const trackingName = 'tracking';
  static const notificationsName = 'notifications';
  static const accountName = 'account';
  static const accessName = 'access';
  static const registerName = 'register';
  static const sessionName = 'session';
  static const campaignName = 'campaignDetail';
  static const receipts = '/comprobantes';
  static const receiptsName = 'contributionReceipts';
  static const contributionName = 'contribution';
  static const receiptName = 'contributionReceipt';
  static const _uuid =
      r'[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}';
  static bool _contribution(String path) =>
      RegExp('^/explorar/campanas/$_uuid/aportar\$').hasMatch(path);
  static bool _receipt(String path) =>
      RegExp('^/comprobantes/$_uuid\$').hasMatch(path);

  static bool isPrivate(String path) =>
      path == tracking ||
      path == notifications ||
      path == receipts ||
      _contribution(path) ||
      _receipt(path);

  // Nunca aceptar URLs externas, rutas arbitrarias ni consultas anidadas.
  static String safeReturn(String? value) =>
      ([explore, account, tracking, notifications, receipts].contains(value) ||
          (value != null && (_contribution(value) || _receipt(value))) ||
          (value != null &&
              RegExp(
                r'^/explorar/campanas/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$',
              ).hasMatch(value)))
      ? value!
      : account;
}
