<?php

namespace Database\Factories;

use App\Models\StrategicInitiative;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StrategicInitiative>
 */
class StrategicInitiativeFactory extends Factory
{
    protected $model = StrategicInitiative::class;

    public function definition(): array
    {
        static $counter = 0;
        $counter++;
        $year = date('Y');

        return [
            'code'               => sprintf('INIT-%s-%03d', $year, $counter),
            'title'              => $this->faker->sentence(4),
            'description'        => $this->faker->paragraph(),
            'objective_id'       => null,
            'lead_id'            => null,
            'category'           => $this->faker->randomElement(['operasional', 'teknologi', 'sdm', 'keuangan', 'pemasaran']),
            'priority'           => $this->faker->randomElement(['low', 'medium', 'high', 'critical']),
            'status'             => $this->faker->randomElement(['draft', 'planned', 'active', 'on_hold', 'completed']),
            'start_date'         => $this->faker->dateTimeBetween('-6 months', 'now')->format('Y-m-d'),
            'target_date'        => $this->faker->dateTimeBetween('now', '+12 months')->format('Y-m-d'),
            'progress'           => $this->faker->randomFloat(1, 0, 100),
            'allocated_budget'   => $this->faker->randomFloat(2, 10000000, 1000000000),
            'spent_budget'       => $this->faker->randomFloat(2, 0, 10000000),
            'strategic_rationale'=> $this->faker->sentence(),
            'created_by'         => User::factory(),
        ];
    }
}
