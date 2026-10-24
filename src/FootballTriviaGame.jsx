import React, { useState, useEffect } from 'react';
import './index.css';
import { supabase } from './supabaseClient';

export default function FootballCardGame() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdminRegister, setIsAdminRegister] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('player'); // 'admin' หรือ 'player'
  const [authMode, setAuthMode] = useState('login'); // 'login' หรือ 'register'
  
  const [view, setView] = useState('mainMenu'); // mainMenu, lobby, customize, game
  const [roomPlayers, setRoomPlayers] = useState([]);
  const SINGLE_ROOM_ID = 1; // ห้องกลางถาวร

  // Categories and cards data
  const [categories, setCategories] = useState({
    position: [],
    league: [],
    nationality: []
  });

  // State สำหรับให้ Admin เพิ่มข้อมูลการ์ดใหม่
  const [selectedCategoryKey, setSelectedCategoryKey] = useState('position');
  const [newItemValue, setNewItemValue] = useState('');
  const [newItemImage, setNewItemImage] = useState('');

  useEffect(() => {
    loadCategoriesFromDB();
  }, []);

  // Realtime Subscribe สำหรับห้อง Lobby
  useEffect(() => {
    if (isLoggedIn && view === 'lobby') {
      const channel = supabase.channel(`room-fixed-${SINGLE_ROOM_ID}`)
        .on(
          'postgres_changes', 
          { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${SINGLE_ROOM_ID}` }, 
          () => {
            fetchRoomPlayers(SINGLE_ROOM_ID);
          }
        )
        .on(
          'postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${SINGLE_ROOM_ID}` }, 
          (payload) => {
            if (payload.new.status === 'playing') {
              setView('game');
            }
          }
        )
        .subscribe();

      fetchRoomPlayers(SINGLE_ROOM_ID);

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isLoggedIn, view]);

  const loadCategoriesFromDB = async () => {
    const { data } = await supabase.from('category_items').select(`id, item_value, image_url, categories (key_name)`);
    if (data && data.length > 0) {
      const formatted = { position: [], league: [], nationality: [] };
      data.forEach(item => {
        const key = item.categories?.key_name;
        if (formatted[key]) {
          formatted[key].push({ id: item.id, value: item.item_value, image: item.image_url || '' });
        }
      });
      setCategories(formatted);
    }
  };

  // ฟังก์ชันสมัครสมาชิก
  const handleRegister = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) return;
    if (cleanUsername.length > 8) {
      alert('Username must not exceed 8 characters.');
      return;
    }
    if (password.length !== 4) {
      alert('Password must be exactly 4 digits.');
      return;
    }

    const { data: existingUser } = await supabase.from('users').select('*').eq('username', cleanUsername).single();
    if (existingUser) {
      alert('This username is already taken.');
      return;
    }

    const roleToAssign = isAdminRegister ? 'admin' : 'player';

    const { error } = await supabase.from('users').insert([{ 
      username: cleanUsername, 
      password, 
      role: roleToAssign 
    }]);

    if (error) {
      alert('Registration failed.');
      return;
    }

    alert(`Registration successful as ${roleToAssign.toUpperCase()}! Please login.`);
    setAuthMode('login');
    setPassword('');
    setIsAdminRegister(false);
  };

  // ฟังก์ชัน Login (เข้าสู่หน้าหลัก)
  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) return;

    const { data: userData } = await supabase.from('users').select('*').eq('username', cleanUsername).single();
    if (!userData || userData.password !== password) {
      alert('Invalid username or 4-digit password.');
      return;
    }

    setIsLoggedIn(true);
    setUserRole(userData.role || 'player');
    setView('mainMenu');
  };

  // เข้าห้อง Lobby
  const joinRoom = async () => {
    const { data: activePlayers } = await supabase.from('room_players').select('*').eq('room_id', SINGLE_ROOM_ID);
    if (activePlayers && activePlayers.length >= 4) {
      alert('The room is full (maximum 4 players).');
      return;
    }

    if (activePlayers && activePlayers.some(p => p.username.toLowerCase() === username.toLowerCase())) {
      alert('You are already active in the room.');
      return;
    }

    const { error: joinError } = await supabase.from('room_players').insert([{ 
      room_id: SINGLE_ROOM_ID, 
      username: username, 
      score: 0, 
      hand: [] 
    }]);

    if (joinError) {
      alert('Failed to join the room.');
      return;
    }

    setView('lobby');
  };

  const fetchRoomPlayers = async (roomId) => {
    const { data: playersData } = await supabase.from('room_players').select('*').eq('room_id', roomId);
    if (playersData) {
      setRoomPlayers(playersData);
      if (isLoggedIn && view === 'lobby' && !playersData.some(p => p.username === username)) {
        handleLeaveRoomOnly();
      }
    }
  };

  // ออกจากห้องแต่ยังอยู่ในระบบ (กลับหน้า Main Menu)
  const handleLeaveRoomOnly = async () => {
    await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID).eq('username', username);
    setRoomPlayers([]);
    setView('mainMenu');
  };

  // Logout เต็มรูปแบบ (กลับหน้า Login)
  const handleLogoutClean = async () => {
    await handleLeaveRoomOnly();
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setUserRole('player');
  };

  // Admin เพิ่มไอเทมการ์ดใหม่
  const handleAddCardItem = async (e) => {
    e.preventDefault();
    if (!newItemValue.trim()) return;

    // หา category_id จาก key_name ('position', 'league', 'nationality')
    const { data: catData } = await supabase.from('categories').select('id').eq('key_name', selectedCategoryKey).single();
    if (!catData) {
      alert('Category not found.');
      return;
    }

    const { error } = await supabase.from('category_items').insert([{
      category_id: catData.id,
      item_value: newItemValue.trim(),
      image_url: newItemImage.trim()
    }]);

    if (error) {
      alert('Failed to add item.');
      return;
    }

    alert('Card item added successfully!');
    setNewItemValue('');
    setNewItemImage('');
    loadCategoriesFromDB();
  };

  const isHost = roomPlayers.length > 0 && roomPlayers[0].username === username;

  // Host เริ่มเกม
  const startGame = async () => {
    if (roomPlayers.length < 2) {
      alert('Need at least 2 players to start the game.');
      return;
    }

    const keys = Object.keys(categories);
    const updatedPlayers = roomPlayers.map(p => {
      const hand = [];
      for (let j = 0; j < 10; j++) {
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        const itemList = categories[randomKey];
        if (itemList && itemList.length > 0) {
          const randomItem = itemList[Math.floor(Math.random() * itemList.length)];
          hand.push({ type: randomKey, value: randomItem.value, image: randomItem.image });
        }
      }
      return { ...p, hand, score: 0 };
    });

    const posList = categories.position;
    const leaList = categories.league;
    const natList = categories.nationality;
    const initialTable = {
      position: posList[Math.floor(Math.random() * posList.length)],
      league: leaList[Math.floor(Math.random() * leaList.length)],
      nationality: natList[Math.floor(Math.random() * natList.length)]
    };

    await supabase.from('rooms').upsert({ 
      id: SINGLE_ROOM_ID,
      name: 'Main Lobby',
      host: roomPlayers[0].username,
      status: 'playing', 
      players_data: updatedPlayers,
      table_cards: initialTable,
      current_turn: 0
    });
  };

  // 1. หน้าจอ Login / Register
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-2 text-emerald-400">⚽ Football Trivia Game</h1>
          <p className="text-xs text-slate-400 mb-6">
            {authMode === 'login' ? 'Login to your account' : 'Create a new account'}
          </p>

          <div className="flex bg-slate-700 p-1 rounded-xl mb-6">
            <button 
              onClick={() => { setAuthMode('login'); setPassword(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${authMode === 'login' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Login
            </button>
            <button 
              onClick={() => { setAuthMode('register'); setPassword(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${authMode === 'register' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister}>
            <input 
              type="text" 
              maxLength={8}
              placeholder="Username (Max 8 chars)" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-center text-white mb-3 focus:outline-none focus:border-emerald-400 font-bold text-sm"
              required
            />
            <input 
              type="password" 
              maxLength={4}
              placeholder="4-Digit Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-center text-white mb-4 focus:outline-none focus:border-emerald-400 font-bold tracking-widest text-sm"
              required
            />

            {authMode === 'register' && (
              <div className="flex items-center justify-center gap-2 mb-6 text-xs text-slate-300">
                <input 
                  type="checkbox" 
                  id="adminCheck"
                  checked={isAdminRegister}
                  onChange={(e) => setIsAdminRegister(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                />
                <label htmlFor="adminCheck" className="cursor-pointer">Register as Admin 🛡️</label>
              </div>
            )}

            <button type="submit" className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition cursor-pointer text-sm shadow">
              {authMode === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col justify-between font-sans">
      <div className="flex-1 flex flex-col items-center justify-center">
        
        {/* 2. หน้าหลัก (Main Menu) */}
        {view === 'mainMenu' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h1 className="text-2xl font-bold mb-1 text-emerald-400">Welcome, {username}!</h1>
            <p className="text-xs text-slate-400 mb-6">Role: <span className="uppercase font-bold text-yellow-400">{userRole}</span></p>

            <div className="space-y-3">
              <button 
                onClick={joinRoom}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition shadow cursor-pointer text-sm"
              >
                🎮 Join Game Room
              </button>

              {/* เมนูจัดการข้อมูลเฉพาะ Admin */}
              {userRole === 'admin' && (
                <button 
                  onClick={() => setView('customize')}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition shadow cursor-pointer text-sm"
                >
                  ⚙️ Customize Card Data (Admin)
                </button>
              )}

              <button 
                onClick={handleLogoutClean}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 font-bold rounded-xl transition cursor-pointer text-sm text-red-400"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        )}

        {/* 3. หน้า Lobby รอผู้เล่น */}
        {view === 'lobby' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-2xl font-bold mb-2 text-emerald-400">Main Game Lobby</h2>
            <p className="text-xs text-slate-400 mb-6">Waiting for players to join (2-4 players)</p>

            <div className="bg-slate-700/50 p-4 rounded-xl mb-6 text-left border border-slate-600">
              <h4 className="text-xs font-bold text-slate-300 mb-2 uppercase">Players in room ({roomPlayers.length}/4):</h4>
              <div className="space-y-2">
                {roomPlayers.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-700 p-2 rounded-lg text-sm">
                    <span>{idx === 0 ? '👑' : '👤'} {p.username} {idx === 0 ? '(Host)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleLeaveRoomOnly} className="w-1/2 py-3 bg-red-600/80 hover:bg-red-600 font-bold rounded-xl text-sm transition cursor-pointer">
                Back to Menu
              </button>
              {isHost ? (
                <button 
                  onClick={startGame} 
                  disabled={roomPlayers.length < 2}
                  className="w-1/2 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl text-sm transition cursor-pointer shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Game 🚀
                </button>
              ) : (
                <div className="w-1/2 flex items-center justify-center text-xs text-slate-400 italic">
                  Waiting for host...
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. หน้า Customize ข้อมูลการ์ดสำหรับ Admin */}
        {view === 'customize' && userRole === 'admin' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-lg w-full">
            <h2 className="text-xl font-bold mb-2 text-emerald-400 text-center">⚙️ Admin Card Management</h2>
            <p className="text-xs text-slate-400 mb-6 text-center">Add new items and images to category pools</p>

            <form onSubmit={handleAddCardItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Select Category:</label>
                <select 
                  value={selectedCategoryKey} 
                  onChange={(e) => setSelectedCategoryKey(e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:border-emerald-400"
                >
                  <option value="position">Position (ตำแหน่ง)</option>
                  <option value="league">League (ลีก)</option>
                  <option value="nationality">Nationality (สัญชาติ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Item Value / Name:</label>
                <input 
                  type="text" 
                  placeholder="e.g. Forward, Premier League, Brazil" 
                  value={newItemValue}
                  onChange={(e) => setNewItemValue(e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Image URL (Optional):</label>
                <input 
                  type="text" 
                  placeholder="https://example.com/image.png" 
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setView('mainMenu')} 
                  className="w-1/2 py-3 bg-slate-700 hover:bg-slate-600 font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  Back to Menu
                </button>
                <button 
                  type="submit" 
                  className="w-1/2 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl text-sm transition cursor-pointer shadow"
                >
                  Add Item ➕
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 5. Game View Placeholder */}
        {view === 'game' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-2xl font-bold mb-4 text-emerald-400">🎮 Game Started!</h2>
            <p className="text-sm text-slate-300 mb-6">Match is in progress...</p>
            <button onClick={handleLogoutClean} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-sm font-bold rounded-xl">
              Exit Game
            </button>
          </div>
        )}

      </div>

      <footer className="w-full text-center py-4 text-xs text-slate-500 mt-6 border-t border-slate-800">
        © 2026 L88PER. Role-Based Auth & Session Active.
      </footer>
    </div>
  );
}