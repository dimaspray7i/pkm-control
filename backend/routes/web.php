<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\File;

/*
|--------------------------------------------------------------------------
| Web Routes - PKM Business Control Center
|--------------------------------------------------------------------------
| Route catch-all yang melayani Single Page Application (SPA) frontend.
| Jika Vite dev server aktif atau dist tersedia, arahkan ke frontend React.
*/

Route::get('/{any?}', function () {
    $distPath = base_path('../frontend/dist/index.html');
    if (File::exists($distPath)) {
        return File::get($distPath);
    }
    return redirect('http://localhost:5173');
})->where('any', '^(?!api).*$');

