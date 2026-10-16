<?php

namespace Database\Factories;

use App\Enums\AdminRole;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\RecoveryCode;
use PragmaRX\Google2FA\Google2FA;

/**
 * Test accounts only (Faker is a development dependency). The default password is random:
 * a factory never creates an account with a known password unless a test asks for one.
 *
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * Define the model's default state: no role, so no admin access.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => Str::random(40),
            'remember_token' => null,
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    public function withPassword(string $password): static
    {
        return $this->state(fn (array $attributes) => ['password' => $password]);
    }

    /**
     * An activated account with the given role and a confirmed authenticator. The TOTP
     * secret is random per account; tests read it back with Fortify's encrypter.
     */
    public function activeAdmin(AdminRole $role = AdminRole::Admin): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => $role,
            'activated_at' => now(),
            'two_factor_secret' => Fortify::currentEncrypter()->encrypt((new Google2FA)->generateSecretKey(32)),
            'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt(json_encode(
                Collection::times(8, fn (): string => RecoveryCode::generate())->all()
            )),
            'two_factor_confirmed_at' => now(),
        ]);
    }

    public function owner(): static
    {
        return $this->activeAdmin(AdminRole::Owner);
    }

    public function suspended(): static
    {
        return $this->state(fn (array $attributes) => ['suspended_at' => now()]);
    }

    /**
     * Created with a role but never activated (no confirmed authenticator).
     */
    public function pendingActivation(AdminRole $role = AdminRole::Admin): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => $role,
            'activated_at' => null,
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ]);
    }
}
