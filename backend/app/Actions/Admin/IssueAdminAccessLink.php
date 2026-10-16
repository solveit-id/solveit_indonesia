<?php

namespace App\Actions\Admin;

use App\Enums\AdminAccessLinkPurpose;
use App\Models\AdminAccessLink;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class IssueAdminAccessLink
{
    /**
     * Issue a single-use access link for an account and revoke every link of that account
     * that is still open (one live link per account, so an older copy stops working).
     *
     * The token travels in the URL fragment (#token=...), which browsers never send to a
     * server, so it cannot appear in access logs or Referer headers.
     */
    public function handle(User $user, AdminAccessLinkPurpose $purpose, int $ttlMinutes, ?User $issuer = null): IssuedAdminAccessLink
    {
        $token = AdminAccessLink::newToken();

        $link = DB::transaction(function () use ($user, $purpose, $ttlMinutes, $issuer, $token): AdminAccessLink {
            AdminAccessLink::query()
                ->where('user_id', $user->getKey())
                ->whereNull('completed_at')
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            $link = new AdminAccessLink;
            $link->forceFill([
                'user_id' => $user->getKey(),
                'purpose' => $purpose,
                'token_hash' => AdminAccessLink::hashToken($token),
                'created_by_user_id' => $issuer?->getKey(),
                'expires_at' => now()->addMinutes($ttlMinutes),
            ])->save();

            return $link;
        });

        $url = config('admin.url').config('admin.access_links.path').'#token='.$token;

        return new IssuedAdminAccessLink($link, $token, $url);
    }
}
