enum SignupRole { investor, entrepreneur }

enum PreferredLanguage { es, en }

class RegisterRequest {
  const RegisterRequest({
    required this.email,
    required this.password,
    this.phone,
    this.preferredLanguage,
    this.signupRole,
  });

  final String email;
  final String password;
  final String? phone;
  final PreferredLanguage? preferredLanguage;
  final SignupRole? signupRole;

  Map<String, Object?> toJson() => {
    'email': email,
    'password': password,
    if (phone != null) 'phone': phone,
    if (preferredLanguage != null) 'preferredLanguage': preferredLanguage!.name,
    if (signupRole != null) 'signupRole': signupRole!.name,
  };

  @override
  String toString() => 'RegisterRequest(redacted)';
}

class LoginRequest {
  const LoginRequest({required this.email, required this.password});

  final String email;
  final String password;

  Map<String, Object?> toJson() => {'email': email, 'password': password};

  @override
  String toString() => 'LoginRequest(redacted)';
}
