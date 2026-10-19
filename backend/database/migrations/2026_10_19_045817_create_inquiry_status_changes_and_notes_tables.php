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
     * Append-only tables of this migration.
     */
    private const APPEND_ONLY_TABLES = ['inquiry_status_changes', 'inquiry_notes'];

    /**
     * Run the migrations.
     *
     * Inquiry management (B4a): the status history and the internal notes of an inquiry.
     * Both are append-only for every database user (a correction is a new note or a new
     * status change), refused by BEFORE UPDATE and BEFORE DELETE triggers. MySQL does not
     * fire triggers for foreign key actions, so deleting the inquiry itself still removes
     * its history and notes (ON DELETE CASCADE): erasure and retention, once the owner
     * decides them, remove an inquiry with everything written about it. Neither table
     * holds a copy of the submitted fields. Authors reference users without cascading;
     * accounts are never deleted.
     */
    public function up(): void
    {
        Schema::create('inquiry_status_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inquiry_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 32);
            $table->string('to_status', 32);
            $table->foreignId('changed_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at', 6)->useCurrent();
        });

        Schema::create('inquiry_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inquiry_id')->constrained()->cascadeOnDelete();
            $table->foreignId('author_user_id')->constrained('users')->restrictOnDelete();
            $table->text('body');
            $table->timestamp('created_at', 6)->useCurrent();
        });

        try {
            foreach (self::APPEND_ONLY_TABLES as $table) {
                foreach (['UPDATE' => 'update', 'DELETE' => 'delete'] as $event => $suffix) {
                    DB::unprepared(<<<SQL
                        CREATE TRIGGER {$table}_refuse_{$suffix} BEFORE {$event} ON {$table}
                        FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$table} is append-only'
                        SQL);
                }
            }
        } catch (QueryException $exception) {
            $this->down();

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
     * Reverse the migrations. Dropping a table drops its triggers.
     */
    public function down(): void
    {
        Schema::dropIfExists('inquiry_notes');
        Schema::dropIfExists('inquiry_status_changes');
    }
};
