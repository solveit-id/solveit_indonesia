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
     * Inquiry management (B4a). Two additive indexes for the admin list filters (`status`
     * already has one; InnoDB appends the primary key to every secondary index, so each
     * serves "filter, newest first by id"). And a trigger that keeps what the visitor sent
     * exactly as stored, for every database user: the B2.1 idempotency check compares a
     * retry with these columns, and the admin may change only the workflow status. The
     * comparison is binary, so a change of letter case is refused too (the table collation
     * is case-insensitive). Deleting a row stays possible; retention is an owner decision.
     */
    public function up(): void
    {
        try {
            DB::unprepared(<<<'SQL'
                CREATE TRIGGER inquiries_keep_submission BEFORE UPDATE ON inquiries
                FOR EACH ROW
                BEGIN
                    IF NOT (CAST(OLD.public_id AS BINARY) <=> CAST(NEW.public_id AS BINARY))
                        OR NOT (CAST(OLD.idempotency_key_hash AS BINARY) <=> CAST(NEW.idempotency_key_hash AS BINARY))
                        OR NOT (CAST(OLD.name AS BINARY) <=> CAST(NEW.name AS BINARY))
                        OR NOT (CAST(OLD.organization AS BINARY) <=> CAST(NEW.organization AS BINARY))
                        OR NOT (CAST(OLD.contact AS BINARY) <=> CAST(NEW.contact AS BINARY))
                        OR NOT (CAST(OLD.service AS BINARY) <=> CAST(NEW.service AS BINARY))
                        OR NOT (CAST(OLD.budget AS BINARY) <=> CAST(NEW.budget AS BINARY))
                        OR NOT (CAST(OLD.timeline AS BINARY) <=> CAST(NEW.timeline AS BINARY))
                        OR NOT (CAST(OLD.message AS BINARY) <=> CAST(NEW.message AS BINARY))
                        OR NOT (OLD.created_at <=> NEW.created_at)
                    THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'inquiries keep the submitted fields unchanged';
                    END IF;
                END
                SQL);
        } catch (QueryException $exception) {
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

        Schema::table('inquiries', function (Blueprint $table) {
            $table->index('service');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            $table->dropIndex(['service']);
            $table->dropIndex(['created_at']);
        });

        DB::unprepared('DROP TRIGGER IF EXISTS inquiries_keep_submission');
    }
};
