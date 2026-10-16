<?php

namespace App\Http\Resources\Admin;

use App\Services\AdminSessionStore;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * One session of the signed-in account. The session ID itself is never exposed: the
 * `id` is a keyed handle (App\Services\AdminSessionStore::handleFor).
 *
 * @property-read object{id: string, ip_address: ?string, user_agent: ?string, last_activity: int} $resource
 */
class AdminSessionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array{id: string, current: bool, ip_address: ?string, user_agent: ?string, last_active_at: string}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => app(AdminSessionStore::class)->handleFor($this->resource->id),
            'current' => hash_equals($this->resource->id, $request->session()->getId()),
            'ip_address' => $this->resource->ip_address,
            'user_agent' => $this->resource->user_agent === null ? null : Str::limit($this->resource->user_agent, 252),
            'last_active_at' => Carbon::createFromTimestamp($this->resource->last_activity)->toIso8601String(),
        ];
    }
}
