<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Admin identity state (B3.1a). An account may sign in only when it has a role, is
     * activated (password set and TOTP confirmed through an access link), and is not
     * suspended: see App\Models\User::canSignInToAdmin(). A NULL role grants nothing.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 16)->nullable()->after('email')->index();
            $table->timestamp('activated_at')->nullable()->after('two_factor_confirmed_at');
            $table->timestamp('suspended_at')->nullable()->after('activated_at');
            $table->timestamp('last_login_at')->nullable()->after('suspended_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role']);
            $table->dropColumn(['role', 'activated_at', 'suspended_at', 'last_login_at']);
        });
    }
};
