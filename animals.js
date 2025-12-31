
// ------------------------------------------------------------------
// ANIMAL INTERACTION SYSTEM
// ------------------------------------------------------------------

// Global functions for animal interaction
window.showAnimalMenu = function(index) {
    const animal = animals[index];
    if (!animal) return;

    // Close any existing modals
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.style.textAlign = 'center';
    modal.style.border = '4px solid ' + (animal.kind === 'pig' ? '#f48fb1' : '#f1c40f');
    modal.style.zIndex = '10000'; // Ensure it's on top
    
    const animalName = animal.kind.charAt(0).toUpperCase() + animal.kind.slice(1);
    const breedCost = 500;
    
    modal.innerHTML = `
        <button class="modal-close" onclick="this.parentElement.remove()">&times;</button>
        <h2 style="color: #333;">${animalName}</h2>
        <div style="font-size: 60px; margin: 10px 0;">
            ${getAnimalIcon(animal.kind)}
        </div>
        <p style="margin-bottom: 20px;">What would you like to do?</p>
        
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
            <button class="action-btn" onclick="breedAnimal(${index}); this.closest('.modal').remove()" style="background: linear-gradient(135deg, #e91e63, #c2185b);">
                💕 Breed ($${breedCost})
            </button>
            <button class="action-btn" onclick="collectAnimal(${index}); this.closest('.modal').remove()" style="background: linear-gradient(135deg, #e74c3c, #c0392b);">
                🎒 Collect (Sell)
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
};

function getAnimalIcon(kind) {
    const icons = {
        cow: '🐮',
        pig: '🐷',
        chicken: '🐔',
        sheep: '🐑',
        goat: '🐐',
        duck: '🦆',
        horse: '🐴'
    };
    return icons[kind] || '🐾';
}

window.breedAnimal = function(index) {
    const animal = animals[index];
    if (!animal) return;
    
    const cost = 500;
    if (gameState.money < cost) {
        showNotification("Not enough money to breed!", 'error');
        return;
    }
    
    // Check if linked to a building
    if (!animal.buildingData) {
        // Fallback: try to find nearest building of correct type
        const nearest = gameState.buildings.find(b => {
            const def = BuildingTypes[b.type];
            return def && b.type === 'breeding_center' &&
                   Math.abs(b.x - animal.mesh.position.x) < 5 && 
                   Math.abs(b.z - animal.mesh.position.z) < 5;
        });
        
        if (nearest) {
            animal.buildingData = nearest;
            if (!nearest.animals) nearest.animals = [animal.kind];
        } else {
            showNotification("Move animal into a Breeding Center to breed!", 'warning');
            return;
        }
    }
    
    const building = animal.buildingData;
    
    if (building.type !== 'breeding_center') {
        showNotification("Breeding is only allowed in the Breeding Center", 'warning');
        return;
    }
    
    // Max animals check (10 per building)
    if (building.animals && building.animals.length >= 10) {
        showNotification("Building is full!", 'warning');
        return;
    }

    gameState.money -= cost;
    
    // Add to persistent list
    if (!building.animals) building.animals = [];
    building.animals.push(animal.kind);
    
    // Spawn Baby
    const offset = (Math.random() - 0.5) * 3;
    if (typeof spawnAnimal === 'function') {
        spawnAnimal(animal.kind, animal.mesh.position.x + offset, animal.mesh.position.z + offset);
        
        // Baby Visuals (Scale down newly added animal)
        const baby = animals[animals.length - 1];
        if (baby && baby.mesh) {
            baby.mesh.scale.setScalar(0.5);
            // Optional: Grow up logic could be added here or in update loop
        }
        if (baby) {
            baby.buildingData = building;
        }
    }
    
    showNotification("Baby born!", 'success');
    if (typeof SoundEffects !== 'undefined') SoundEffects.playBuild();
    if (typeof updateUI === 'function') updateUI();
    if (typeof saveGame === 'function') saveGame();
};

window.collectAnimal = function(index) {
    const animal = animals[index];
    if (!animal) return;
    
    // Remove from Persistent List
    if (animal.buildingData && animal.buildingData.animals) {
        const list = animal.buildingData.animals;
        const idx = list.indexOf(animal.kind);
        if (idx !== -1) {
            list.splice(idx, 1);
        }
    }
    
    // Remove from Scene
    if (typeof scene !== 'undefined') scene.remove(animal.mesh);
    animals.splice(index, 1);
    
    // Reward
    const reward = 250; // Sell price
    if (typeof addMoney === 'function') addMoney(reward);
    
    showNotification(`Sold ${animal.kind} for $${reward}`, 'success');
    if (typeof SoundEffects !== 'undefined') SoundEffects.playMoney();
    if (typeof updateUI === 'function') updateUI();
    if (typeof saveGame === 'function') saveGame();
};
