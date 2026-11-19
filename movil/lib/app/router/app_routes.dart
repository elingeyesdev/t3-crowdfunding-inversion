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

  static bool isPrivate(String path) =>
      path == tracking || path == notifications;

  // Nunca aceptar URLs externas, rutas arbitrarias ni consultas anidadas.
  static String safeReturn(String? value) =>
      [explore, account, tracking, notifications].contains(value)
      ? value!
      : account;
}
