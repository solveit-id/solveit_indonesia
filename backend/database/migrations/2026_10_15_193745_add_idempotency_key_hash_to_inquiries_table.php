<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * SHA-256 (hex) of the client's Idempotency-Key, never the key itself. The UNIQUE index is
     * what makes a retried submission safe under concurrency: a second insert with the same
     * hash waits for the first transaction and then fails, whatever the PHP workers do.
     * Nullable: requests without the header (and rows stored before B2.1) keep NULL, and
     * MySQL allows any number of NULLs in a UNIQUE index.
     */
    public function up(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            $table->char('idempotency_key_hash', 64)
                ->charset('ascii')
                ->collation('ascii_bin')
                ->nullable()
                ->after('public_id')
                ->unique();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inquiries', function (Blueprint $table) {
            $table->dropUnique(['idempotency_key_hash']);
            $table->dropColumn('idempotency_key_hash');
        });
    }
};
