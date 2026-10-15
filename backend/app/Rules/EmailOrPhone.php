<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Translation\PotentiallyTranslatedString;

/**
 * Accepts the same contact formats as the website form (validateInquiry in
 * frontend/src/services/inquiry.ts): an email address, or a phone number that
 * starts with a digit (after an optional "+") followed by 7 to 16 digits,
 * spaces, or hyphens. The phone pattern allows plain spaces only, not tabs or newlines.
 */
class EmailOrPhone implements ValidationRule
{
    private const EMAIL = '/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u';

    private const PHONE = '/^\+?[0-9][0-9 \-]{7,16}$/';

    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || (preg_match(self::EMAIL, $value) !== 1 && preg_match(self::PHONE, $value) !== 1)) {
            $fail('The :attribute field must be a valid email address or phone number.');
        }
    }
}
