<?php

namespace App\Console\Commands\Concerns;

use Illuminate\Console\ConfirmableTrait;

/**
 * In production an account command runs only after an explicit yes or with --force.
 * Without a terminal (scripts, CI, `docker compose exec -T`) it refuses with a clear
 * message instead of relying on a prompt's default.
 */
trait ConfirmsInProduction
{
    use ConfirmableTrait;

    protected function confirmedForProduction(string $warning): bool
    {
        if ($this->getLaravel()->environment('production') && ! $this->option('force') && ! $this->input->isInteractive()) {
            $this->components->error('Production without a terminal: run again with --force to confirm.');

            return false;
        }

        return $this->confirmToProceed($warning);
    }
}
