<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        try {
            $conn = \Illuminate\Support\Facades\DB::connection();
            if ($conn->getDriverName() === 'sqlite') {
                $pdo = $conn->getPdo();
                if (method_exists($pdo, 'sqliteCreateFunction')) {
                    $pdo->sqliteCreateFunction('FIELD', function (...$args) {
                        if (empty($args)) return 0;
                        $value = array_shift($args);
                        $index = array_search($value, $args, false);
                        return $index !== false ? $index + 1 : count($args) + 1;
                    });
                }
            }
        } catch (\Throwable $e) {
            // Database not yet connected during early boot
        }
    }
}
