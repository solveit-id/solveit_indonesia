<?php

namespace Database\Factories;

use App\Enums\InquiryBudget;
use App\Enums\InquiryService;
use App\Enums\InquiryStatus;
use App\Enums\InquiryTimeline;
use App\Models\Inquiry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Test data only. Never seed generated inquiries into a shared database.
 *
 * @extends Factory<Inquiry>
 */
class InquiryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'public_id' => Inquiry::newPublicId(),
            'name' => fake()->name(),
            'organization' => fake()->optional()->company(),
            'contact' => fake()->safeEmail(),
            'service' => fake()->randomElement(InquiryService::cases()),
            'budget' => fake()->randomElement(InquiryBudget::cases()),
            'timeline' => fake()->randomElement(InquiryTimeline::cases()),
            'message' => fake()->paragraph(3),
            'status' => InquiryStatus::Received,
        ];
    }
}
