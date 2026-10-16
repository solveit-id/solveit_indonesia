<?php

namespace Tests\Feature\Admin;

use App\Actions\Admin\IssueAdminAccessLink;
use App\Enums\AdminAccessLinkPurpose;
use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Models\AdminAccessLink;
use App\Models\AdminAuditEvent;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\DataProvider;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * Owner invitations (B3.1b): issued once to the owner, delivered by hand, single use,
 * expiring after 48 hours, revocable, one open link per account, no account usable before
 * password and TOTP are set.
 */
class AdminInvitationTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    /**
     * Error bodies are asserted as production returns them (APP_DEBUG=false, required
     * outside local development); CI runs the suite with APP_DEBUG=true.
     */
    protected function setUp(): void
    {
        parent::setUp();

        config(['app.debug' => false]);
    }

    private const INVITEE_PASSWORD = 'invitee chose this passphrase';

    public function test_an_owner_invites_and_the_invitee_activates_with_password_and_totp(): void
    {
        $this->usingAdminClient('owner');
        $owner = $this->signInConfirmedOwner();

        $response = $this->adminRequest('POST', 'invitations', ['email' => '  New.Admin@Example.com ', 'role' => 'admin'])
            ->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.invitation.status', 'pending')
            ->assertJsonPath('data.invitation.account.email', 'new.admin@example.com')
            ->assertJsonPath('data.invitation.account.role', 'admin')
            ->assertJsonPath('data.invitation.account.status', 'pending')
            ->assertJsonPath('data.invitation.issued_by_user_id', $owner->id);

        $url = $response->json('data.access_link.url');
        $token = $this->tokenFromAccessLink($url);
        $invitee = User::query()->where('email', 'new.admin@example.com')->sole();
        $this->assertSame(AdminRole::Admin, $invitee->role);
        $this->assertFalse($invitee->canSignInToAdmin());
        $this->assertSame(now()->addHours(48)->toIso8601String(), $response->json('data.access_link.expires_at'));
        $this->assertSame(AdminAccessLink::hashToken($token), AdminAccessLink::query()->sole()->token_hash);

        // Not usable before activation: the random password is unknown, and no TOTP.
        $this->usingAdminClient('invitee');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $token])->assertOk()
            ->assertJsonPath('data.purpose', 'activation')
            ->assertJsonPath('data.email', 'n***@example.com');
        $redeemed = $this->adminRequest('POST', 'access-links/redeem', [
            'token' => $token,
            'name' => 'New Admin',
            'password' => self::INVITEE_PASSWORD,
            'password_confirmation' => self::INVITEE_PASSWORD,
        ])->assertOk();

        $this->usingAdminClient('password-only');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $invitee->email, 'password' => self::INVITEE_PASSWORD])->assertUnprocessable();

        $this->usingAdminClient('invitee');
        $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($redeemed->json('data.two_factor.setup_key'))])
            ->assertOk()
            ->assertJsonPath('data.account.role', 'admin')
            ->assertJsonPath('data.account.permissions', ['account.manage-own']);
        $this->assertTrue($invitee->fresh()->canSignInToAdmin());

        // Used once: the same link never works again.
        $this->usingAdminClient('replay');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $token])->assertNotFound();

        $this->usingAdminClient('owner');
        $this->adminRequest('GET', 'invitations/'.AdminAccessLink::query()->sole()->id)->assertOk()->assertJsonPath('data.status', 'completed');
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::InvitationIssued->value, 'actor_user_id' => $owner->id, 'subject_id' => $invitee->id]);
        $this->assertEquals(
            ['to_role' => 'admin', 'account_created' => true, 'access_link_id' => AdminAccessLink::query()->sole()->id],
            AdminAuditEvent::query()->where('action', AdminAuditAction::InvitationIssued)->sole()->metadata,
        );
    }

    public function test_an_owner_may_invite_another_owner(): void
    {
        $this->usingAdminClient('owner')->signInConfirmedOwner();

        $token = $this->tokenFromAccessLink(
            $this->adminRequest('POST', 'invitations', ['email' => 'second.owner@example.com', 'role' => 'owner'])->assertCreated()->json('data.access_link.url'),
        );

        $this->usingAdminClient('invitee');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $setupKey = $this->adminRequest('POST', 'access-links/redeem', ['token' => $token, 'name' => 'Second Owner', 'password' => self::INVITEE_PASSWORD, 'password_confirmation' => self::INVITEE_PASSWORD])
            ->assertOk()->json('data.two_factor.setup_key');
        $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($setupKey)])
            ->assertOk()->assertJsonPath('data.account.permissions', self::OWNER_PERMISSIONS);
    }

    public function test_the_link_appears_only_in_the_issuing_response(): void
    {
        $this->signInConfirmedOwner();
        $issued = $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertCreated();
        $token = $this->tokenFromAccessLink($issued->json('data.access_link.url'));
        $invitation = $issued->json('data.invitation.id');
        $account = $issued->json('data.invitation.account.id');

        $reads = [
            $this->adminRequest('GET', 'invitations')->assertOk(),
            $this->adminRequest('GET', "invitations/{$invitation}")->assertOk(),
            $this->adminRequest('GET', "users/{$account}")->assertOk()->assertJsonPath('data.open_access_link.status', 'pending'),
            $this->adminRequest('GET', 'audit-events')->assertOk(),
        ];

        foreach ($reads as $read) {
            $this->assertStringNotContainsString($token, $read->getContent());
            $this->assertStringNotContainsString(AdminAccessLink::hashToken($token), $read->getContent());
            $this->assertStringNotContainsString('#token=', $read->getContent());
            $this->assertStringNotContainsString('token_hash', $read->getContent());
        }

        $this->assertSame(
            ['id', 'status', 'account', 'issued_by_user_id', 'created_at', 'expires_at', 'redeemed_at', 'completed_at', 'revoked_at'],
            array_keys($reads[1]->json('data')),
        );
    }

    public function test_nothing_secret_reaches_the_log(): void
    {
        $logged = [];
        Event::listen(MessageLogged::class, function (MessageLogged $message) use (&$logged): void {
            $logged[] = $message->message.json_encode($message->context);
        });
        $this->signInConfirmedOwner();

        $token = $this->tokenFromAccessLink($this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->json('data.access_link.url'));

        // A failure while issuing is logged (500) without the link it was building.
        $this->failAuditWritesFor(AdminAuditAction::InvitationIssued);
        $this->adminRequest('POST', 'invitations', ['email' => 'second@example.com', 'role' => 'admin'])->assertStatus(500)->assertExactJson(['message' => 'Server Error']);

        $this->assertNotEmpty($logged, 'the failure was reported');
        foreach ($logged as $entry) {
            $this->assertStringNotContainsString($token, $entry);
            $this->assertStringNotContainsString('#token=', $entry);
            $this->assertStringNotContainsString(self::ADMIN_PASSWORD, $entry);
        }
    }

    public function test_a_failed_audit_write_issues_no_invitation(): void
    {
        $this->signInConfirmedOwner();
        $this->failAuditWritesFor(AdminAuditAction::InvitationIssued);

        $response = $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertStatus(500);

        $this->assertStringNotContainsString('token', $response->getContent());
        $this->assertDatabaseMissing('users', ['email' => 'invitee@example.com']);
        $this->assertSame(0, AdminAccessLink::query()->count());
    }

    /**
     * @return array<string, array{array<string, mixed>, list<string>}>
     */
    public static function invalidInvitations(): array
    {
        return [
            'empty' => [[], ['email', 'role']],
            'not an address' => [['email' => 'not-an-address', 'role' => 'admin'], ['email']],
            'too long' => [['email' => str_repeat('a', 250).'@example.com', 'role' => 'admin'], ['email']],
            'unknown role' => [['email' => 'a@example.com', 'role' => 'editor'], ['role']],
            'role as array' => [['email' => 'a@example.com', 'role' => ['owner']], ['role']],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<string>  $errors
     */
    #[DataProvider('invalidInvitations')]
    public function test_invalid_invitations_are_refused(array $data, array $errors): void
    {
        $this->signInConfirmedOwner();

        $this->adminRequest('POST', 'invitations', $data)->assertUnprocessable()->assertJsonValidationErrors($errors);

        $this->assertSame(1, User::query()->count());
        $this->assertSame(0, AdminAccessLink::query()->count());
    }

    public function test_extra_fields_cannot_set_account_state(): void
    {
        $this->signInConfirmedOwner();

        $this->adminRequest('POST', 'invitations', [
            'email' => 'invitee@example.com',
            'role' => 'admin',
            'activated_at' => now()->toDateTimeString(),
            'two_factor_confirmed_at' => now()->toDateTimeString(),
            'password' => 'chosen by the owner',
            'name' => 'Chosen by the owner',
        ])->assertCreated();

        $invitee = User::query()->where('email', 'invitee@example.com')->sole();
        $this->assertNull($invitee->activated_at);
        $this->assertNull($invitee->two_factor_confirmed_at);
        $this->assertSame('', $invitee->name);
        $this->assertFalse(password_verify('chosen by the owner', $invitee->password));
    }

    /**
     * @return array<string, array{\Closure(): User, string}>
     */
    public static function addressesThatCannotBeInvited(): array
    {
        return [
            'active admin' => [fn (): User => User::factory()->activeAdmin()->create(), 'account_exists'],
            'active owner' => [fn (): User => User::factory()->owner()->create(), 'account_exists'],
            'credential reset pending' => [fn (): User => User::factory()->activeAdmin()->create(['two_factor_confirmed_at' => null]), 'account_exists'],
            'suspended' => [fn (): User => User::factory()->activeAdmin()->suspended()->create(), 'suspended'],
            'suspended pending' => [fn (): User => User::factory()->pendingActivation()->suspended()->create(), 'suspended'],
            'not an admin account' => [fn (): User => User::factory()->create(), 'not_admin_account'],
        ];
    }

    /**
     * @param  \Closure(): User  $makeAccount
     */
    #[DataProvider('addressesThatCannotBeInvited')]
    public function test_an_existing_account_is_never_duplicated_or_reinvited_out_of_state(\Closure $makeAccount, string $code): void
    {
        $existing = $makeAccount();
        $this->signInConfirmedOwner();
        $before = $existing->fresh()->getAttributes();

        $this->adminRequest('POST', 'invitations', ['email' => strtoupper($existing->email), 'role' => 'owner'])
            ->assertConflict()
            ->assertJsonPath('code', $code);

        $this->assertSame(1, User::query()->where('email', $existing->email)->count());
        $this->assertSame($before, $existing->fresh()->getAttributes());
        $this->assertSame(0, AdminAccessLink::query()->count());
    }

    public function test_a_pending_account_with_an_open_invitation_is_refused_until_it_is_revoked(): void
    {
        $this->signInConfirmedOwner();
        $first = $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertCreated();
        $firstToken = $this->tokenFromAccessLink($first->json('data.access_link.url'));

        $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'owner'])->assertConflict()->assertJsonPath('code', 'invitation_pending');

        $this->adminRequest('DELETE', 'invitations/'.$first->json('data.invitation.id'))->assertOk()->assertJsonPath('data.status', 'revoked');
        $second = $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'owner'])->assertCreated()
            ->assertJsonPath('data.invitation.account.id', $first->json('data.invitation.account.id'))
            ->assertJsonPath('data.invitation.account.role', 'owner');

        $this->assertSame(1, User::query()->where('email', 'invitee@example.com')->count());
        $this->assertSame(1, AdminAccessLink::query()->whereNull('revoked_at')->whereNull('completed_at')->count());
        $this->assertEquals(
            ['to_role' => 'owner', 'from_role' => 'admin', 'account_created' => false, 'access_link_id' => $second->json('data.invitation.id')],
            AdminAuditEvent::query()->where('action', AdminAuditAction::InvitationIssued)->latest('id')->first()->metadata,
        );

        $this->usingAdminClient('invitee');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $firstToken])->assertNotFound();
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $this->tokenFromAccessLink($second->json('data.access_link.url'))])->assertOk();
    }

    public function test_an_expired_invitation_stops_working_and_can_be_replaced(): void
    {
        $this->signInConfirmedOwner();
        $first = $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertCreated();
        $token = $this->tokenFromAccessLink($first->json('data.access_link.url'));

        $this->travel(47)->hours();
        $this->usingAdminClient('invitee');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $token])->assertOk();

        // Past the 30-minute idle limit the old session is gone: a fresh browser, as in real
        // life (a stale session cookie can lose its row to the session garbage collector).
        $this->travel(61)->minutes();
        $this->usingAdminClient('invitee-later');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $token])->assertNotFound();
        $this->adminRequest('POST', 'access-links/redeem', ['token' => $token, 'name' => 'X', 'password' => self::INVITEE_PASSWORD, 'password_confirmation' => self::INVITEE_PASSWORD])->assertNotFound();

        $this->usingAdminClient('owner');
        $this->signInConfirmedOwner();
        $this->adminRequest('GET', 'invitations?status=expired')->assertOk()->assertJsonPath('data.0.id', $first->json('data.invitation.id'));
        $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertCreated();
        $this->assertTrue(AdminAccessLink::query()->find($first->json('data.invitation.id'))->revoked_at !== null, 'the expired link is closed');
    }

    public function test_revoking_stops_an_enrollment_already_in_progress(): void
    {
        $this->usingAdminClient('owner')->signInConfirmedOwner();
        $issued = $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertCreated();

        $this->usingAdminClient('invitee');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $setupKey = $this->adminRequest('POST', 'access-links/redeem', [
            'token' => $this->tokenFromAccessLink($issued->json('data.access_link.url')),
            'name' => 'Invitee',
            'password' => self::INVITEE_PASSWORD,
            'password_confirmation' => self::INVITEE_PASSWORD,
        ])->assertOk()->json('data.two_factor.setup_key');

        // While the invitee enrols, a new invitation is refused (the link is live) ...
        $this->usingAdminClient('owner');
        $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertConflict()->assertJsonPath('code', 'invitation_pending');
        // ... and revoking ends it.
        $this->adminRequest('DELETE', 'invitations/'.$issued->json('data.invitation.id'))->assertOk()->assertJsonPath('data.status', 'revoked');

        $this->usingAdminClient('invitee');
        $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($setupKey)])->assertNotFound();
        $this->assertFalse(User::query()->where('email', 'invitee@example.com')->sole()->canSignInToAdmin());
    }

    public function test_an_abandoned_enrollment_frees_the_account_for_a_new_invitation(): void
    {
        $this->usingAdminClient('owner')->signInConfirmedOwner();
        $issued = $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertCreated();
        $this->usingAdminClient('invitee');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/redeem', ['token' => $this->tokenFromAccessLink($issued->json('data.access_link.url')), 'name' => 'Invitee', 'password' => self::INVITEE_PASSWORD, 'password_confirmation' => self::INVITEE_PASSWORD])->assertOk();

        // The 15-minute enrollment window passes; the owner is still signed in.
        $this->travel(16)->minutes();
        $this->usingAdminClient('owner');
        $this->confirmAdminPassword();

        $this->adminRequest('GET', 'invitations/'.$issued->json('data.invitation.id'))->assertJsonPath('data.status', 'redeemed');
        $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertCreated();
        $this->adminRequest('GET', 'invitations/'.$issued->json('data.invitation.id'))->assertJsonPath('data.status', 'revoked');
    }

    public function test_revoking_twice_changes_and_records_nothing_more(): void
    {
        $owner = $this->signInConfirmedOwner();
        $id = $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertCreated()->json('data.invitation.id');

        $this->adminRequest('DELETE', "invitations/{$id}")->assertOk();
        $revokedAt = AdminAccessLink::query()->find($id)->revoked_at;
        $this->travel(1)->minutes();
        $this->adminRequest('DELETE', "invitations/{$id}")->assertOk()->assertJsonPath('data.status', 'revoked');

        $this->assertEquals($revokedAt, AdminAccessLink::query()->find($id)->revoked_at);
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::InvitationRevoked->value, 'actor_user_id' => $owner->id]);
        $this->assertSame(1, AdminAuditEvent::query()->where('action', AdminAuditAction::InvitationRevoked)->count());
    }

    public function test_an_accepted_invitation_cannot_be_revoked_and_reset_links_are_not_invitations(): void
    {
        $owner = $this->signInConfirmedOwner();
        $admin = $this->createActiveAdmin();
        $accepted = app(IssueAdminAccessLink::class)->handle(User::factory()->pendingActivation()->create(), AdminAccessLinkPurpose::Activation, 60, $owner)->link;
        $accepted->forceFill(['redeemed_at' => now(), 'completed_at' => now()])->save();
        $reset = app(IssueAdminAccessLink::class)->handle($admin, AdminAccessLinkPurpose::CredentialReset, 60, $owner)->link;

        $this->adminRequest('DELETE', "invitations/{$accepted->id}")->assertConflict()->assertJsonPath('code', 'invitation_completed');
        $this->adminRequest('DELETE', "invitations/{$reset->id}")->assertNotFound()->assertExactJson(['message' => 'Invitation not found.']);
        $this->adminRequest('GET', "invitations/{$reset->id}")->assertNotFound();
        $this->adminRequest('DELETE', 'invitations/999999')->assertNotFound();
        $this->assertNull($reset->fresh()->revoked_at);
        $this->assertSame([$accepted->id], array_column($this->adminRequest('GET', 'invitations')->json('data'), 'id'));
    }

    public function test_the_invitation_list_filters_by_status_newest_first(): void
    {
        $this->signInConfirmedOwner();
        $ids = [];
        foreach (['a', 'b', 'c'] as $name) {
            $ids[] = $this->adminRequest('POST', 'invitations', ['email' => "{$name}@example.com", 'role' => 'admin'])->assertCreated()->json('data.invitation.id');
        }
        $this->adminRequest('DELETE', "invitations/{$ids[1]}")->assertOk();

        $this->assertSame(array_reverse($ids), array_column($this->adminRequest('GET', 'invitations')->json('data'), 'id'));
        $this->assertSame([$ids[2], $ids[0]], array_column($this->adminRequest('GET', 'invitations?status=pending')->json('data'), 'id'));
        $this->assertSame([$ids[1]], array_column($this->adminRequest('GET', 'invitations?status=revoked')->json('data'), 'id'));

        $page = $this->adminRequest('GET', 'invitations?per_page=2')->assertOk();
        $this->assertSame([$ids[2], $ids[1]], array_column($page->json('data'), 'id'));
        $this->assertSame([$ids[0]], array_column($this->adminRequest('GET', 'invitations?per_page=2&cursor='.$page->json('meta.next_cursor'))->json('data'), 'id'));
        $this->adminRequest('GET', 'invitations?status=lost')->assertUnprocessable()->assertJsonValidationErrors(['status']);
    }

    public function test_mysql_allows_only_one_open_link_per_account(): void
    {
        $account = User::factory()->pendingActivation()->create();
        $link = app(IssueAdminAccessLink::class)->handle($account, AdminAccessLinkPurpose::Activation, 60)->link;

        // A second open row written past the action (which would revoke the first) is refused.
        $second = new AdminAccessLink;
        $second->forceFill([
            'user_id' => $account->id,
            'purpose' => AdminAccessLinkPurpose::Activation,
            'token_hash' => AdminAccessLink::hashToken(AdminAccessLink::newToken()),
            'expires_at' => now()->addHour(),
        ]);

        try {
            DB::transaction(fn () => $second->save());
            $this->fail('A second open link was stored.');
        } catch (UniqueConstraintViolationException) {
            $this->assertSame(1, AdminAccessLink::query()->count());
        }

        // Closed links do not count: completed or revoked rows may pile up.
        $link->forceFill(['revoked_at' => now()])->save();
        $second->save();
        $this->assertSame(2, AdminAccessLink::query()->count());
    }
}
