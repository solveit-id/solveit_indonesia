<?php

namespace App\Console\Commands;

use App\Actions\Admin\BootstrapAdminOwner as BootstrapAdminOwnerAction;
use App\Actions\Admin\RecordAdminAuditEvent;
use App\Console\Commands\Concerns\ConfirmsInProduction;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Exceptions\OwnerBootstrapRefusedException;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Create the first owner account on the server shell. The only way an account comes into
 * existence before an owner can invite others; there is no default account or password.
 */
class BootstrapAdminOwner extends Command
{
    use ConfirmsInProduction;

    /**
     * @var string
     */
    protected $signature = 'admin:bootstrap-owner
        {email : Address of the person who becomes the first owner}
        {--force : Skip the confirmation prompt in production}';

    /**
     * @var string
     */
    protected $description = 'Create the first admin owner and print a one-time activation link';

    public function handle(BootstrapAdminOwnerAction $bootstrapOwner, RecordAdminAuditEvent $recordAuditEvent): int
    {
        $email = (string) $this->argument('email');

        if (Validator::make(['email' => $email], ['email' => ['required', 'email', 'max:254']])->fails()) {
            $this->components->error('Give a valid email address.');

            return self::INVALID;
        }

        if (! $this->confirmedForProduction('This creates the first admin owner.')) {
            return self::FAILURE;
        }

        try {
            $issued = $bootstrapOwner->handle($email);
        } catch (OwnerBootstrapRefusedException $exception) {
            $recordAuditEvent->handle(AdminAuditAction::OwnerBootstrapRefused, AdminActorType::Cli, metadata: ['reason' => $exception->reason]);
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->components->info('Owner account created. It can sign in only after activation.');
        $this->line('Activation link (single use, valid until '.$issued->link->expires_at->toIso8601String().'):');
        $this->newLine();
        $this->line($issued->url);
        $this->newLine();
        $this->components->warn('Give it to the owner through a trusted channel. It is not stored and is never shown again; run this command again for a new link.');

        return self::SUCCESS;
    }
}
