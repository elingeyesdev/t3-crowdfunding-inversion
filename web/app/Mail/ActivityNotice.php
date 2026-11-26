<?php

namespace App\Mail;

use App\Models\ActivityEmailDelivery;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;

class ActivityNotice extends Mailable
{
    public function __construct(public ActivityEmailDelivery $delivery) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: preg_replace('/[\r\n]+/', ' ', $this->delivery->title));
    }

    public function headers(): Headers
    {
        return new Headers(messageId: $this->delivery->id.'@'.(parse_url(config('app.url'), PHP_URL_HOST) ?: 'unifundme.local'));
    }

    public function content(): Content
    {
        // Only app-relative links; never forward a bearer token or an external URL.
        $path = $this->delivery->action_url;
        $safe = is_string($path) && preg_match('#^/(?:campaign/[a-f0-9-]{36}|chat/[a-f0-9-]{36}|notifications|account-settings)$#', $path);

        return new Content(view: 'mail.activity-notice', with: [
            'title' => $this->delivery->title,
            'body' => $this->delivery->body,
            'actionUrl' => rtrim(config('app.url'), '/').($safe ? $path : '/notifications'),
        ]);
    }
}
