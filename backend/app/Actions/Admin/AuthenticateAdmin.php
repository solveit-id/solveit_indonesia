<?php

namespace App\Actions\Admin;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Timebox;

/**
 * Credential check for Fortify's sign-in pipeline (Fortify::authenticateUsing).
 *
 * Returns the account only when the password matches AND the account may sign in
 * (role, activation, confirmed TOTP, not suspended); every other case returns null, which
 * Fortify turns into the same 422 "These credentials do not match our records." An
 * unknown address is checked against a throwaway hash, and every attempt runs inside a
 * Timebox, so neither the answer nor its duration tells whether an account exists or is
 * inactive. A correct password never signs in on its own: Fortify then asks for TOTP.
 */
class AuthenticateAdmin
{
    private static ?string $unknownAccountHash = null;

    public function __invoke(Request $request): ?User
    {
        $email = mb_strtolower(trim((string) $request->input('email')));
        $password = (string) $request->input('password');

        return (new Timebox)->call(function () use ($email, $password): ?User {
            $user = User::query()->where('email', $email)->first();

            $passwordMatches = Hash::check($password, $user?->password ?? self::unknownAccountHash());

            if ($user === null || ! $passwordMatches || ! $user->canSignInToAdmin()) {
                return null;
            }

            if (Hash::needsRehash($user->password)) {
                $user->forceFill(['password' => $password])->save();
            }

            return $user;
        }, (int) config('admin.login.minimum_duration_microseconds'));
    }

    /**
     * A hash with the configured cost, so checking it takes as long as a real one.
     */
    private static function unknownAccountHash(): string
    {
        return self::$unknownAccountHash ??= Hash::make(Str::random(40));
    }
}
