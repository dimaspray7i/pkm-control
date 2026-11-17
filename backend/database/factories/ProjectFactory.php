<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    protected $model = Project::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        static $counter = 0;
        $counter++;

        return [
            'code'            => sprintf('PRJ-%04d', $counter),
            'name'            => $this->faker->words(3, true),
            'client'          => $this->faker->company(),
            'pic_id'          => null,
            'pic_name'        => $this->faker->name(),
            'progress'        => $this->faker->numberBetween(0, 100),
            'target_progress' => $this->faker->numberBetween(50, 100),
            'status'          => $this->faker->randomElement(['planning', 'active', 'completed', 'on_hold']),
            'risk_level'      => $this->faker->randomElement(['low', 'medium', 'high']),
            'risk_factor'     => $this->faker->sentence(),
            'deadline'        => $this->faker->dateTimeBetween('now', '+6 months')->format('Y-m-d'),
            'category'        => $this->faker->randomElement(['Web Development', 'Mobile App', 'Infrastructure', 'Consulting']),
            'is_active'       => true,
        ];
    }
}
