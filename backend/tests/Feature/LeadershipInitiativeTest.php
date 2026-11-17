<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Project;
use App\Models\StrategicInitiative;
use Illuminate\Foundation\Testing\RefreshDatabase;

class LeadershipInitiativeTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $pimpinan;
    private User $manager;
    private User $member;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin    = User::factory()->create(['role' => 'admin',          'is_active' => true]);
        $this->pimpinan = User::factory()->create(['role' => 'pimpinan',       'is_active' => true]);
        $this->manager  = User::factory()->create(['role' => 'project_manager','is_active' => true]);
        $this->member   = User::factory()->create(['role' => 'member',         'is_active' => true]);
    }

    // --- Auth ----------------------------------------------------------------

    public function test_unauthenticated_cannot_access_initiatives(): void
    {
        $this->getJson('/api/leadership/initiatives')->assertStatus(401);
    }

    public function test_member_cannot_access_initiatives(): void
    {
        $this->actingAs($this->member)
             ->getJson('/api/leadership/initiatives')
             ->assertStatus(403);
    }

    public function test_project_manager_cannot_access_initiatives(): void
    {
        $this->actingAs($this->manager)
             ->getJson('/api/leadership/initiatives')
             ->assertStatus(403);
    }

    // --- Overview ------------------------------------------------------------

    public function test_pimpinan_can_access_overview(): void
    {
        $this->actingAs($this->pimpinan)
             ->getJson('/api/leadership/initiatives/overview')
             ->assertOk()
             ->assertJsonStructure(['overview' => ['total_initiatives', 'active_initiatives', 'total_allocated_budget', 'total_spent_budget']]);
    }

    public function test_admin_can_access_overview(): void
    {
        $this->actingAs($this->admin)
             ->getJson('/api/leadership/initiatives/overview')
             ->assertOk();
    }

    // --- Index ---------------------------------------------------------------

    public function test_pimpinan_can_list_initiatives(): void
    {
        StrategicInitiative::factory(3)->create(['created_by' => $this->pimpinan->id]);

        $this->actingAs($this->pimpinan)
             ->getJson('/api/leadership/initiatives')
             ->assertOk()
             ->assertJsonStructure(['initiatives']);
    }

    // --- Store ---------------------------------------------------------------

    public function test_pimpinan_can_create_initiative(): void
    {
        $payload = [
            'title'      => 'Inisiatif Digital Transformation',
            'lead_id'    => $this->manager->id,
            'category'   => 'teknologi',
            'allocated_budget' => 500000000,
            'start_date' => '2026-12-01',
            'target_date'=> '2027-06-30',
            'status'     => 'planned',
            'priority'   => 'high',
        ];

        $this->actingAs($this->pimpinan)
             ->postJson('/api/leadership/initiatives', $payload)
             ->assertCreated()
             ->assertJsonFragment(['title' => 'Inisiatif Digital Transformation']);

        $this->assertDatabaseHas('strategic_initiatives', ['title' => 'Inisiatif Digital Transformation']);
    }

    public function test_create_initiative_validates_required_fields(): void
    {
        $this->actingAs($this->admin)
             ->postJson('/api/leadership/initiatives', [])
             ->assertStatus(422)
             ->assertJsonValidationErrors(['title', 'category', 'status', 'priority']);
    }

    // --- Show ----------------------------------------------------------------

    public function test_pimpinan_can_view_initiative(): void
    {
        $initiative = StrategicInitiative::factory()->create(['created_by' => $this->pimpinan->id]);

        $this->actingAs($this->pimpinan)
             ->getJson("/api/leadership/initiatives/{$initiative->id}")
             ->assertOk()
             ->assertJsonFragment(['id' => $initiative->id]);
    }

    public function test_show_returns_404_for_nonexistent_initiative(): void
    {
        $this->actingAs($this->admin)
             ->getJson('/api/leadership/initiatives/99999')
             ->assertNotFound();
    }

    // --- Update --------------------------------------------------------------

    public function test_admin_can_update_initiative(): void
    {
        $initiative = StrategicInitiative::factory()->create(['created_by' => $this->admin->id]);

        $this->actingAs($this->admin)
             ->putJson("/api/leadership/initiatives/{$initiative->id}", [
                 'title'  => 'Updated Title',
                 'status' => 'active',
             ])
             ->assertOk()
             ->assertJsonFragment(['title' => 'Updated Title']);

        $this->assertDatabaseHas('strategic_initiatives', ['id' => $initiative->id, 'title' => 'Updated Title']);
    }

    // --- Destroy -------------------------------------------------------------

    public function test_admin_can_delete_initiative(): void
    {
        $initiative = StrategicInitiative::factory()->create(['created_by' => $this->admin->id]);

        $this->actingAs($this->admin)
             ->deleteJson("/api/leadership/initiatives/{$initiative->id}")
             ->assertOk();

        $this->assertDatabaseMissing('strategic_initiatives', ['id' => $initiative->id]);
    }

    // --- Resource Allocation -------------------------------------------------

    public function test_pimpinan_can_allocate_resource(): void
    {
        $initiative = StrategicInitiative::factory()->create(['created_by' => $this->pimpinan->id]);

        $this->actingAs($this->pimpinan)
             ->postJson("/api/leadership/initiatives/{$initiative->id}/resources", [
                 'user_id'              => $this->manager->id,
                 'allocation_percentage'=> 50,
                 'role_in_initiative'   => 'Project Lead',
             ])
             ->assertOk();

        $this->assertDatabaseHas('strategic_resource_allocations', [
            'initiative_id' => $initiative->id,
            'user_id'       => $this->manager->id,
        ]);
    }

    public function test_allocate_resource_validates_required_fields(): void
    {
        $initiative = StrategicInitiative::factory()->create(['created_by' => $this->admin->id]);

        $this->actingAs($this->admin)
             ->postJson("/api/leadership/initiatives/{$initiative->id}/resources", [])
             ->assertStatus(422)
             ->assertJsonValidationErrors(['user_id', 'role_in_initiative', 'allocation_percentage']);
    }

    public function test_allocating_same_user_twice_upserts(): void
    {
        $initiative = StrategicInitiative::factory()->create(['created_by' => $this->admin->id]);

        $payload = [
            'user_id'               => $this->member->id,
            'allocation_percentage' => 30,
            'role_in_initiative'    => 'Support',
        ];

        $this->actingAs($this->admin)->postJson("/api/leadership/initiatives/{$initiative->id}/resources", $payload);
        // Second call should upsert (200 OK), not fail
        $this->actingAs($this->admin)
             ->postJson("/api/leadership/initiatives/{$initiative->id}/resources", array_merge($payload, ['allocation_percentage' => 50]))
             ->assertOk();

        // Should still be only one record
        $this->assertDatabaseCount('strategic_resource_allocations', 1);
    }

    public function test_pimpinan_can_remove_resource(): void
    {
        $initiative = StrategicInitiative::factory()->create(['created_by' => $this->pimpinan->id]);

        $this->actingAs($this->pimpinan)->postJson("/api/leadership/initiatives/{$initiative->id}/resources", [
            'user_id'               => $this->manager->id,
            'allocation_percentage' => 40,
            'role_in_initiative'    => 'Analyst',
        ]);

        $this->actingAs($this->pimpinan)
             ->deleteJson("/api/leadership/initiatives/{$initiative->id}/resources/{$this->manager->id}")
             ->assertOk();

        $this->assertDatabaseMissing('strategic_resource_allocations', [
            'initiative_id' => $initiative->id,
            'user_id'       => $this->manager->id,
        ]);
    }

    // --- Project Linking -----------------------------------------------------

    public function test_pimpinan_can_link_project(): void
    {
        $initiative = StrategicInitiative::factory()->create(['created_by' => $this->pimpinan->id]);
        $project    = Project::factory()->create(['pic_id' => $this->manager->id]);

        $this->actingAs($this->pimpinan)
             ->postJson("/api/leadership/initiatives/{$initiative->id}/projects", ['project_id' => $project->id])
             ->assertOk();

        $this->assertDatabaseHas('strategic_initiative_projects', [
            'initiative_id' => $initiative->id,
            'project_id'    => $project->id,
        ]);
    }

    public function test_pimpinan_can_unlink_project(): void
    {
        $initiative = StrategicInitiative::factory()->create(['created_by' => $this->pimpinan->id]);
        $project    = Project::factory()->create(['pic_id' => $this->manager->id]);

        $this->actingAs($this->pimpinan)
             ->postJson("/api/leadership/initiatives/{$initiative->id}/projects", ['project_id' => $project->id]);

        $this->actingAs($this->pimpinan)
             ->deleteJson("/api/leadership/initiatives/{$initiative->id}/projects/{$project->id}")
             ->assertOk();

        $this->assertDatabaseMissing('strategic_initiative_projects', [
            'initiative_id' => $initiative->id,
            'project_id'    => $project->id,
        ]);
    }

    // --- Capacity ------------------------------------------------------------

    public function test_capacity_endpoint_returns_expected_structure(): void
    {
        $this->actingAs($this->pimpinan)
             ->getJson('/api/leadership/initiatives/resource-capacity')
             ->assertOk()
             ->assertJsonStructure(['capacity']);
    }
}
