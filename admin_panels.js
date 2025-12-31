console.log("Admin Panels Loaded");

// ------------------------------------------------------------------
// ADMIN & OWNER PANELS
// ------------------------------------------------------------------
window.showAdminPanel = function() {
    let modal = document.getElementById('admin-panel-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'admin-panel-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <button class="modal-close" onclick="document.getElementById('admin-panel-modal').style.display='none'">&times;</button>
        <h2 style="color: #3498db; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-bottom: 20px;">🛡️ Admin Panel</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; max-height: 500px; overflow-y: auto; padding-right: 10px;">
            <div class="admin-card" style="grid-column: 1 / -1; background: rgba(52, 152, 219, 0.1); border-left: 4px solid #3498db; padding: 15px; border-radius: 8px;">
                <h3 style="color: #3498db; margin: 0 0 10px 0;">Quick Stats</h3>
                <p style="margin: 5px 0; font-size: 14px;">Current Player: <strong>${gameState.playerName}</strong></p>
                <p style="margin: 5px 0; font-size: 14px;">Level: <strong>${gameState.level}</strong> | Money: <strong>$${gameState.money}</strong></p>
            </div>
            
            <button class="action-btn" onclick="window.addMoney(10000); window.showNotification('Admin: +10k Coins', 'success');" style="background: linear-gradient(135deg, #f1c40f, #f39c12);">💰 +10K Coins</button>
            <button class="action-btn" onclick="window.addDiamonds(1000); window.showNotification('Admin: +1k Diamonds', 'success');" style="background: linear-gradient(135deg, #9b59b6, #8e44ad);">💎 +1K Diamonds</button>
            <button class="action-btn" onclick="gameState.level = 10; window.updateUI(); window.showNotification('Admin: Level 10', 'success');" style="background: linear-gradient(135deg, #2ecc71, #27ae60);">⭐ Level 10</button>
            <button class="action-btn" onclick="gameState.level = 20; window.updateUI(); window.showNotification('Admin: Level 20', 'success');" style="background: linear-gradient(135deg, #2ecc71, #27ae60);">⭐ Level 20</button>
            <button class="action-btn" onclick="window.unlockAllBuildings(); window.showNotification('Admin: Buildings Unlocked', 'success');">🔓 Unlock All</button>
            <button class="action-btn" onclick="gameState.weather = 'Rain'; window.updateWeatherFX(0); window.showNotification('Admin: Weather Rain', 'info');">🌧️ Set Rain</button>
            <button class="action-btn" onclick="gameState.weather = 'Clear'; window.updateWeatherFX(0); window.showNotification('Admin: Clear Skies', 'info');">☀️ Set Clear</button>
            <button class="action-btn" style="background: linear-gradient(135deg, #e91e63, #c2185b);" onclick="window.giftDiamondsPrompt()">🎁 Gift Diamonds</button>
            <button class="action-btn" onclick="window.harvestAllCrops(); window.showNotification('Admin: All crops harvested', 'success');" style="background: linear-gradient(135deg, #27ae60, #2ecc71);">🌾 Harvest All Crops</button>
            <button class="action-btn" onclick="window.addXP(1000); window.showNotification('Admin: +1000 XP', 'success');" style="background: linear-gradient(135deg, #2980b9, #6dd5fa);">⚡ +1000 XP</button>
            <button class="action-btn" onclick="window.spawnAnimalPrompt();" style="background: linear-gradient(135deg, #f39c12, #e67e22);">🐄 Spawn Animal</button>
            <button class="action-btn" onclick="window.teleportPrompt();" style="background: linear-gradient(135deg, #8e44ad, #9b59b6);">🚀 Teleport</button>
            <button class="action-btn" onclick="window.toggleGodMode(); window.showNotification('Admin: God Mode Toggled', 'info');" style="background: linear-gradient(135deg, #e74c3c, #c0392b);">🦸 God Mode</button>
        </div>
    `;
    
    modal.style.display = 'block';
};
    // ------------------------------------------------------------------
    // VIP PANEL
    // ------------------------------------------------------------------
    window.showVIPPanel = function() {
        let modal = document.getElementById('vip-panel-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'vip-panel-modal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <button class="modal-close" onclick="document.getElementById('vip-panel-modal').style.display='none'">&times;</button>
            <h2 style="color: #e91e63; border-bottom: 3px solid #f1c40f; padding-bottom: 10px; margin-bottom: 20px;">💎 VIP Panel</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; max-height: 500px; overflow-y: auto; padding-right: 10px;">
                <div class="vip-card" style="grid-column: 1 / -1; background: rgba(241, 196, 15, 0.1); border-left: 4px solid #e91e63; padding: 15px; border-radius: 8px;">
                    <h3 style="color: #e91e63; margin: 0 0 10px 0;">VIP Features</h3>
                    <p style="margin: 5px 0; font-size: 14px;">Welcome, <strong>${gameState.playerName}</strong>!</p>
                    <p style="margin: 5px 0; font-size: 14px;">Level: <strong>${gameState.level}</strong> | Money: <strong>$${gameState.money}</strong></p>
                </div>
                <button class="action-btn" onclick="window.addMoney(50000); window.showNotification('VIP: +50k Coins', 'success');" style="background: linear-gradient(135deg, #f1c40f, #e91e63);">💰 +50K Coins</button>
                <button class="action-btn" onclick="window.addDiamonds(5000); window.showNotification('VIP: +5k Diamonds', 'success');" style="background: linear-gradient(135deg, #e91e63, #f1c40f);">💎 +5K Diamonds</button>
                <button class="action-btn" onclick="gameState.level += 5; window.updateUI(); window.showNotification('VIP: +5 Levels', 'success');" style="background: linear-gradient(135deg, #2ecc71, #e91e63);">⭐ +5 Levels</button>
                <button class="action-btn" onclick="window.unlockAllBuildings(); window.showNotification('VIP: Buildings Unlocked', 'success');">🔓 Unlock All Buildings</button>
                <button class="action-btn" onclick="window.harvestAllCrops(); window.showNotification('VIP: All crops harvested', 'success');" style="background: linear-gradient(135deg, #27ae60, #e91e63);">🌾 Harvest All Crops</button>
                <button class="action-btn" onclick="window.addXP(5000); window.showNotification('VIP: +5000 XP', 'success');" style="background: linear-gradient(135deg, #2980b9, #e91e63);">⚡ +5000 XP</button>
                <button class="action-btn" onclick="window.spawnAnimalPrompt();" style="background: linear-gradient(135deg, #f39c12, #e91e63);">🐄 Spawn Animal</button>
                <button class="action-btn" onclick="window.teleportPrompt();" style="background: linear-gradient(135deg, #8e44ad, #e91e63);">🚀 Teleport</button>
                <button class="action-btn" onclick="window.toggleGodMode(); window.showNotification('VIP: God Mode Toggled', 'info');" style="background: linear-gradient(135deg, #e74c3c, #e91e63);">🦸 God Mode</button>
            </div>
        `;
        modal.style.display = 'block';
    };

window.showOwnerPanel = function() {
    console.log("Opening Owner Panel");
    let modal = document.getElementById('owner-panel-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'owner-panel-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    

    modal.innerHTML = `
        <button class="modal-close" onclick="document.getElementById('owner-panel-modal').style.display='none'">&times;</button>
        <h2 style="color: #f1c40f; border-bottom: 3px solid #f1c40f; padding-bottom: 10px; margin-bottom: 20px;">👑 Owner Control Panel</h2>
        <div style="max-height: 550px; overflow-y: auto; padding-right: 10px;">
            <h3 style="color: #f1c40f; margin-top: 0; display: flex; align-items: center; gap: 8px;">💰 Resources & Promotions</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <button class="action-btn" style="background: linear-gradient(135deg, #f1c40f, #f39c12);" onclick="window.addMoney(1000000); window.showNotification('Owner: +1M Coins', 'success');">💰 +1M Coins</button>
                <button class="action-btn" style="background: linear-gradient(135deg, #9b59b6, #8e44ad);" onclick="window.addDiamonds(100000); window.showNotification('Owner: +100k Gems', 'success');">💎 +100k Gems</button>
                <button class="action-btn" style="background: linear-gradient(135deg, #2ecc71, #27ae60);" onclick="gameState.level = 100; window.updateUI(); window.showNotification('Owner: Level 100', 'success');">⭐ Level 100</button>
                <button class="action-btn" style="background: linear-gradient(135deg, #1abc9c, #16a085);" onclick="window.addInventoryItem('truffle', 100); window.addInventoryItem('gold_egg', 100); window.showNotification('Owner: Rare Items', 'success');">🎒 Rare Items</button>
                <button class="action-btn" style="background: linear-gradient(135deg, #3498db, #2980b9); grid-column: 1 / -1;" onclick="window.unlockAllBuildings(); window.showNotification('Owner: All Unlocked', 'success');">🔓 Unlock Everything</button>
            </div>

            <h3 style="color: #16a085; margin-top: 15px; display: flex; align-items: center; gap: 8px;">➕ Add Inventory Item</h3>
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 20px;">
                <input id="owner-add-item-type" type="text" placeholder="Item type (e.g. water_bucket)" style="padding: 6px; border-radius: 4px; border: 1px solid #ccc; width: 160px;">
                <input id="owner-add-item-amount" type="number" min="1" value="1" style="padding: 6px; border-radius: 4px; border: 1px solid #ccc; width: 80px;">
                <button class="action-btn" style="background: linear-gradient(135deg, #16a085, #27ae60);" onclick="(function(){
                    var type = document.getElementById('owner-add-item-type').value.trim();
                    var amt = parseInt(document.getElementById('owner-add-item-amount').value, 10) || 1;
                    if (!type) { window.showNotification('Enter item type', 'error'); return; }
                    if (amt < 1) { window.showNotification('Amount must be at least 1', 'error'); return; }
                    if (window.addInventoryItem(type, amt)) {
                        window.showNotification('Added ' + amt + ' × ' + type + '!', 'success');
                        window.refreshInventory && window.refreshInventory();
                    } else {
                        window.showNotification('Inventory full or invalid item.', 'error');
                    }
                })()">Add</button>
            </div>

            <h3 style="color: #3498db; margin-top: 15px; display: flex; align-items: center; gap: 8px;">🌐 Server Management</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <button class="action-btn" style="background: #34495e;" onclick="window.broadcastMessage()">📢 Broadcast</button>
                <button class="action-btn" style="background: #27ae60;" onclick="window.promoteAdminPrompt()">🛡️ Promote Admin</button>
                <button class="action-btn" style="background: linear-gradient(135deg, #3498db, #2980b9); grid-column: 1 / -1;" onclick="gameState.weather = 'Rain'; window.updateWeatherFX(0); window.showNotification('Owner: Weather Rain', 'info');">🌧️ Force Rain</button>
                <button class="action-btn" style="background: linear-gradient(135deg, #f1c40f, #f39c12); grid-column: 1 / -1;" onclick="gameState.weather = 'Clear'; window.updateWeatherFX(0); window.showNotification('Owner: Clear Skies', 'info');">☀️ Force Clear</button>
            </div>

            <h3 style="color: #e74c3c; margin-top: 15px; display: flex; align-items: center; gap: 8px;">⚠️ Danger Zone</h3>
            <div style="background: rgba(231, 76, 60, 0.1); border-left: 4px solid #e74c3c; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p style="font-size: 13px; margin-bottom: 10px; color: #ecf0f1;">
                    Warning: This action will permanently delete all server data. This cannot be undone!
                </p>
                <button class="action-btn" style="background: #c0392b;" onclick="window.confirmResetServer()">🗑️ WIPE ALL DATA</button>
            </div>
            
            <div style="background: rgba(52, 152, 219, 0.1); border-left: 4px solid #3498db; padding: 15px; border-radius: 8px;">
                <button class="action-btn" onclick="window.showAdminPanel()" style="background: #3498db; grid-column: 1 / -1;">👤 Standard Admin Panel</button>
            </div>

            <h3 style="color: #9b59b6; margin-top: 20px; display: flex; align-items: center; gap: 8px;">🔧 Advanced Tools</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <button class="action-btn" onclick="window.banPlayerPrompt();" style="background: linear-gradient(135deg, #e74c3c, #c0392b);">🚫 Ban Player</button>
                <button class="action-btn" onclick="window.unbanPlayerPrompt();" style="background: linear-gradient(135deg, #2ecc71, #27ae60);">✅ Unban Player</button>
                <button class="action-btn" onclick="window.globalAnnouncementPrompt();" style="background: linear-gradient(135deg, #34495e, #2c3e50);">📢 Global Announcement</button>
                <button class="action-btn" onclick="window.setServerTimePrompt();" style="background: linear-gradient(135deg, #f1c40f, #f39c12);">⏰ Set Server Time</button>
                <button class="action-btn" onclick="window.grantVIPPrompt();" style="background: linear-gradient(135deg, #9b59b6, #8e44ad);">👑 Grant VIP</button>
                <button class="action-btn" onclick="window.viewServerLogs();" style="background: linear-gradient(135deg, #2980b9, #3498db);">📄 View Logs</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
};

window.unlockAllBuildings = function() {
    // This is visual/logic mostly, as checks usually look at gameState.level
    // We can just set level high, or maybe bypass checks?
    // For now, setting level high is the easiest "unlock all"
    gameState.level = 50; 
    updateUI();
};

window.confirmResetServer = function() {
    if (confirm("Are you sure you want to WIPE ALL DATA? This cannot be undone.")) {
        localStorage.clear();
        location.reload();
    }
};

window.broadcastMessage = function() {
    const msg = prompt("Enter Broadcast Message:");
    if (msg) {
        if (typeof addChatMessage === 'function') {
            addChatMessage({ user: 'SERVER', text: msg, system: true });
        }
        showNotification("Broadcast Sent", 'success');
        // If connected to socket, emit it
        if (typeof chatSocket !== 'undefined' && chatSocket) {
            chatSocket.emit('chatMessage', { user: 'SERVER', text: msg });
        }
    }
};

window.promoteAdminPrompt = function() {
    const username = prompt("Enter player name to promote to Admin:");
    if (username) {
        // Persist Role
        const ROLES_KEY = 'farmSimRoles';
        const roles = JSON.parse(localStorage.getItem(ROLES_KEY) || '{}');
        roles[username] = 'admin';
        localStorage.setItem(ROLES_KEY, JSON.stringify(roles));

        showNotification(`Promoted ${username} to Admin!`, 'success');
        if (typeof addChatMessage === 'function') {
            addChatMessage({ user: 'SYSTEM', text: `${username} has been promoted to Admin by Owner!`, system: true });
        }
    }
};

window.giftDiamondsPrompt = function() {
    const username = prompt("Enter player name to gift Diamonds to:");
    if (username) {
        const amountStr = prompt("How many diamonds?", "100");
        const amount = parseInt(amountStr);
        if (amount && amount > 0) {
            if (typeof giveDiamondsToPlayer === 'function') {
                giveDiamondsToPlayer(username, amount);
            } else {
                // Fallback implementation
                showNotification(`Would gift ${amount} diamonds to ${username}`, 'info');
            }
        } else {
            showNotification("Invalid amount", "error");
        }
    }
};

window.harvestAllCrops = function() {
    // Example: Harvest all crops in gameState.buildings
    let harvested = 0;
    gameState.buildings.forEach(b => {
        const def = BuildingTypes[b.type];
        if (def && def.category === 'crop') {
            // Simulate harvest
            harvested++;
            // Add money or product as needed
            gameState.money += def.income || 10;
        }
    });
    window.updateUI();
    window.showNotification(`Harvested ${harvested} crops!`, 'success');
};

window.addXP = function(amount) {
    gameState.xp = (gameState.xp || 0) + amount;
    window.updateUI();
};

window.spawnAnimalPrompt = function() {
    const animal = prompt('Enter animal type to spawn (e.g. cow, chicken):');
    if (animal) {
        // Example: Add animal to gameState
        gameState.inventory[animal] = (gameState.inventory[animal] || 0) + 1;
        window.updateUI();
        window.showNotification(`Spawned 1 ${animal}!`, 'success');
    }
};

window.teleportPrompt = function() {
    const x = prompt('Enter X coordinate:');
    const z = prompt('Enter Z coordinate:');
    if (!isNaN(x) && !isNaN(z)) {
        gameState.playerX = Number(x);
        gameState.playerZ = Number(z);
        window.updateUI();
        window.showNotification(`Teleported to (${x}, ${z})`, 'info');
    }
};

window.toggleGodMode = function() {
    gameState.godMode = !gameState.godMode;
    window.updateUI();
};

window.banPlayerPrompt = function() {
    const username = prompt('Enter player name to ban:');
    if (username) {
        const ROLES_KEY = 'farmSimRoles';
        const roles = JSON.parse(localStorage.getItem(ROLES_KEY) || '{}');
        roles[username] = 'banned';
        localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
        window.showNotification(`${username} has been banned!`, 'error');
    }
};

window.unbanPlayerPrompt = function() {
    const username = prompt('Enter player name to unban:');
    if (username) {
        const ROLES_KEY = 'farmSimRoles';
        const roles = JSON.parse(localStorage.getItem(ROLES_KEY) || '{}');
        if (roles[username] === 'banned') {
            delete roles[username];
            localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
            window.showNotification(`${username} has been unbanned!`, 'success');
        }
    }
};

window.globalAnnouncementPrompt = function() {
    const msg = prompt('Enter global announcement:');
    if (msg) {
        window.broadcastMessage(msg);
    }
};

window.setServerTimePrompt = function() {
    const time = prompt('Enter new server time (e.g. 14:00):');
    if (time) {
        gameState.serverTime = time;
        window.updateUI();
        window.showNotification(`Server time set to ${time}`, 'info');
    }
};

window.grantVIPPrompt = function() {
    const username = prompt('Enter player name to grant VIP:');
    if (username) {
        const ROLES_KEY = 'farmSimRoles';
        const roles = JSON.parse(localStorage.getItem(ROLES_KEY) || '{}');
        roles[username] = 'vip';
        localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
        window.showNotification(`${username} is now VIP!`, 'success');
    }
};

window.viewServerLogs = function() {
    alert('Server logs feature coming soon!');
};
