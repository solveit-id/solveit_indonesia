<?php

namespace App\Enums;

/**
 * Timelines shared with the frontend (`Timeline` in frontend/src/types/inquiry.ts).
 */
enum InquiryTimeline: string
{
    case Flexible = 'fleksibel';
    case OneToThreeMonths = '1-3-bulan';
    case Urgent = 'segera';
}
