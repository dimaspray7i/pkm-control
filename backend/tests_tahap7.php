<?php

require_once __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\UserPreference;
use App\Models\Project;
use App\Models\Task;
use App\Models\Milestone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

echo "=== TAHAP 7 TEST SUITE: SETTINGS & NOTIFICATION PREFERENCES ===\n\n";

$passCount = 0;
$failCount = 0;

function assertTest($description, $condition) {
    global $passCount, $failCount;
    if ($condition) {
        echo "✅ PASS: $description\n";
        $passCount++;
    } else {
        echo "❌ FAIL: $description\n";
        $failCount++;
    }
}

// Setup test users
$admin = User::where('role', 'admin')->first();
if (!$admin) {
    die("No admin user found for testing.\n");
}

$testUserB = User::where('id', '!=', $admin->id)->first();
if (!$testUserB) {
    // Create temporary user B
    $testUserB = User::create([
        'name' => 'Test User B',
        'email' => 'testuserb_' . time() . '@pkm.co.id',
        'password' => Hash::make('password123'),
        'role' => 'member',
        'is_active' => true,
    ]);
}

// Initial counts for regression check
$initialProjectsCount = Project::count();
$initialTasksCount = Task::count();
$initialMilestonesCount = Milestone::count();
$initialUsersCount = User::count();

// Helper to make internal API requests authenticated as a user
function makeRequest($method, $uri, $user = null, $data = []) {
    app('auth')->forgetGuards();
    if ($user) {
        auth('sanctum')->setUser($user);
    }

    $request = Request::create($uri, $method, $data);
    $request->headers->set('Accept', 'application/json');
    return app()->handle($request);
}

// -------------------------------------------------------------
// Test 1: GET preferences for logged-in user
// -------------------------------------------------------------
// Clean existing pref for clean test
UserPreference::where('user_id', $admin->id)->delete();

$response1 = makeRequest('GET', '/api/settings/preferences', $admin);
$data1 = json_decode($response1->getContent(), true);

assertTest(
    "Test 1: GET /api/settings/preferences returns 200 with default preferences",
    $response1->getStatusCode() === 200 &&
    isset($data1['preferences']['notify_task_assigned']) &&
    $data1['preferences']['notify_task_assigned'] === true &&
    $data1['preferences']['notify_project_changed'] === false
);

// -------------------------------------------------------------
// Test 2: PUT /api/settings/preferences updates values
// -------------------------------------------------------------
$updatePayload = [
    'notify_task_assigned' => false,
    'notify_task_status_changed' => true,
    'notify_task_overdue' => false,
    'notify_project_changed' => true,
    'notify_system_activity' => true,
];
$response2 = makeRequest('PUT', '/api/settings/preferences', $admin, $updatePayload);
$data2 = json_decode($response2->getContent(), true);

assertTest(
    "Test 2: PUT /api/settings/preferences returns 200 with updated values",
    $response2->getStatusCode() === 200 &&
    isset($data2['preferences']) &&
    $data2['preferences']['notify_task_assigned'] === false &&
    $data2['preferences']['notify_project_changed'] === true &&
    $data2['preferences']['notify_system_activity'] === true
);

// -------------------------------------------------------------
// Test 3: Verify preferences actually saved to MySQL database
// -------------------------------------------------------------
$dbPref = DB::table('user_preferences')->where('user_id', $admin->id)->first();
assertTest(
    "Test 3: Preferences directly queried from MySQL table match updated payload",
    $dbPref !== null &&
    (int)$dbPref->notify_task_assigned === 0 &&
    (int)$dbPref->notify_project_changed === 1 &&
    (int)$dbPref->notify_system_activity === 1
);

// -------------------------------------------------------------
// Test 4: Verify persistence after simulated refresh / re-fetch
// -------------------------------------------------------------
$response4 = makeRequest('GET', '/api/settings/preferences', $admin);
$data4 = json_decode($response4->getContent(), true);

assertTest(
    "Test 4: Re-fetching preferences persists updated values across requests",
    $response4->getStatusCode() === 200 &&
    $data4['preferences']['notify_task_assigned'] === false &&
    $data4['preferences']['notify_project_changed'] === true
);

// -------------------------------------------------------------
// Test 5: Multi-user isolation (User A vs User B)
// -------------------------------------------------------------
// Set User B with different preferences
$updatePayloadB = [
    'notify_task_assigned' => true,
    'notify_task_status_changed' => false,
    'notify_task_overdue' => true,
    'notify_project_changed' => false,
    'notify_system_activity' => false,
];
$response5 = makeRequest('PUT', '/api/settings/preferences', $testUserB, $updatePayloadB);
$data5B = json_decode($response5->getContent(), true);

// Fetch admin prefs again
$response5Admin = makeRequest('GET', '/api/settings/preferences', $admin);
$data5Admin = json_decode($response5Admin->getContent(), true);

assertTest(
    "Test 5: User A and User B maintain separate isolated preference records",
    $data5B['preferences']['notify_task_assigned'] === true &&
    $data5Admin['preferences']['notify_task_assigned'] === false &&
    $data5B['preferences']['notify_project_changed'] === false &&
    $data5Admin['preferences']['notify_project_changed'] === true
);

// -------------------------------------------------------------
// Test 6: Scoped access — User A cannot read User B's preferences
// -------------------------------------------------------------
// In this endpoint design, preferences are scoped exclusively to the authenticated user token ($request->user())
// Passing query param or user_id cannot override auth user.
$response6 = makeRequest('GET', '/api/settings/preferences?user_id=' . $testUserB->id, $admin);
$data6 = json_decode($response6->getContent(), true);

assertTest(
    "Test 6: User cannot read other users' preferences via query parameters (strictly auth-scoped)",
    $data6['preferences']['user_id'] == $admin->id &&
    $data6['preferences']['notify_task_assigned'] === false
);

// -------------------------------------------------------------
// Test 7: Scoped access — User A cannot update User B's preferences
// -------------------------------------------------------------
$spoofedPayload = array_merge($updatePayload, ['user_id' => $testUserB->id]);
$response7 = makeRequest('PUT', '/api/settings/preferences', $admin, $spoofedPayload);
$dbUserBPref = DB::table('user_preferences')->where('user_id', $testUserB->id)->first();

assertTest(
    "Test 7: User cannot alter another user's preferences by passing spoofed user_id in body",
    $dbUserBPref !== null &&
    (int)$dbUserBPref->notify_task_assigned === 1 // unchanged from User B's setting
);

// -------------------------------------------------------------
// Test 8: Unauthenticated request returns 401
// -------------------------------------------------------------
$response8 = makeRequest('GET', '/api/settings/preferences', null);
assertTest(
    "Test 8: Unauthenticated request to /api/settings/preferences returns 401 Unauthorized",
    $response8->getStatusCode() === 401
);

// -------------------------------------------------------------
// Test 9: Non-boolean / invalid payload rejected with 422
// -------------------------------------------------------------
$invalidPayload = [
    'notify_task_assigned' => 'invalid_string',
    'notify_task_status_changed' => 12345,
    // missing other required fields
];
$response9 = makeRequest('PUT', '/api/settings/preferences', $admin, $invalidPayload);
assertTest(
    "Test 9: Invalid payload (non-boolean/missing fields) returns 422 Unprocessable Entity",
    $response9->getStatusCode() === 422
);

// -------------------------------------------------------------
// Test 10: Profile update via PUT /api/me works
// -------------------------------------------------------------
$originalName = $admin->name;
$originalPhone = $admin->phone;
$newName = $originalName . ' Updated';
$newPhone = '081299998888';

$response10 = makeRequest('PUT', '/api/me', $admin, [
    'name' => $newName,
    'phone' => $newPhone,
]);
$data10 = json_decode($response10->getContent(), true);

$updatedAdmin = User::find($admin->id);
$profileUpdatedOk = ($updatedAdmin->name === $newName && $updatedAdmin->phone === $newPhone);

// Revert profile to original
$admin->update(['name' => $originalName, 'phone' => $originalPhone]);

assertTest(
    "Test 10: Profile update (PUT /api/me) successfully updates name and phone in database",
    $response10->getStatusCode() === 200 && $profileUpdatedOk
);

// -------------------------------------------------------------
// Test 11: No data regression on existing tables
// -------------------------------------------------------------
$finalProjectsCount = Project::count();
$finalTasksCount = Task::count();
$finalMilestonesCount = Milestone::count();
$finalUsersCount = User::count();

assertTest(
    "Test 11: No data regression (projects: $finalProjectsCount, tasks: $finalTasksCount, milestones: $finalMilestonesCount)",
    $finalProjectsCount === $initialProjectsCount &&
    $finalTasksCount === $initialTasksCount &&
    $finalMilestonesCount === $initialMilestonesCount
);

// -------------------------------------------------------------
// Test 12: Security — Responses do not leak sensitive fields
// -------------------------------------------------------------
$response12 = makeRequest('GET', '/api/settings/preferences', $admin);
$rawContent12 = $response12->getContent();

$leakCheck = !str_contains($rawContent12, 'password') &&
             !str_contains($rawContent12, 'token') &&
             !str_contains($rawContent12, 'remember_token');

assertTest(
    "Test 12: API responses do not leak password, tokens, or security hashes",
    $leakCheck
);

echo "\n======================================================\n";
echo "TEST RESULTS: $passCount PASSED, $failCount FAILED (Total: " . ($passCount + $failCount) . ")\n";
echo "======================================================\n";

if ($failCount > 0) {
    exit(1);
}
exit(0);
