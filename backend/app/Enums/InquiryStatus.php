<?php

namespace App\Enums;

/**
 * Workflow status of a stored inquiry, set by the admin team (B4a). Internal: the public
 * receipt of POST /api/v1/inquiries always says `received`, whatever the workflow status
 * is now (App\Http\Resources\InquiryResource). Values are stable identifiers; never rename
 * one that has been stored.
 */
enum InquiryStatus: string
{
    /** New: stored from the website, nobody has worked on it yet. */
    case Received = 'received';

    /** Someone on the team is reviewing it. */
    case InReview = 'in-review';

    /** The team has reached the person who sent it. */
    case Contacted = 'contacted';

    /** Nothing more to do (answered, not a fit, or spam). Can be reopened for review. */
    case Closed = 'closed';

    /**
     * Statuses this one may change to. Nothing returns to `received`: once someone has
     * worked on an inquiry it is no longer new.
     *
     * @return list<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Received => [self::InReview, self::Contacted, self::Closed],
            self::InReview => [self::Contacted, self::Closed],
            self::Contacted => [self::InReview, self::Closed],
            self::Closed => [self::InReview],
        };
    }

    public function canChangeTo(self $status): bool
    {
        return in_array($status, $this->allowedTransitions(), true);
    }
}
