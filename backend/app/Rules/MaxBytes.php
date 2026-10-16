<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Limits a string by its UTF-8 byte length. bcrypt uses only the first 72 bytes of a
 * password, so a longer one would be silently truncated; refusing it is honest.
 */
class MaxBytes implements ValidationRule
{
    public function __construct(private readonly int $bytes) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (is_string($value) && strlen($value) > $this->bytes) {
            $fail("The :attribute may not be longer than {$this->bytes} bytes.");
        }
    }
}
