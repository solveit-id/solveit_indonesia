<?php

namespace Tests\Unit\Enums;

use App\Enums\InquiryBudget;
use App\Enums\InquiryService;
use App\Enums\InquiryTimeline;
use BackedEnum;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The API accepts exactly the values the website sends. The frontend type
 * definitions are the source; these tests fail when either side drifts.
 * Skipped when the backend is used outside this repository.
 */
class FrontendContractTest extends TestCase
{
    /**
     * @param  class-string<BackedEnum>  $enum
     */
    #[DataProvider('contracts')]
    public function test_enum_matches_the_frontend_union_type(string $file, string $type, string $enum): void
    {
        $path = dirname(__DIR__, 4).'/frontend/src/types/'.$file;

        if (! is_file($path)) {
            $this->markTestSkipped("Frontend contract {$file} is not available.");
        }

        preg_match('/export type '.$type.' =([^;]+);/', (string) file_get_contents($path), $match);
        $this->assertNotEmpty($match, "Type {$type} was not found in {$file}.");
        preg_match_all('/"([^"]+)"/', $match[1], $literals);

        $this->assertSame($literals[1], array_column($enum::cases(), 'value'));
    }

    /**
     * @return array<string, array{string, string, class-string<BackedEnum>}>
     */
    public static function contracts(): array
    {
        return [
            'service' => ['content.ts', 'ServiceId', InquiryService::class],
            'budget' => ['inquiry.ts', 'BudgetRange', InquiryBudget::class],
            'timeline' => ['inquiry.ts', 'Timeline', InquiryTimeline::class],
        ];
    }
}
