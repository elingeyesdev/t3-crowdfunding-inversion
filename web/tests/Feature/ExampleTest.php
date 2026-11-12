<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_the_application_returns_a_successful_response(): void
    {
        $this->withoutVite();
        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertSee('<div id="root"></div>', false);
    }

    public function test_web_routes_and_spa_navigation_entrypoints(): void
    {
        $this->withoutVite();

        foreach (['/', '/explore', '/login', '/register', '/donatok', '/admin', '/dashboard', '/profile'] as $path) {
            $this->get($path)
                ->assertOk()
                ->assertViewIs('app')
                ->assertSee('<div id="root"></div>', false);
        }

        // API routes are not intercepted by the web SPA fallback
        $this->getJson('/api/v1/non-existent-endpoint')->assertNotFound();
    }
}
