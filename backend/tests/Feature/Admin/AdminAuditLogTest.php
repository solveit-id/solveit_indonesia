<?php

namespace Tests\Feature\Admin;

use App\Actions\Admin\RecordAdminAuditEvent;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Models\AdminAuditEvent;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

class AdminAuditLogTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    private function recordEvent(): AdminAuditEvent
    {
        return app(RecordAdminAuditEvent::class)->handle(AdminAuditAction::LoginFailed, AdminActorType::Anonymous, metadata: ['email_fingerprint' => str_repeat('a', 64)]);
    }

    public function test_the_model_refuses_updates_and_deletes(): void
    {
        $event = $this->recordEvent();

        try {
            $event->forceFill(['action' => AdminAuditAction::Logout])->save();
            $this->fail('An audit event was updated.');
        } catch (LogicException $exception) {
            $this->assertSame('Admin audit events are append-only.', $exception->getMessage());
        }

        $this->expectException(LogicException::class);
        $event->delete();
    }

    public function test_the_database_refuses_update_for_every_user(): void
    {
        $event = $this->recordEvent();

        try {
            DB::table('admin_audit_events')->where('id', $event->id)->update(['action' => 'login.succeeded']);
            $this->fail('The database allowed an UPDATE.');
        } catch (QueryException $exception) {
            $this->assertSame('45000', $exception->errorInfo[0]);
        }

        $this->assertSame('login.failed', DB::table('admin_audit_events')->value('action'));
    }

    public function test_the_database_refuses_delete_for_every_user(): void
    {
        $this->recordEvent();

        try {
            DB::table('admin_audit_events')->delete();
            $this->fail('The database allowed a DELETE.');
        } catch (QueryException $exception) {
            $this->assertSame('45000', $exception->errorInfo[0]);
        }

        $this->assertSame(1, DB::table('admin_audit_events')->count());
    }

    public function test_both_triggers_exist(): void
    {
        $triggers = collect(DB::select('SELECT TRIGGER_NAME AS name, EVENT_MANIPULATION AS event FROM information_schema.TRIGGERS WHERE EVENT_OBJECT_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = ?', ['admin_audit_events']))
            ->mapWithKeys(fn (object $trigger): array => [$trigger->event => $trigger->name])
            ->all();

        $this->assertSame(['DELETE' => 'admin_audit_events_refuse_delete', 'UPDATE' => 'admin_audit_events_refuse_update'], collect($triggers)->sortKeys()->all());
    }

    /**
     * @return array<string, array{array<string, mixed>}>
     */
    public static function unsafeMetadata(): array
    {
        return [
            'password' => [['password' => 'secret']],
            'code' => [['code' => '123456']],
            'token' => [['token' => 'abc']],
            'email' => [['email' => 'a@example.com']],
            'nested value' => [['reason' => ['nested']]],
        ];
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    #[DataProvider('unsafeMetadata')]
    public function test_metadata_outside_the_allowlist_is_refused(array $metadata): void
    {
        $this->expectException(InvalidArgumentException::class);

        app(RecordAdminAuditEvent::class)->handle(AdminAuditAction::LoginFailed, AdminActorType::Anonymous, metadata: $metadata);
    }

    public function test_a_full_sign_in_leaves_no_secret_in_the_audit_log(): void
    {
        $user = $this->createActiveAdmin();
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => 'wrong guess for the log']);
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);
        $code = $this->freshTotpCode($user);
        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $code])->assertNoContent();

        $log = json_encode(DB::table('admin_audit_events')->get());

        $this->assertStringNotContainsString(self::ADMIN_PASSWORD, $log);
        $this->assertStringNotContainsString('wrong guess for the log', $log);
        $this->assertStringNotContainsString($code, $log);
        $this->assertStringNotContainsString($this->totpSecret($user), $log);
        foreach ($user->recoveryCodes() as $recoveryCode) {
            $this->assertStringNotContainsString($recoveryCode, $log);
        }
        $this->assertSame(
            ['login.failed', 'login.succeeded'],
            DB::table('admin_audit_events')->orderBy('id')->pluck('action')->all(),
        );
    }
}
