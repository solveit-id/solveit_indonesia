<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * MySQL error 1419: creating a trigger with binary logging enabled needs SUPER or
     * log_bin_trust_function_creators = ON.
     */
    private const TRIGGER_PRIVILEGE_ERROR = 1419;

    /**
     * Run the migrations.
     *
     * Append-only record of security-relevant admin events. Rows hold no secrets and no
     * personal data beyond the actor's IP address and a truncated user agent; metadata is
     * restricted by App\Models\AdminAuditEvent. Two triggers refuse every UPDATE and DELETE,
     * whatever the database user: retention is not decided by the owner yet, so no row may
     * be removed (docs/architecture/admin-dashboard.md, Audit). Pruning will arrive as a
     * reviewed migration that replaces the DELETE trigger with an age-bounded one.
     */
    public function up(): void
    {
        Schema::create('admin_audit_events', function (Blueprint $table) {
            $table->id();
            $table->timestamp('occurred_at', 6)->useCurrent()->index();
            $table->string('action', 64)->index();
            $table->string('actor_type', 16);
            // No foreign key: audit rows must outlive any change to users and never cascade.
            $table->unsignedBigInteger('actor_user_id')->nullable()->index();
            $table->string('subject_type', 32)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->json('metadata')->nullable();

            $table->index(['subject_type', 'subject_id']);
        });

        try {
            DB::unprepared(<<<'SQL'
                CREATE TRIGGER admin_audit_events_refuse_update BEFORE UPDATE ON admin_audit_events
                FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'admin_audit_events is append-only'
                SQL);
            DB::unprepared(<<<'SQL'
                CREATE TRIGGER admin_audit_events_refuse_delete BEFORE DELETE ON admin_audit_events
                FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'admin_audit_events is append-only'
                SQL);
        } catch (QueryException $exception) {
            Schema::dropIfExists('admin_audit_events');

            if (($exception->errorInfo[1] ?? null) === self::TRIGGER_PRIVILEGE_ERROR) {
                throw new RuntimeException(
                    'The migration user may not create triggers while binary logging is on. Set '
                    .'log_bin_trust_function_creators = ON on the MySQL server (backend/README.md, '
                    .'Audit triggers), then run the migration again.',
                    previous: $exception,
                );
            }

            throw $exception;
        }
    }

    /**
     * Reverse the migrations. Dropping the table drops its triggers.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_audit_events');
    }
};
