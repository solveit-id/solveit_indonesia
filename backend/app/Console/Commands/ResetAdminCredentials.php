<?php

namespace App\Console\Commands;

use App\Actions\Admin\ResetAdminCredentials as ResetAdminCredentialsAction;
use App\Enums\AdminActorType;
use App\Exceptions\AdminAccountStateException;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;

/**
 * Break-glass recovery on the server shell, for example an owner who lost both the
 * authenticator and the recovery codes.
 */
class ResetAdminCredentials extends Command
{
    use ConfirmableTrait;

    /**
     * @var string
     */
    protected $signature = 'admin:reset-credentials
        {email : Address of the admin account}
        {--force : Skip the confirmation prompt in production}';

    /**
     * @var string
     */
    protected $description = 'Remove an admin account\'s authenticator, end its sessions, and print a one-time credential-reset link';

    public function handle(ResetAdminCredentialsAction $resetCredentials): int
    {
        $user = User::query()->where('email', mb_strtolower(trim((string) $this->argument('email'))))->first();

        if ($user === null) {
            $this->components->error('No admin account has this address.');

            return self::FAILURE;
        }

        if (! $this->confirmToProceed('This signs the account out everywhere and removes its authenticator.')) {
            return self::FAILURE;
        }

        try {
            $issued = $resetCredentials->handle($user, AdminActorType::Cli, (int) config('admin.access_links.cli_ttl_minutes'));
        } catch (AdminAccountStateException $exception) {
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->components->info('Sessions ended and authenticator removed. The account can sign in again after the reset.');
        $this->line('Credential-reset link (single use, valid until '.$issued->link->expires_at->toIso8601String().'):');
        $this->newLine();
        $this->line($issued->url);
        $this->newLine();
        $this->components->warn('Give it to the account holder through a trusted channel. It is not stored and is never shown again.');

        return self::SUCCESS;
    }
}
