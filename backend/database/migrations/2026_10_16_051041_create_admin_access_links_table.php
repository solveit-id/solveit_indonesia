<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * One-time links that let a person set a password and enrol TOTP: account activation
     * (owner bootstrap, later invitations) and credential reset. Only the SHA-256 of the
     * 256-bit token is stored, so a copy of this table cannot be redeemed. A link is
     * single use: redeemed_at is set once, completed_at when TOTP is confirmed.
     */
    public function up(): void
    {
        Schema::create('admin_access_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('purpose', 32);
            $table->char('token_hash', 64)->charset('ascii')->collation('ascii_bin')->unique();
            // NULL when issued from the command line (owner bootstrap, credential reset).
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('expires_at');
            $table->timestamp('redeemed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_access_links');
    }
};
