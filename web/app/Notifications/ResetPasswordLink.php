<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordLink extends Notification
{
    public function __construct(#[\SensitiveParameter] public string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        // Never use the inbound Host header to build a credential-bearing URL.
        $url = rtrim(config('app.url'), '/').'/reset-password?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ], '', '&', PHP_QUERY_RFC3986);

        return (new MailMessage)
            ->subject('Recupera tu acceso a UniFundMe')
            ->greeting('Hola')
            ->line('Recibimos una solicitud para restablecer la contraseña de tu cuenta.')
            ->action('Restablecer contraseña', $url)
            ->line('Este enlace vence en '.config('auth.passwords.users.expire').' minutos y solo puede utilizarse una vez.')
            ->line('Si no solicitaste este cambio, puedes ignorar el mensaje. Tu contraseña no se ha modificado.');
    }
}
