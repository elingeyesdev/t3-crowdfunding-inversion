<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class ChatMessageSent implements ShouldBroadcastNow
{
    public function __construct(public array $message, private string $one, private string $two) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('users.'.$this->one), new PrivateChannel('users.'.$this->two)];
    }

    public function broadcastAs(): string
    {
        return 'chat.message';
    }

    public function broadcastWith(): array
    {
        return ['message' => $this->message];
    }
}
