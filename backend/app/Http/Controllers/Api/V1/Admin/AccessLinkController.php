<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\CompleteAdminEnrollment;
use App\Actions\Admin\RecordAdminAuditEvent;
use App\Actions\Admin\RedeemAdminAccessLink;
use App\Enums\AdminAccessLinkPurpose;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Exceptions\InvalidAdminAccessLinkException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\ConfirmAdminEnrollmentRequest;
use App\Http\Requests\Api\V1\Admin\InspectAdminAccessLinkRequest;
use App\Http\Requests\Api\V1\Admin\RedeemAdminAccessLinkRequest;
use App\Http\Resources\Admin\AdminAccountResource;
use App\Models\AdminAccessLink;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Fortify;

/**
 * Pre-activation flow: inspect a link, redeem it (password, new TOTP secret), confirm the
 * first code. Nothing here grants admin permissions: the session holds only the pending
 * enrollment until the code is confirmed, and only then is the account signed in.
 */
class AccessLinkController extends Controller
{
    /**
     * Session key of the pending enrollment: link, account, and deadline.
     */
    public const PENDING_ENROLLMENT = 'admin.pending_enrollment';

    public function __construct(private readonly RecordAdminAuditEvent $recordAuditEvent) {}

    /**
     * What a link is for, without using it. The address is masked.
     */
    public function inspect(InspectAdminAccessLinkRequest $request): JsonResponse
    {
        $link = AdminAccessLink::query()
            ->with('user')
            ->where('token_hash', AdminAccessLink::hashToken($request->token()))
            ->first();

        if ($link === null || ! $link->isRedeemable() || $link->user === null || ! RedeemAdminAccessLink::accountFits($link, $link->user)) {
            throw new InvalidAdminAccessLinkException;
        }

        return response()->json(['data' => [
            'purpose' => $link->purpose->value,
            'email' => self::maskEmail($link->user->email),
            'requires_name' => $link->purpose === AdminAccessLinkPurpose::Activation,
            'expires_at' => $link->expires_at->toIso8601String(),
        ]]);
    }

    /**
     * Use the link: set the password and return the new authenticator secret, once.
     */
    public function redeem(RedeemAdminAccessLinkRequest $request, RedeemAdminAccessLink $redeemAccessLink): JsonResponse
    {
        try {
            $link = $redeemAccessLink->handle($request->token(), $request->credentials());
        } catch (InvalidAdminAccessLinkException $exception) {
            $this->recordAuditEvent->handle(AdminAuditAction::AccessLinkRejected, AdminActorType::Anonymous, metadata: ['reason' => 'redeem']);

            throw $exception;
        }

        $deadline = now()->addMinutes((int) config('admin.access_links.enrollment_ttl_minutes'));

        $request->session()->regenerate();
        $request->session()->put(self::PENDING_ENROLLMENT, [
            'link_id' => $link->getKey(),
            'user_id' => (int) $link->user_id,
            'expires_at' => $deadline->getTimestamp(),
        ]);

        /** @var User $user */
        $user = $link->user()->firstOrFail();

        return response()->json(['data' => [
            'two_factor' => [
                'qr_code_svg' => $user->twoFactorQrCodeSvg(),
                'setup_key' => Fortify::currentEncrypter()->decrypt($user->two_factor_secret),
            ],
            'confirm_before' => $deadline->toIso8601String(),
        ]]);
    }

    /**
     * Confirm the first code: activate (or restore) the account, sign it in, and return
     * the recovery codes. They are shown only in this response.
     */
    public function confirm(ConfirmAdminEnrollmentRequest $request, CompleteAdminEnrollment $completeEnrollment): JsonResponse
    {
        $pending = $request->session()->get(self::PENDING_ENROLLMENT);

        if (! is_array($pending) || ! is_int($pending['expires_at'] ?? null) || $pending['expires_at'] <= now()->getTimestamp()) {
            $request->session()->forget(self::PENDING_ENROLLMENT);
            $this->recordAuditEvent->handle(AdminAuditAction::AccessLinkRejected, AdminActorType::Anonymous, metadata: ['reason' => 'confirm']);

            throw new InvalidAdminAccessLinkException;
        }

        try {
            $result = $completeEnrollment->handle((int) $pending['link_id'], (int) $pending['user_id'], $request->code());
        } catch (ValidationException $exception) {
            $this->recordAuditEvent->handle(
                AdminAuditAction::TwoFactorEnrollmentFailed,
                AdminActorType::Anonymous,
                subject: User::query()->find((int) $pending['user_id']),
            );

            throw $exception;
        } catch (InvalidAdminAccessLinkException $exception) {
            $request->session()->forget(self::PENDING_ENROLLMENT);
            $this->recordAuditEvent->handle(AdminAuditAction::AccessLinkRejected, AdminActorType::Anonymous, metadata: ['reason' => 'confirm']);

            throw $exception;
        }

        $request->session()->forget(self::PENDING_ENROLLMENT);
        Auth::guard('web')->login($result['user']);
        $request->session()->regenerate();

        return response()->json(['data' => [
            'recovery_codes' => $result['recovery_codes'],
            'account' => (new AdminAccountResource($result['user']))->resolve($request),
        ]]);
    }

    /**
     * "r***@example.com": enough to recognise one's own address, not to read it out.
     */
    private static function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return Str::substr($local, 0, 1).'***@'.$domain;
    }
}
