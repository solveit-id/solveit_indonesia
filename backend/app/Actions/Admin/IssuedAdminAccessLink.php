<?php

namespace App\Actions\Admin;

use App\Models\AdminAccessLink;

/**
 * A freshly issued access link. The plain token and URL exist only in this object: show
 * them once to the issuer and never log or store them.
 */
final readonly class IssuedAdminAccessLink
{
    public function __construct(
        public AdminAccessLink $link,
        #[\SensitiveParameter] public string $token,
        #[\SensitiveParameter] public string $url,
    ) {}
}
