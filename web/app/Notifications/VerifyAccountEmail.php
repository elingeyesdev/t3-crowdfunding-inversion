<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

class VerifyAccountEmail extends Notification
{
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function verificationPath(object $notifiable): string
    {
        return URL::temporarySignedRoute('email.confirm', now()->addMinutes(config('email_verification.expire')), [
            'id' => $notifiable->id,
            'hash' => sha1($notifiable->email),
        ], absolute: false);
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim(config('app.url'), '/').'/verify-email?'.http_build_query([
            'verification' => $this->verificationPath($notifiable),
        ], '', '&', PHP_QUERY_RFC3986);

        return (new MailMessage)
            ->subject('Verifica tu correo en UniFundMe')
            ->greeting('Hola')
            ->line('Confirma esta dirección de correo para poder realizar aportes y enviar o publicar campañas.')
            ->action('Verificar correo', $url)
            ->line('El enlace vence en '.config('email_verification.expire').' minutos. Inicia sesión en la cuenta correspondiente para confirmar.')
            ->line('Si no solicitaste este correo, puedes ignorarlo.');
    }
}
