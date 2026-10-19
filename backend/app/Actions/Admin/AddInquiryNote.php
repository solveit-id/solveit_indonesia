<?php

namespace App\Actions\Admin;

use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Enums\AdminPermission;
use App\Exceptions\InquiryNoteNotStoredException;
use App\Models\Inquiry;
use App\Models\InquiryNote;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Add an internal note to an inquiry (/api/v1/admin/inquiries/{inquiry}/notes, B4a).
 */
class AddInquiryNote
{
    public function __construct(private readonly RecordAdminAuditEvent $recordAuditEvent) {}

    /**
     * The note and its audit event (which carries the note ID, never the body) commit
     * together. A database failure surfaces without the SQL bindings, which hold the body.
     *
     * @throws AuthorizationException when the actor lost the permission meanwhile.
     * @throws InquiryNoteNotStoredException when the database does not store the note.
     */
    public function handle(User $actor, Inquiry $inquiry, string $body): InquiryNote
    {
        try {
            return DB::transaction(function () use ($actor, $inquiry, $body): InquiryNote {
                $actor = InquiryHandler::lockFor($actor, AdminPermission::AddInquiryNotes);

                $note = new InquiryNote;
                $note->forceFill([
                    'inquiry_id' => $inquiry->getKey(),
                    'author_user_id' => $actor->getKey(),
                    'body' => $body,
                ])->save();

                $this->recordAuditEvent->handle(
                    AdminAuditAction::InquiryNoteAdded,
                    AdminActorType::User,
                    actor: $actor,
                    subject: $inquiry,
                    metadata: ['note_id' => $note->getKey()],
                );

                return $note->setRelation('author', $actor);
            }, InquiryHandler::TRANSACTION_ATTEMPTS);
        } catch (QueryException $exception) {
            throw InquiryNoteNotStoredException::fromQueryException($exception);
        }
    }
}
