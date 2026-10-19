<?php

/*
 * Synthetic data for the local team demo (B5a, docs/development/cloudflare-demo.md). Piped by
 * infra/docker/scripts/manage-demo.sh into `php` inside the demo's backend container, after the
 * demo guard accepted the stack. It is not part of any image, migration, or API.
 *
 * Everything goes through the application's own actions, so the rows are what the real API
 * writes: SubmitInquiry (with a fixed Idempotency-Key per fixture, which makes a second run a
 * replay instead of a duplicate), ChangeInquiryStatus, AddInquiryNote, and
 * RevealInquiryContact, each recording its own audit event. Only steps that are missing are
 * applied, so the script is idempotent and never changes what the demo audience did.
 *
 * The acting account is the synthetic persona "Operator Demo" (role admin), created here with a
 * random password and a random authenticator secret that are never printed or stored anywhere
 * else, so nobody can sign in as it. Every name, organisation, address, and message is
 * fictitious and labelled as demo data; contacts use the reserved example.test domain.
 * Timestamps are spread over the past days (relative to the first run) so the list, filters,
 * and history look like a working inbox.
 */

declare(strict_types=1);

use App\Actions\Admin\AddInquiryNote;
use App\Actions\Admin\ChangeInquiryStatus;
use App\Actions\Admin\RevealInquiryContact;
use App\Actions\SubmitInquiry;
use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Enums\InquiryStatus;
use App\Http\Requests\Api\V1\StoreInquiryRequest;
use App\Models\AdminAuditEvent;
use App\Models\Inquiry;
use App\Models\InquiryNote;
use App\Models\InquiryStatusChange;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\RecoveryCode;

require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

function refuse(string $reason): never
{
    fwrite(STDERR, "REFUSED: {$reason}\n");
    exit(1);
}

function line(string $text): void
{
    echo "SEED   {$text}\n";
}

// --- the same preconditions as the demo guard, checked again from inside ------------------------
$project = (string) getenv('SOLVEIT_DEMO');
if (preg_match('/^solveit-demo(-[a-z0-9]+)?$/', $project) !== 1) {
    refuse('this container is not a demo backend (SOLVEIT_DEMO is not set to a demo project)');
}
$adminUrl = (string) config('admin.url');
$demoOrigin = '~^https://([a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com|admin\.'.preg_quote($project, '~').'\.localhost:[0-9]{2,5})$~';
if (preg_match($demoOrigin, $adminUrl) !== 1) {
    refuse("ADMIN_URL {$adminUrl} is not a demo origin");
}
if (config('database.default') !== 'mysql' || config('database.connections.mysql.host') !== 'mysql') {
    refuse('the database is not the demo stack\'s own mysql service');
}
$foreign = User::query()->where('email', 'not like', '%@example.test')->count()
    + Inquiry::query()->where('contact', 'not like', '%@example.test')->count();
if ($foreign > 0) {
    refuse("the database holds {$foreign} non-synthetic account or inquiry row(s); nothing was seeded");
}

// The console request Laravel builds for a CLI process claims REMOTE_ADDR 127.0.0.1 and the user
// agent "Symfony". The seeded audit events say what they are instead: no address, and a user
// agent naming this seed, so the audit screen shows they are demo data.
request()->server->remove('REMOTE_ADDR');
request()->headers->set('User-Agent', 'Solveit demo seed (data sintetis)');
// The application logs every stored inquiry at info level to stderr; this run shows its own
// summary instead. Warnings and errors still reach the terminal.
config(['logging.channels.stderr.level' => 'warning']);

$now = CarbonImmutable::now();
$at = static function (int $minutesAgo) use ($now): void {
    Carbon::setTestNow($now->subMinutes($minutesAgo));
};

// --- the persona that acts in the seeded history ----------------------------------------------
$operator = User::query()->where('email', 'operator.demo@example.test')->first();
if ($operator === null) {
    $at(60 * 24 * 12);
    $operator = new User;
    $operator->forceFill([
        'name' => 'Operator Demo (persona contoh)',
        'email' => 'operator.demo@example.test',
        'password' => Str::random(64),
        'role' => AdminRole::Admin,
        'activated_at' => now(),
        'two_factor_secret' => Fortify::currentEncrypter()->encrypt(app(TwoFactorAuthenticationProvider::class)->generateSecretKey()),
        'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt(json_encode(array_map(fn () => RecoveryCode::generate(), range(1, 8)))),
        'two_factor_confirmed_at' => now(),
    ])->save();
    line('persona Operator Demo (admin, kredensial acak yang tidak diketahui siapa pun) dibuat');
} else {
    line('persona Operator Demo sudah ada');
}

// --- fixtures: what was submitted, and what happened to it afterwards --------------------------
// status: target path from `received`; notes and the reveal are placed after the step index given.
$fixtures = [
    [
        'key' => '6a1c5e2e-1f0b-4d6a-9c51-0d3e00000001',
        'minutes_ago' => 35,
        'fields' => [
            'name' => 'Contoh Pengirim Satu',
            'organization' => 'PT Contoh Fiktif Nusantara (data demo)',
            'contact' => 'pengirim.satu@example.test',
            'service' => 'website',
            'budget' => '10-50jt',
            'timeline' => '1-3-bulan',
            'message' => "[DATA DEMO SINTETIS] Kami ingin website profil perusahaan dalam dua bahasa, dengan halaman layanan, portofolio, dan formulir kontak.\n\nIni contoh untuk presentasi, bukan permintaan nyata.",
        ],
        'steps' => [],
    ],
    [
        'key' => '6a1c5e2e-1f0b-4d6a-9c51-0d3e00000002',
        'minutes_ago' => 60 * 4,
        'fields' => [
            'name' => 'Contoh Pengirim Dua',
            'organization' => null,
            'contact' => 'pengirim.dua@example.test',
            'service' => 'dukungan-teknis',
            'budget' => 'belum-tahu',
            'timeline' => 'segera',
            'message' => '[DATA DEMO SINTETIS] Website kami sering lambat di jam sibuk. Kami butuh pemeriksaan teknis dan saran perbaikan. Ini contoh untuk presentasi.',
        ],
        'steps' => [],
    ],
    [
        'key' => '6a1c5e2e-1f0b-4d6a-9c51-0d3e00000003',
        'minutes_ago' => 60 * 26,
        'fields' => [
            'name' => 'Contoh Pengirim Tiga',
            'organization' => 'Koperasi Contoh Sejahtera (data demo)',
            'contact' => 'pengirim.tiga@example.test',
            'service' => 'aplikasi-web',
            'budget' => '50-150jt',
            'timeline' => '1-3-bulan',
            'message' => "[DATA DEMO SINTETIS] Kami ingin aplikasi web untuk anggota koperasi: data anggota, simpanan, dan laporan bulanan untuk pengurus.\n\nIni contoh untuk presentasi, bukan permintaan nyata.",
        ],
        'steps' => [
            ['to' => 'in-review', 'minutes_ago' => 60 * 22],
            ['note' => 'Kebutuhan sudah dibaca. Perlu sesi diskusi untuk modul simpanan dan laporan. (catatan demo)', 'minutes_ago' => 60 * 21],
        ],
    ],
    [
        'key' => '6a1c5e2e-1f0b-4d6a-9c51-0d3e00000004',
        'minutes_ago' => 60 * 24 * 3,
        'fields' => [
            'name' => 'Contoh Pengirim Empat',
            'organization' => 'Yayasan Contoh Pendidikan (data demo)',
            'contact' => 'pengirim.empat@example.test',
            'service' => 'sistem-informasi',
            'budget' => 'di-atas-150jt',
            'timeline' => '1-3-bulan',
            'message' => "[DATA DEMO SINTETIS] Kami membutuhkan sistem informasi sekolah untuk pendaftaran siswa baru, nilai, dan komunikasi dengan orang tua.\n\nIni contoh untuk presentasi, bukan permintaan nyata.",
        ],
        'steps' => [
            ['to' => 'in-review', 'minutes_ago' => 60 * 68],
            ['reveal' => true, 'minutes_ago' => 60 * 67],
            ['note' => 'Kontak dibuka untuk menjadwalkan panggilan pertama. (catatan demo)', 'minutes_ago' => 60 * 67 - 5],
            ['to' => 'contacted', 'minutes_ago' => 60 * 66],
            ['note' => 'Panggilan pertama selesai. Menunggu dokumen kebutuhan dari pengirim. (catatan demo)', 'minutes_ago' => 60 * 65],
        ],
    ],
    [
        'key' => '6a1c5e2e-1f0b-4d6a-9c51-0d3e00000005',
        'minutes_ago' => 60 * 24 * 6,
        'fields' => [
            'name' => 'Contoh Pengirim Lima',
            'organization' => 'CV Contoh Kreatif (data demo)',
            'contact' => 'pengirim.lima@example.test',
            'service' => 'custom-software',
            'budget' => 'di-bawah-10jt',
            'timeline' => 'fleksibel',
            'message' => '[DATA DEMO SINTETIS] Kami ingin aplikasi kecil untuk mencatat pesanan harian. Ini contoh untuk presentasi, bukan permintaan nyata.',
        ],
        'steps' => [
            ['to' => 'in-review', 'minutes_ago' => 60 * 140],
            ['reveal' => true, 'minutes_ago' => 60 * 139],
            ['to' => 'contacted', 'minutes_ago' => 60 * 138],
            ['note' => 'Sudah dijelaskan bahwa kebutuhan ini cukup dengan aplikasi siap pakai. (catatan demo)', 'minutes_ago' => 60 * 120],
            ['to' => 'closed', 'minutes_ago' => 60 * 119],
        ],
    ],
    [
        'key' => '6a1c5e2e-1f0b-4d6a-9c51-0d3e00000006',
        'minutes_ago' => 60 * 24 * 9,
        'fields' => [
            'name' => 'Contoh Pengirim Enam',
            'organization' => 'Klinik Contoh Sehat (data demo)',
            'contact' => 'pengirim.enam@example.test',
            'service' => 'website',
            'budget' => '10-50jt',
            'timeline' => 'fleksibel',
            'message' => "[DATA DEMO SINTETIS] Kami ingin memperbarui website klinik dengan jadwal dokter dan informasi layanan.\n\nIni contoh untuk presentasi, bukan permintaan nyata.",
        ],
        'steps' => [
            ['to' => 'in-review', 'minutes_ago' => 60 * 210],
            ['note' => 'Belum ada jawaban setelah dua kali dihubungi lewat kanal resmi. (catatan demo)', 'minutes_ago' => 60 * 190],
            ['to' => 'closed', 'minutes_ago' => 60 * 189],
            ['to' => 'in-review', 'minutes_ago' => 60 * 20],
            ['note' => 'Dibuka kembali: pengirim menghubungi ulang dan masih membutuhkan website. (catatan demo)', 'minutes_ago' => 60 * 20 - 3],
        ],
    ],
];

// The console lists inquiries newest first by their ID (Laravel's cursor), so the oldest fixture
// is stored first: list order and received dates then agree.
usort($fixtures, fn (array $a, array $b): int => $b['minutes_ago'] <=> $a['minutes_ago']);

$rules = (new StoreInquiryRequest)->rules();
$submit = app(SubmitInquiry::class);
$changeStatus = app(ChangeInquiryStatus::class);
$addNote = app(AddInquiryNote::class);
$reveal = app(RevealInquiryContact::class);
$created = ['inquiries' => 0, 'status' => 0, 'notes' => 0, 'reveals' => 0];
$skipped = [];

try {
    foreach ($fixtures as $fixture) {
        $fields = $fixture['fields'];
        $validator = Validator::make($fields, $rules);
        if ($validator->fails()) {
            refuse('fixture '.$fixture['key'].' fails the public validation: '.implode(' ', $validator->errors()->all()));
        }

        // A first run stores it; later runs are idempotent replays of the same submission.
        $at($fixture['minutes_ago']);
        $inquiry = $submit->handle($validator->validated(), $fixture['key']);
        if ($inquiry->wasRecentlyCreated) {
            $created['inquiries']++;
        }
        $reference = $inquiry->public_id;

        $statusSteps = array_values(array_filter($fixture['steps'], fn (array $step) => isset($step['to'])));
        $done = InquiryStatusChange::query()->where('inquiry_id', $inquiry->getKey())->count();
        $statusIndex = 0;

        foreach ($fixture['steps'] as $step) {
            if (isset($step['to'])) {
                $statusIndex++;
                if ($statusIndex <= $done) {
                    continue;
                }
                $inquiry->refresh();
                $from = $statusIndex === 1 ? InquiryStatus::Received : InquiryStatus::from($statusSteps[$statusIndex - 2]['to']);
                if ($inquiry->status !== $from) {
                    $skipped[] = "{$reference}: status sudah diubah di konsol, riwayat contoh tidak dilanjutkan";
                    break;
                }
                if (! $operator->refresh()->canSignInToAdmin()) {
                    $skipped[] = "{$reference}: persona tidak aktif, riwayat contoh tidak dilanjutkan";
                    break;
                }
                $at($step['minutes_ago']);
                $changeStatus->handle($operator, $inquiry, InquiryStatus::from($step['to']), $from);
                $created['status']++;
            } elseif (isset($step['note'])) {
                if (InquiryNote::query()->where('inquiry_id', $inquiry->getKey())->where('body', $step['note'])->exists()) {
                    continue;
                }
                if (! $operator->refresh()->canSignInToAdmin()) {
                    continue;
                }
                $at($step['minutes_ago']);
                $addNote->handle($operator, $inquiry, $step['note']);
                $created['notes']++;
            } elseif (isset($step['reveal'])) {
                $revealed = AdminAuditEvent::query()
                    ->where('action', AdminAuditAction::InquiryContactRevealed)
                    ->where('subject_type', 'inquiry')
                    ->where('subject_id', $inquiry->getKey())
                    ->where('actor_user_id', $operator->getKey())
                    ->exists();
                if ($revealed || ! $operator->refresh()->canSignInToAdmin()) {
                    continue;
                }
                $at($step['minutes_ago']);
                $reveal->handle($operator, $inquiry);
                $created['reveals']++;
            }
        }

        line(sprintf('%s %s', $reference, $inquiry->refresh()->status->value));
    }
} finally {
    Carbon::setTestNow();
}

foreach ($skipped as $reason) {
    line("dilewati: {$reason}");
}
line(sprintf(
    'ditambahkan: %d inquiry, %d perubahan status, %d catatan, %d pembukaan kontak (0 berarti sudah lengkap)',
    $created['inquiries'],
    $created['status'],
    $created['notes'],
    $created['reveals'],
));
