<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * The owner bootstrap command was refused. Shell only; never rendered over HTTP.
 */
class OwnerBootstrapRefusedException extends RuntimeException
{
    public function __construct(string $message, public readonly string $reason)
    {
        parent::__construct($message);
    }

    public static function activeOwnerExists(): self
    {
        return new self('An active owner already exists. Further accounts are invited by an owner.', 'active-owner-exists');
    }

    public static function anotherOwnerPending(): self
    {
        return new self('Another owner account is waiting for activation. Bootstrap that address again, or reset it first.', 'another-owner-pending');
    }

    public static function emailBelongsToAnotherAccount(): self
    {
        return new self('This email address belongs to an account that is not an owner.', 'email-taken');
    }
}
