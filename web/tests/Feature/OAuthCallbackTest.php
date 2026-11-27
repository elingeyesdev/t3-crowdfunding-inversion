<?php

namespace Tests\Feature;

use Tests\TestCase;

class OAuthCallbackTest extends TestCase
{
    public function test_callback_html_does_not_cache_credentials_or_forward_them_as_a_referrer(): void
    {
        $this->withoutVite();
        $response = $this->get('/auth/callback?token=synthetic-credential&role=investor');
        $response->assertOk()->assertViewIs('app')->assertHeader('Referrer-Policy', 'no-referrer');
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $response->assertDontSee('synthetic-credential');
    }
}
