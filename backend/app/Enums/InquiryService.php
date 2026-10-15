<?php

namespace App\Enums;

/**
 * Service identifiers shared with the frontend (`ServiceId` in frontend/src/types/content.ts).
 */
enum InquiryService: string
{
    case Website = 'website';
    case WebApplication = 'aplikasi-web';
    case InformationSystem = 'sistem-informasi';
    case CustomSoftware = 'custom-software';
    case TechnicalSupport = 'dukungan-teknis';
}
