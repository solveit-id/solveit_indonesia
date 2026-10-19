<?php

namespace App\Actions\Admin;

use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Enums\AdminPermission;
use App\Enums\InquiryStatus;
use App\Exceptions\InquiryStateException;
use App\Models\Inquiry;
use App\Models\InquiryStatusChange;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

/**
 * Move an inquiry through the status workflow (/api/v1/admin/inquiries/{inquiry}/status, B4a).
 */
class ChangeInquiryStatus
{
    public function __construct(private readonly RecordAdminAuditEvent $recordAuditEvent) {}

    /**
     * Compare and set under a row lock: the caller names the status it read
     * ($expected), so two people acting on the same inquiry cannot overwrite each other's
     * change unseen. The status, its history row, and its audit event commit together or
     * not at all. Asking for the status the inquiry already has changes nothing (also when
     * someone else set it), so a retry of a change that did apply is harmless.
     *
     * @throws AuthorizationException when the actor lost the permission meanwhile.
     * @throws InquiryStateException when the status changed since it was read, or the
     *                               workflow does not allow the change.
     */
    public function handle(User $actor, Inquiry $inquiry, InquiryStatus $status, InquiryStatus $expected): Inquiry
    {
        return DB::transaction(function () use ($actor, $inquiry, $status, $expected): Inquiry {
            $actor = InquiryHandler::lockFor($actor, AdminPermission::ChangeInquiryStatuses);
            $inquiry = Inquiry::query()->whereKey($inquiry->getKey())->lockForUpdate()->firstOrFail();
            $from = $inquiry->status;

            if ($from === $status) {
                return $inquiry;
            }

            if ($from !== $expected) {
                throw InquiryStateException::statusChanged();
            }

            if (! $from->canChangeTo($status)) {
                throw InquiryStateException::transitionNotAllowed();
            }

            $inquiry->status = $status;
            $inquiry->save();

            $change = new InquiryStatusChange;
            $change->forceFill([
                'inquiry_id' => $inquiry->getKey(),
                'from_status' => $from,
                'to_status' => $status,
                'changed_by_user_id' => $actor->getKey(),
            ])->save();

            $this->recordAuditEvent->handle(
                AdminAuditAction::InquiryStatusChanged,
                AdminActorType::User,
                actor: $actor,
                subject: $inquiry,
                metadata: ['from_status' => $from->value, 'to_status' => $status->value],
            );

            return $inquiry;
        }, InquiryHandler::TRANSACTION_ATTEMPTS);
    }
}
