<?php

namespace App\Actions\Admin;

use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Enums\AdminPermission;
use App\Models\AdminAuditEvent;
use App\Models\Inquiry;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

/**
 * Record that an account opens an inquiry's full contact
 * (/api/v1/admin/inquiries/{inquiry}/contact-reveal, B4a).
 */
class RevealInquiryContact
{
    public function __construct(private readonly RecordAdminAuditEvent $recordAuditEvent) {}

    /**
     * Every reveal is recorded first: the caller shows the contact only after this returns,
     * that is after the audit event committed. If the event cannot be written, the contact
     * is not shown. The event names the account and the inquiry, never the contact.
     *
     * @throws AuthorizationException when the actor lost the permission meanwhile.
     */
    public function handle(User $actor, Inquiry $inquiry): AdminAuditEvent
    {
        return DB::transaction(function () use ($actor, $inquiry): AdminAuditEvent {
            $actor = InquiryHandler::lockFor($actor, AdminPermission::RevealInquiryContacts);

            return $this->recordAuditEvent->handle(
                AdminAuditAction::InquiryContactRevealed,
                AdminActorType::User,
                actor: $actor,
                subject: $inquiry,
            );
        }, InquiryHandler::TRANSACTION_ATTEMPTS);
    }
}
