<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('inquiries', function (Blueprint $table) {
            $table->id();
            $table->string('public_id', 18)->unique();
            $table->string('name', 120);
            $table->string('organization', 160)->nullable();
            $table->string('contact', 254);
            $table->string('service', 32);
            $table->string('budget', 32);
            $table->string('timeline', 32);
            $table->text('message');
            $table->string('status', 32)->default('received')->index();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inquiries');
    }
};
