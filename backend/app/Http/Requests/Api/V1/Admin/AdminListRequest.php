<?php

namespace App\Http\Requests\Api\V1\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Pagination\Cursor;
use Illuminate\Validation\Validator;
use UnexpectedValueException;

/**
 * Query string of an owner list: allowlisted filters, a bounded page size, and an opaque
 * cursor. Unknown parameters are refused instead of ignored, so a misspelled filter never
 * silently returns everything. Lists are ordered by `id` only; a cursor must point at an
 * `id`, otherwise it is refused (422) instead of failing inside the paginator.
 */
abstract class AdminListRequest extends FormRequest
{
    /**
     * Filter rules of the concrete list.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    abstract protected function filterRules(): array;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...$this->filterRules(),
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:'.(int) config('admin.pagination.max_per_page')],
            'cursor' => ['sometimes', 'string', 'max:512'],
        ];
    }

    /**
     * @return array<int, \Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach (array_diff(array_keys($this->query()), array_keys($this->rules())) as $parameter) {
                    $validator->errors()->add((string) $parameter, 'This query parameter is not supported.');
                }

                $cursor = $this->query('cursor');

                if (is_string($cursor) && ! self::isValidCursor($cursor)) {
                    $validator->errors()->add('cursor', 'The cursor is invalid.');
                }
            },
        ];
    }

    public function perPage(): int
    {
        return (int) ($this->validated('per_page') ?? config('admin.pagination.default_per_page'));
    }

    private static function isValidCursor(string $encoded): bool
    {
        $cursor = Cursor::fromEncoded($encoded);

        if ($cursor === null || count($cursor->toArray()) !== 2) {
            return false;
        }

        try {
            return is_int($cursor->parameter('id'));
        } catch (UnexpectedValueException) {
            return false;
        }
    }
}
