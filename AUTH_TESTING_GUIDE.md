# Farm Life 3D - Authentication Testing Guide

## Latest Fixes Applied

### 1. **Login Error Fixed**
- Added better error handling in `gameLogin()` and `gameCreateAccount()` functions
- Improved error messages to show actual error details (not just generic messages)
- Added try-catch blocks around user save loading
- Fixed timing issues with async game initialization

### 2. **User Roles System**
Added three default users with roles:

| Username | Password | Role |
|----------|----------|------|
| Alex | Ampulamare5 | Owner 👑 |
| Adi | password123 | Admin 🛡️ |
| Eka | password123 | Admin 🛡️ |

These users are automatically created on first game load via the `ensureDefaultAdmins()` function.

---

## How to Test

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- The game files in a folder
- A local web server to serve the files

### Option 1: Using Python (if installed)
```bash
# Navigate to the game folder
cd "c:\Users\AlexMarius\Downloads\Farm Life 3D V2.8"

# Python 3
python -m http.server 8000

# Or Python 2
python -m SimpleHTTPServer 8000
```

Then open: `http://localhost:8000`

### Option 2: Using Live Server (VS Code Extension)
1. Open the folder in VS Code
2. Install "Live Server" extension by Ritwick Dey
3. Right-click on `index.html` and select "Open with Live Server"
4. The game will automatically open in your browser

### Option 3: Using Node.js (if installed)
```bash
npm install
npm start
```

---

## Test Cases

### Test 1: Login as Owner (Alex)
1. **Username:** Alex
2. **Password:** Ampulamare5
3. **Expected Result:**
   - Login successful ✓
   - Game loads with farm scene
   - Owner Panel button (👑) appears in HUD
   - Can access special owner-only features

### Test 2: Login as Admin (Adi)
1. **Username:** Adi
2. **Password:** password123
3. **Expected Result:**
   - Login successful ✓
   - Game loads with farm scene
   - Admin Panel button (🛡️) appears in HUD
   - Can access admin features (add money, level up, etc.)

### Test 3: Login as Admin (Eka)
1. **Username:** Eka
2. **Password:** password123
3. **Expected Result:**
   - Login successful ✓
   - Game loads with farm scene
   - Admin Panel button (🛡️) appears in HUD
   - Can access admin features

### Test 4: Create New Account
1. Click "Create Account" tab
2. **Username:** testuser
3. **Email:** testuser@example.com
4. **Password:** password123
5. **Confirm:** password123
6. **Expected Result:**
   - Account created ✓
   - Login successful ✓
   - Game loads with fresh farm (only main house, no buildings)
   - New account shows "Create Account" button

### Test 5: Reset Password
1. Click "Reset" tab
2. **Username:** testuser (from Test 4)
3. **Email:** testuser@example.com
4. **Expected Result:**
   - Message shows temporary password ✓
   - Can now login with that temporary password
   - Redirects to login tab automatically after 3 seconds

### Test 6: Incorrect Password
1. **Username:** Alex
2. **Password:** wrongpassword
3. **Expected Result:**
   - Error message: "Incorrect password for Owner" ✓
   - Login fails, stays on login page

### Test 7: User Not Found
1. **Username:** nonexistentuser
2. **Password:** anypassword
3. **Expected Result:**
   - Error message: "User not found. Please Create Account." ✓
   - Login fails, stays on login page

---

## Features to Verify

### After Successful Login

#### HUD Elements
- ✓ Player name displayed in top-left
- ✓ Money ($) displayed
- ✓ Diamonds (💎) displayed
- ✓ Level displayed
- ✓ XP progress bar visible

#### Buttons in HUD
- ✓ Chat button (🤖) - Opens AI chat
- ✓ Tutorial button (🎓) - Shows interactive tutorial
- ✓ Build menu button (🏗️)
- ✓ Settings button (⚙️)
- ✓ Admin/Owner buttons appear based on role

#### Owner Panel Features (Alex only)
- 👑 Owner-only commands
- Full server control
- View admin logs
- User management

#### Admin Panel Features (Adi & Eka)
- 🛡️ Add coins (+10K)
- Add diamonds (+1K)
- Level up to 10
- Level up to 20
- Unlock all buildings
- Change weather
- Gift diamonds to players

---

## Troubleshooting

### Issue: "Login error: undefined"
**Solution:** 
- Clear browser cache (Ctrl+Shift+Delete in Chrome)
- Check browser console (F12 → Console tab)
- Verify game.js and index.html are loaded

### Issue: Game doesn't load after login
**Solution:**
- Check browser console for errors
- Verify Three.js library is loaded
- Check that renderer exists: `console.log(window.renderer)`
- Try refreshing the page

### Issue: Admin panel buttons don't appear
**Solution:**
- Make sure user is logged in
- Verify roles are set in localStorage:
  - Open DevTools (F12)
  - Go to Application tab → Local Storage
  - Check `farmSimRoles` key has the expected values

### Check Local Storage
```javascript
// In browser console (F12 → Console)

// Check users
console.log(JSON.parse(localStorage.getItem('farmSimUsers')));

// Check roles
console.log(JSON.parse(localStorage.getItem('farmSimRoles')));

// Check current player
console.log(localStorage.getItem('currentPlayer'));

// Check player save
console.log(JSON.parse(localStorage.getItem('farmSimSave_Alex')));
```

---

## Browser DevTools Console Debugging

Open browser console (F12 or F12 → Console) to check:

```javascript
// See all logged-in users
JSON.parse(localStorage.getItem('farmSimUsers'))

// See all user roles
JSON.parse(localStorage.getItem('farmSimRoles'))

// Check if game functions exist
console.log(window.gameLogin)
console.log(window.gameCreateAccount)
console.log(window.initGame)
console.log(window.startGame)

// Try login manually
window.gameLogin('Alex', 'Ampulamare5')

// Check current game state
console.log(gameState)
console.log(currentUser)
```

---

## Key Fixes Made

1. ✅ **Error Handling:** Added try-catch with detailed error messages
2. ✅ **Auth Functions:** Fixed gameLogin() and gameCreateAccount() 
3. ✅ **Role System:** Integrated owner/admin roles with localStorage
4. ✅ **User Creation:** Default users (Alex, Adi, Eka) auto-created on init
5. ✅ **Window Exports:** Exported helper functions for HTML to access
6. ✅ **Timing:** Proper delays for Three.js initialization
7. ✅ **Fallback:** localStorage fallback if game.js functions unavailable

---

## Success Indicators

✅ Can login with correct credentials  
✅ Game scene loads after login  
✅ HUD displays player information  
✅ Can create new account  
✅ Can reset password  
✅ Owner/Admin panels appear for respective users  
✅ 3D farm scene renders properly  
✅ Move/sell/build buttons work  
✅ No console errors (F12 to check)  

---

## Contact & Support

If you encounter any issues:
1. Check the browser console (F12 → Console tab) for error messages
2. Verify all files are in the correct folder
3. Clear browser cache
4. Try a different browser
5. Check that Three.js library is loaded

