<?php

namespace App\Enums;

/**
 * Budget ranges shared with the frontend (`BudgetRange` in frontend/src/types/inquiry.ts).
 */
enum InquiryBudget: string
{
    case Undecided = 'belum-tahu';
    case Under10Million = 'di-bawah-10jt';
    case From10To50Million = '10-50jt';
    case From50To150Million = '50-150jt';
    case Over150Million = 'di-atas-150jt';
}
