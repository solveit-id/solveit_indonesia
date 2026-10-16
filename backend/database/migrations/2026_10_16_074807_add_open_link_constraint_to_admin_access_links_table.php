<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * One open access link per account, enforced by MySQL instead of by a read before the
     * insert (B3.1b). A link is open until it is completed or revoked; issuing a new one
     * revokes the open one first (App\Actions\Admin\IssueAdminAccessLink). The generated
     * column holds the account ID only while the link is open, and its UNIQUE index lets
     * at most one such row exist per account, so two concurrent issuances cannot both
     * commit an open link. Additive: existing rows already satisfy it.
     */
    public function up(): void
    {
        Schema::table('admin_access_links', function (Blueprint $table) {
            $table->unsignedBigInteger('open_for_user_id')
                ->nullable()
                ->storedAs('if(`completed_at` is null and `revoked_at` is null, `user_id`, null)')
                ->after('revoked_at');

            $table->unique('open_for_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('admin_access_links', function (Blueprint $table) {
            $table->dropUnique(['open_for_user_id']);
            $table->dropColumn('open_for_user_id');
        });
    }
};
