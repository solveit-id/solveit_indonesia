// Types of env.mjs (plain JavaScript so start-laravel.mjs runs on Node without a TS loader).
export declare const ADMIN_ORIGIN: string;
export declare const LARAVEL_HOST: string;
export declare const LARAVEL_PORT: number;
export declare const LARAVEL_ORIGIN: string;
export declare const BACKEND_DIR: string;
export declare const HARNESS: string;
export declare const ROUTER: string;
export declare const CLOCK_FILE: string;
export declare function harnessEnvironment(): NodeJS.ProcessEnv;
