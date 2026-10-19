<?php

namespace Tests\Unit\Enums;

use App\Enums\InquiryStatus;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class InquiryStatusTest extends TestCase
{
    public function test_the_workflow_statuses_are_stable(): void
    {
        $this->assertSame(
            ['received', 'in-review', 'contacted', 'closed'],
            array_map(fn (InquiryStatus $status): string => $status->value, InquiryStatus::cases()),
        );
    }

    /**
     * The complete transition matrix (B4a). Every pair of statuses is listed, so a change
     * to the workflow fails here until it is reviewed.
     *
     * @return array<string, array{InquiryStatus, InquiryStatus, bool}>
     */
    public static function transitions(): array
    {
        $allowed = [
            'received' => ['in-review', 'contacted', 'closed'],
            'in-review' => ['contacted', 'closed'],
            'contacted' => ['in-review', 'closed'],
            'closed' => ['in-review'],
        ];

        $cases = [];

        foreach (InquiryStatus::cases() as $from) {
            foreach (InquiryStatus::cases() as $to) {
                $cases["{$from->value} to {$to->value}"] = [$from, $to, in_array($to->value, $allowed[$from->value], true)];
            }
        }

        return $cases;
    }

    #[DataProvider('transitions')]
    public function test_the_transition_matrix(InquiryStatus $from, InquiryStatus $to, bool $allowed): void
    {
        $this->assertSame($allowed, $from->canChangeTo($to));
    }

    public function test_nothing_returns_to_received_or_stays_in_place(): void
    {
        foreach (InquiryStatus::cases() as $status) {
            $this->assertNotContains(InquiryStatus::Received, $status->allowedTransitions());
            $this->assertNotContains($status, $status->allowedTransitions());
        }
    }
}
