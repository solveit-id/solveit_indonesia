<?php

namespace App\Http\Resources;

use App\Enums\InquiryStatus;
use App\Models\Inquiry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public view of a stored inquiry: the reference and status only, never the
 * submitted personal data. Not wrapped in `data`, per the frontend contract.
 *
 * `status` is the receipt ("the server stored it"), always `received`, never the internal
 * workflow status (B4a): an idempotent retry after the team moved the inquiry must get the
 * same body as the first answer (B2.1), and the website treats any other value as an
 * uncertain outcome (B2.2).
 *
 * @mixin Inquiry
 */
class InquiryResource extends JsonResource
{
    /**
     * The "data" wrapper that should be applied.
     *
     * @var string|null
     */
    public static $wrap = null;

    /**
     * Transform the resource into an array.
     *
     * @return array{id: string, status: string}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->public_id,
            'status' => InquiryStatus::Received->value,
        ];
    }
}
