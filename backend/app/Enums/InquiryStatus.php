<?php

namespace App\Enums;

/**
 * Lifecycle of a stored inquiry. Only `received` exists until the admin phase defines review states.
 */
enum InquiryStatus: string
{
    case Received = 'received';
}
