<?php

namespace Tests\Feature;

use App\Events\ChatMessageSent;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\TestCase;

class ChatSynchronizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_two_authenticated_sessions_can_discover_and_recover_messages_without_duplicate_rows(): void
    {
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        $this->travelTo(now()->startOfSecond());
        Event::fake([ChatMessageSent::class]);
        $sender = User::create(['email' => Str::uuid().'@example.test']);
        $receiver = User::create(['email' => Str::uuid().'@example.test']);
        $outsider = User::create(['email' => Str::uuid().'@example.test']);
        foreach ([$sender, $receiver, $outsider] as $user) {
            $user->assignRole('investor');
        }
        $senderToken = $sender->createToken('sender-session')->plainTextToken;
        $receiverToken = $receiver->createToken('receiver-session')->plainTextToken;
        $this->asToken($receiverToken)->getJson('/api/v1/chat/conversations')->assertOk()->assertJsonCount(0, 'data');
        $id = $this->asToken($senderToken)->postJson('/api/v1/chat/conversations', ['otherUserId' => $receiver->id])->assertCreated()->json('data.id');
        $first = $this->postJson('/api/v1/chat/conversations/'.$id.'/messages', ['content' => 'First message'])->assertCreated()->json('data.id');
        $this->asToken($receiverToken)->getJson('/api/v1/chat/conversations')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.unreadCount', 1)->assertJsonPath('data.0.otherUser.id', $sender->id)->assertJsonPath('data.0.lastMessage.content', 'First message');
        $this->postJson('/api/v1/chat/conversations/'.$id.'/read')->assertOk();
        // Sender persists another message while the receiving session is disconnected.
        $second = $this->asToken($senderToken)->postJson('/api/v1/chat/conversations/'.$id.'/messages', ['content' => 'Missed while offline'])->assertCreated()->json('data.id');
        $this->asToken($receiverToken)->getJson('/api/v1/chat/conversations')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.unreadCount', 1)->assertJsonPath('data.0.messageCount', 2)->assertJsonPath('data.0.lastMessage.content', 'Missed while offline');
        $history = $this->getJson('/api/v1/chat/conversations/'.$id.'/messages')->assertOk()->assertJsonCount(2, 'data')->json('data');
        $this->assertSame([$first, $second], array_column($history, 'id'));
        $this->postJson('/api/v1/chat/conversations/'.$id.'/read')->assertOk();
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.unreadCount', 0);
        $this->assertDatabaseCount('messages', 2);
        Event::assertDispatched(ChatMessageSent::class, function ($event) use ($sender, $receiver, $second) {
            $channels = array_map(fn ($channel) => $channel->name, $event->broadcastOn());

            return $event->message['id'] === $second
                && $event->broadcastAs() === 'chat.message'
                && in_array('private-users.'.$sender->id, $channels)
                && in_array('private-users.'.$receiver->id, $channels);
        });
        $this->asToken($outsider->createToken('outsider')->plainTextToken)->getJson('/api/v1/chat/conversations')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/chat/conversations/'.$id.'/messages')->assertForbidden();
    }

    public function test_reading_an_empty_chat_does_not_hide_a_first_message_in_the_same_second_and_legacy_reads_still_work(): void
    {
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        $this->travelTo(now()->startOfSecond());
        Event::fake([ChatMessageSent::class]);
        $one = User::create(['email' => Str::uuid().'@example.test']);
        $two = User::create(['email' => Str::uuid().'@example.test']);
        foreach ([$one, $two] as $user) {
            $user->assignRole('investor');
        }
        $oneToken = $one->createToken('one')->plainTextToken;
        $twoToken = $two->createToken('two')->plainTextToken;
        $id = $this->asToken($oneToken)->postJson('/api/v1/chat/conversations', ['otherUserId' => $two->id])->assertCreated()->json('data.id');
        $this->asToken($twoToken)->postJson('/api/v1/chat/conversations/'.$id.'/read')->assertOk();
        $first = $this->asToken($oneToken)->postJson('/api/v1/chat/conversations/'.$id.'/messages', ['content' => 'First after empty read'])->assertCreated()->json('data.id');
        $this->asToken($twoToken)->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.unreadCount', 1);
        $this->postJson('/api/v1/chat/conversations/'.$id.'/read')->assertOk();
        $conversation = Conversation::findOrFail($id);
        $prefix = $conversation->user_one_id === $two->id ? 'user_one' : 'user_two';
        $this->assertSame($first, $conversation->{$prefix.'_read_message_id'});
        // Existing rows have only timestamps until the next successful read.
        $conversation->update([$prefix.'_read_message_id' => null]);
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.unreadCount', 0);
        $this->travel(1)->seconds();
        $this->asToken($oneToken)->postJson('/api/v1/chat/conversations/'.$id.'/messages', ['content' => 'After legacy read'])->assertCreated();
        $this->asToken($twoToken)->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.unreadCount', 1);
        $this->postJson('/api/v1/chat/conversations/'.$id.'/read')->assertOk();
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.unreadCount', 0);
    }

    private function asToken(string $token): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }
}
