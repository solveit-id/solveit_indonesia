<?php

namespace Tests\Feature\Admin;

use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Models\AdminAccessLink;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * Server-shell entry points: owner bootstrap and break-glass credential reset. The link
 * appears only in the command output; tests use synthetic addresses.
 */
class AdminConsoleCommandsTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    public function test_the_seeder_creates_no_account(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, User::query()->count());
    }

    public function test_bootstrap_creates_a_pending_owner_and_prints_a_one_time_link(): void
    {
        Log::spy();

        $this->artisan('admin:bootstrap-owner', ['email' => 'owner@example.com'])
            ->expectsOutputToContain('http://localhost/access#token=')
            ->assertSuccessful();

        $owner = User::query()->sole();
        $this->assertSame(AdminRole::Owner, $owner->role);
        $this->assertNull($owner->activated_at);
        $this->assertFalse($owner->canSignInToAdmin());
        $this->assertSame(1, AdminAccessLink::query()->redeemable()->count());
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::OwnerBootstrapIssued->value, 'actor_type' => 'cli', 'ip_address' => null]);
        Log::shouldNotHaveReceived('info');
        Log::shouldNotHaveReceived('debug');
    }

    public function test_bootstrap_is_refused_once_an_owner_is_active(): void
    {
        User::factory()->owner()->create();

        $this->artisan('admin:bootstrap-owner', ['email' => 'second@example.com'])
            ->expectsOutputToContain('An active owner already exists.')
            ->doesntExpectOutputToContain('#token=')
            ->assertFailed();

        $this->assertSame(1, User::query()->count());
        $this->assertSame(0, AdminAccessLink::query()->count());
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::OwnerBootstrapRefused->value, 'actor_type' => 'cli']);
    }

    public function test_bootstrap_for_another_address_is_refused_while_an_owner_is_pending(): void
    {
        $this->artisan('admin:bootstrap-owner', ['email' => 'owner@example.com'])->assertSuccessful();

        $this->artisan('admin:bootstrap-owner', ['email' => 'other@example.com'])->assertFailed();

        $this->assertSame(['owner@example.com'], User::query()->pluck('email')->all());
    }

    public function test_bootstrap_refuses_an_address_of_a_non_owner_account(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->artisan('admin:bootstrap-owner', ['email' => 'taken@example.com'])
            ->expectsOutputToContain('belongs to an account that is not an owner')
            ->assertFailed();

        $this->assertNull(User::query()->sole()->role);
    }

    public function test_bootstrap_needs_a_valid_address(): void
    {
        $this->artisan('admin:bootstrap-owner', ['email' => 'not an address'])->assertExitCode(2);

        $this->assertSame(0, User::query()->count());
    }

    public function test_bootstrap_asks_for_confirmation_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->artisan('admin:bootstrap-owner', ['email' => 'owner@example.com'])
            ->expectsConfirmation('Are you sure you want to run this command?', 'no')
            ->assertFailed();

        $this->assertSame(0, User::query()->count());
    }

    public function test_reset_credentials_ends_sessions_and_prints_a_link(): void
    {
        $user = $this->createActiveAdmin(AdminRole::Owner);
        $this->signIn($user);

        $this->artisan('admin:reset-credentials', ['email' => strtoupper($user->email)])
            ->expectsOutputToContain('http://localhost/access#token=')
            ->assertSuccessful();

        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->assertNull($user->fresh()->two_factor_secret);
        $this->assertSame(1, AdminAccessLink::query()->redeemable()->where('purpose', 'credential-reset')->count());
    }

    public function test_reset_credentials_refuses_unknown_pending_and_suspended_accounts(): void
    {
        $pending = User::factory()->pendingActivation()->create();
        $suspended = User::factory()->activeAdmin()->suspended()->create();

        $this->artisan('admin:reset-credentials', ['email' => 'nobody@example.com'])->assertFailed();
        $this->artisan('admin:reset-credentials', ['email' => $pending->email])->expectsOutputToContain('has not been activated')->assertFailed();
        $this->artisan('admin:reset-credentials', ['email' => $suspended->email])->expectsOutputToContain('is suspended')->assertFailed();

        $this->assertSame(0, AdminAccessLink::query()->count());
    }
}
