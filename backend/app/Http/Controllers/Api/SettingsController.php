<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserPreference;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    /**
     * GET /api/settings/preferences
     * Returns the authenticated user's notification preferences.
     * Creates default preferences if none exist yet.
     */
    public function getPreferences(Request $request)
    {
        $user = $request->user();

        $prefs = UserPreference::firstOrCreate(
            ['user_id' => $user->id],
            [
                'notify_task_assigned'       => true,
                'notify_task_status_changed' => true,
                'notify_task_overdue'        => true,
                'notify_project_changed'     => false,
                'notify_system_activity'     => false,
            ]
        );

        return response()->json(['preferences' => $prefs]);
    }

    /**
     * PUT /api/settings/preferences
     * Updates the authenticated user's notification preferences.
     */
    public function updatePreferences(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'notify_task_assigned'       => 'required|boolean',
            'notify_task_status_changed' => 'required|boolean',
            'notify_task_overdue'        => 'required|boolean',
            'notify_project_changed'     => 'required|boolean',
            'notify_system_activity'     => 'required|boolean',
        ]);

        $prefs = UserPreference::updateOrCreate(
            ['user_id' => $user->id],
            $validated
        );

        return response()->json([
            'message'     => 'Preferensi notifikasi berhasil disimpan.',
            'preferences' => $prefs,
        ]);
    }
}
