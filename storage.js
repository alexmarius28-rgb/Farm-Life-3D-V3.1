
// ------------------------------------------------------------------
// SILO & WAREHOUSE UPGRADE SYSTEM
// ------------------------------------------------------------------

// New: Show upgrade menu for a specific building object
window.showSiloUpgradeMenu = function(selectedBuilding) {
    showStorageUpgradeModal('silo', selectedBuilding);
};
window.showWarehouseUpgradeMenu = function(selectedBuilding) {
    showStorageUpgradeModal('warehouse', selectedBuilding);
};

function showStorageUpgradeModal(type, buildingObj) {
    const isSilo = type === 'silo';
    if (!buildingObj || buildingObj.type !== type) {
        alert('No building selected!');
        return;
    }
    if (!buildingObj.level) buildingObj.level = 1;
    const currentLevel = buildingObj.level;
    const name = isSilo ? 'Silo' : 'Warehouse';
    // Silo gives +50 per level (starts at 50 base from game + 50 from level 1 = 100? No, logic in getMaxInventorySpace is base 50 + levels)
    // getMaxInventorySpace: 50 + silo*50 + warehouse*100
    // So upgrading Silo adds 50. Upgrading Warehouse adds 100.
    
    const cost = currentLevel * (isSilo ? 2000 : 5000);
    
    // Simple material requirements: Wood and Stone
    // Wood comes from trees? Or maybe just crops for now if wood isn't implemented?
    // Let's assume Wood/Stone are rare items or just use money for now if they don't exist?
    // User asked to collect animals, maybe animals drop stuff?
    // Let's stick to money and maybe "wheat" for Silo (straw) and "corn" for Warehouse?
    // Or just simple Money + Level check.
    
    const req1Name = isSilo ? 'egg' : 'milk_bottle'; 
    const req2Name = isSilo ? 'truffle' : 'egg';
    
    // Check if wood/stone exist in inventory logic
    // If not, fall back to crops
    const req1 = currentLevel * 50;
    const req2 = currentLevel * 20;
    
    let modal = document.getElementById('storage-upgrade-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'storage-upgrade-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    
    const canAfford = gameState.money >= cost;
    const hasReq1 = (gameState.inventory[req1Name] || 0) >= req1;
    const hasReq2 = (gameState.inventory[req2Name] || 0) >= req2;
    const canUpgrade = canAfford && hasReq1 && hasReq2;
    
    const addedCap = isSilo ? 50 : 100;

    modal.innerHTML = `
        <button class="modal-close" onclick="document.getElementById('storage-upgrade-modal').style.display='none'">&times;</button>
        <h2 style="color: #e67e22;">Upgrade ${name}</h2>
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 40px; margin: 10px;">${isSilo ? '🗼' : '📦'}</div>
            <p>Current Level: <strong>${currentLevel}</strong></p>
            <p style="color: #2ecc71;">Upgrade Effect: <strong>+${addedCap} Inventory Space</strong></p>
            <div style="margin: 20px 0; font-size: 24px;">⬇️</div>
            <p>Target Level: <strong>${currentLevel + 1}</strong></p>
        </div>
        <div class="upgrade-req-list">
            <div class="upgrade-req-item" style="border-left: 4px solid ${canAfford ? '#2ecc71' : '#e74c3c'}">
                <span>💰 Cost</span>
                <span>$${cost}</span>
            </div>
            <div class="upgrade-req-item" style="border-left: 4px solid ${hasReq1 ? '#2ecc71' : '#e74c3c'}">
                <span>${getIcon(req1Name)} ${getName(req1Name)}</span>
                <span>${gameState.inventory[req1Name] || 0} / ${req1}</span>
            </div>
             <div class="upgrade-req-item" style="border-left: 4px solid ${hasReq2 ? '#2ecc71' : '#e74c3c'}">
                <span>${getIcon(req2Name)} ${getName(req2Name)}</span>
                <span>${gameState.inventory[req2Name] || 0} / ${req2}</span>
            </div>
        </div>
        <button class="action-btn" 
            onclick="window.performStorageUpgrade('${type}', ${cost}, '${req1Name}', ${req1}, '${req2Name}', ${req2}, ${buildingObj.id})"
            ${!canUpgrade ? 'disabled style=\"background: #95a5a6; cursor: not-allowed;\"' : ''}>
            Upgrade ${name}
        </button>
    `;
    
    modal.style.display = 'block';
}

function getIcon(type) {
    if(type === 'wheat') return '🌾';
    if(type === 'corn') return '🌽';
    if(type === 'carrot') return '🥕';
    if(type === 'potato') return '🥔';
    if(type === 'egg') return '🥚';
    if(type === 'truffle') return '🍄';
    if(type === 'milk_bottle') return '🥛';
    if(type === 'wood') return '🪵';
    if(type === 'stone') return '🪨';
    return '📦';
}

function getName(type) {
    if (type === 'milk_bottle') return 'Milk Bottle';
    if (type === 'egg') return 'Egg';
    if (type === 'truffle') return 'Truffle';
    return type.charAt(0).toUpperCase() + type.slice(1);
}

window.performStorageUpgrade = function(type, cost, r1n, r1v, r2n, r2v, buildingId) {
    if (gameState.money < cost) return;
    if ((gameState.inventory[r1n] || 0) < r1v) return;
    if ((gameState.inventory[r2n] || 0) < r2v) return;
    gameState.money -= cost;
    gameState.inventory[r1n] -= r1v;
    gameState.inventory[r2n] -= r2v;
    // Find the building by id
    const building = gameState.buildings.find(b => b.id === buildingId);
    if (building) {
        if (!building.level) building.level = 1;
        building.level++;
        showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} Upgraded! Capacity Increased.`, "success");
        
        // Immediately update the 3D model for the storage building
        if (typeof objects !== 'undefined' && typeof scene !== 'undefined' && typeof createDetailedBuilding !== 'undefined') {
            const mesh = objects.find(o => o.userData.type === type && o.position.x === building.x && o.position.z === building.z);
            if (mesh) {
                scene.remove(mesh);
                const idx = objects.indexOf(mesh);
                if (idx !== -1) objects.splice(idx, 1);
                const newMesh = createDetailedBuilding(type, building);
                newMesh.position.copy(mesh.position);
                scene.add(newMesh);
                objects.push(newMesh);
            }
        }
    }
    document.getElementById('storage-upgrade-modal').style.display = 'none';
    if(typeof SoundEffects !== 'undefined') SoundEffects.playBuild();
    updateUI();
    saveGame();
};
