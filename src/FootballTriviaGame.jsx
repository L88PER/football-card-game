import React, { useState, useEffect } from 'react';
import './index.css';
import { supabase } from './supabaseClient';

export default function FootballCardGame() {
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
  };

  const setCookie = (name, value) => {
    document.cookie = `${name}=${value}; path=/; SameSite=Lax`;
  };

  const deleteCookie = (name) => {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  };

  const [username, setUsername] = useState(() => getAppCookie('fc_username'));
  const [userRole, setUserRole] = useState(() => getAppCookie('fc_role') || 'player');
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getAppCookie('fc_username'));

  function getAppCookie(name) {
    try {
      return getCookie(name);
    } catch {
      return '';
    }
  }

  const [password, setPassword] = useState('');
  const [isAdminRegister, setIsAdminRegister] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const [roomPlayers, setRoomPlayers] = useState([]);
  const SINGLE_ROOM_ID = 1;

  const [categories, setCategories] = useState({
    position: [],
    league: [],
    nationality: []
  });

  const [gameState, setGameState] = useState('mainMenu'); 
  const [countdownTime, setCountdownTime] = useState(10);
  const [initialPlayerCount, setInitialPlayerCount] = useState(0);

  const [currentTurn, setCurrentTurn] = useState(0); 
  const [tableCards, setTableCards] = useState({
    position: null,
    league: null,
    nationality: null
  });

  const [turnPhase, setTurnPhase] = useState('placing'); 
  const [timeLeft, setTimeLeft] = useState(20);
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState(null);
  
  const [newValues, setNewValues] = useState({
    position: '',
    league: '',
    nationality: ''
  });

  useEffect(() => {
    loadCategoriesFromDB();
  }, [isLoggedIn]);

  const syncGameState = (roomData) => {
    if (!roomData) {
      setGameState('mainMenu');
      return;
    }

    if (roomData.status === 'waiting' && gameState !== 'countdown' && gameState !== 'playing' && gameState !== 'customize') {
      setGameState('lobby');
    } else if (roomData.status === 'countdown') {
      setGameState('countdown');
      if (roomData.countdown_time !== undefined) setCountdownTime(roomData.countdown_time);
    } else if (roomData.status === 'playing') {
      setGameState('playing');
    } else if (roomData.status === 'finished') {
      setGameState('finished');
      if (roomData.winner_data) setWinner(roomData.winner_data);
    }

    if (roomData.players_data) {
      setRoomPlayers(roomData.players_data);
      setInitialPlayerCount(roomData.players_data.length);
    }

    if (roomData.table_cards) setTableCards(roomData.table_cards);
    if (roomData.current_turn !== undefined) setCurrentTurn(roomData.current_turn);
    if (roomData.turn_phase) setTurnPhase(roomData.turn_phase);
    if (roomData.time_left !== undefined) setTimeLeft(roomData.time_left);
    if (roomData.is_paused !== undefined) setIsPaused(roomData.is_paused);
  };

  const joinRoomProcess = async (uname) => {
    const { data: activePlayers } = await supabase.from('room_players').select('*').eq('room_id', SINGLE_ROOM_ID);
    if (activePlayers) {
      const existingPlayer = activePlayers.find(p => p.username.toLowerCase() === uname.toLowerCase());
      if (!existingPlayer) {
        if (activePlayers.length >= 4) {
          alert('The room is full (maximum 4 players).');
          return;
        }
        await supabase.from('room_players').insert([{ 
          room_id: SINGLE_ROOM_ID, 
          username: uname, 
          score: 0, 
          hand: [] 
        }]);
      }
    }
    fetchRoomPlayers(SINGLE_ROOM_ID);
  };

  const fetchRoomPlayers = async (roomId) => {
    const { data: playersData } = await supabase.from('room_players').select('*').eq('room_id', roomId);
    if (playersData) {
      setRoomPlayers(playersData);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      const channel = supabase.channel(`room-fixed-${SINGLE_ROOM_ID}`)
        .on(
          'postgres_changes', 
          { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${SINGLE_ROOM_ID}` }, 
          () => {
            fetchRoomPlayers(SINGLE_ROOM_ID);
          }
        )
        .subscribe();

      fetchRoomPlayers(SINGLE_ROOM_ID);

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isLoggedIn]);

  // Polling กลางสำหรับซิงค์สถานะห้อง
  useEffect(() => {
    if (!isLoggedIn) return;

    const roomInterval = setInterval(async () => {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', SINGLE_ROOM_ID)
        .single();

      if (!roomData) {
        if (gameState === 'lobby' || gameState === 'playing' || gameState === 'countdown' || gameState === 'finished') {
          setGameState('mainMenu');
          setRoomPlayers([]);
        }
        return;
      }

      // ตรวจสอบว่า Admin ยังอยู่ในห้องจริงไหม (ถ้า Admin ออก ให้ลบห้องทิ้ง)
      const { data: activePlayers } = await supabase.from('room_players').select('*').eq('room_id', SINGLE_ROOM_ID);
      if (activePlayers) {
        const adminStillInRoom = activePlayers.some(p => p.username.toLowerCase() === roomData.host?.toLowerCase());
        if (!adminStillInRoom) {
          await supabase.from('rooms').delete().eq('id', SINGLE_ROOM_ID);
          await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID);
          setGameState('mainMenu');
          setRoomPlayers([]);
          alert('Admin ออกจากห้อง ห้องถูกปิด');
          return;
        }
      }

      syncGameState(roomData);

      if (gameState === 'lobby') {
        fetchRoomPlayers(SINGLE_ROOM_ID);
      }
    }, 1000);

    return () => clearInterval(roomInterval);
  }, [isLoggedIn, gameState]);

  const handleLogoutClean = async () => {
    if (username) {
      if (userRole === 'admin') {
        await supabase.from('rooms').delete().eq('id', SINGLE_ROOM_ID);
      }
      await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID).eq('username', username);
    }
    deleteCookie('fc_username');
    deleteCookie('fc_role');

    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setUserRole('player');
    setRoomPlayers([]);
    setGameState('mainMenu');
  };

  const handleLeaveRoom = async () => {
    if (username) {
      if (userRole === 'admin') {
        await supabase.from('rooms').delete().eq('id', SINGLE_ROOM_ID);
      }
      await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID).eq('username', username);
    }
    setGameState('mainMenu');
    setRoomPlayers([]);
  };

  const handleAdminCreateRoom = async () => {
    await supabase.from('rooms').delete().eq('id', SINGLE_ROOM_ID);
    await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID);

    const { error } = await supabase.from('rooms').insert([{
      id: SINGLE_ROOM_ID,
      name: 'Main Lobby',
      host: username,
      status: 'waiting',
      is_paused: false
    }]);

    if (error) {
      alert('Failed to create room.');
      return;
    }

    await joinRoomProcess(username);
    setGameState('lobby');
  };

  const handleJoinRoom = async () => {
    const { data: roomData } = await supabase.from('rooms').select('*').eq('id', SINGLE_ROOM_ID).single();
    if (!roomData) {
      alert('ยังไม่มีห้องที่ Admin สร้างในขณะนี้ กรุณารอ Admin สร้างห้อง');
      return;
    }

    await joinRoomProcess(username);
    setGameState('lobby');
  };

  const handleAdminEndGame = async () => {
    if (userRole !== 'admin') return;
    if (!window.confirm('คุณต้องการปิดห้องนี้ใช่หรือไม่? ผู้เล่นทั้งหมดจะถูกส่งกลับไปหน้าหลัก')) return;

    await supabase.from('rooms').delete().eq('id', SINGLE_ROOM_ID);
    await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID);

    setGameState('mainMenu');
    setIsPaused(false);
    setWinner(null);
    setRoomPlayers([]);
  };

  const togglePauseGame = async () => {
    if (userRole !== 'admin') return;
    const newPauseState = !isPaused;
    setIsPaused(newPauseState);

    await supabase.from('rooms').update({ is_paused: newPauseState }).eq('id', SINGLE_ROOM_ID);
  };

  // ตัวจัดการเวลา (เฉพาะ Admin รัน Timer)
  useEffect(() => {
    if (!isLoggedIn || userRole !== 'admin') return;
    if (isPaused) return;
    if (gameState !== 'countdown' && gameState !== 'playing') return;

    const timer = setInterval(async () => {
      if (gameState === 'countdown') {
        if (countdownTime > 1) {
          const nextCount = countdownTime - 1;
          setCountdownTime(nextCount);
          await supabase.from('rooms').update({ countdown_time: nextCount }).eq('id', SINGLE_ROOM_ID);
        } else {
          setGameState('playing');
          setTimeLeft(20);
          setTurnPhase('placing');
          await supabase.from('rooms').update({ 
            status: 'playing', 
            time_left: 20, 
            turn_phase: 'placing' 
          }).eq('id', SINGLE_ROOM_ID);
        }
      } else if (gameState === 'playing') {
        if (turnPhase === 'answering') return;

        if (timeLeft > 1) {
          const nextTime = timeLeft - 1;
          setTimeLeft(nextTime);
          await supabase.from('rooms').update({ time_left: nextTime }).eq('id', SINGLE_ROOM_ID);
        } else {
          const nextTurn = (currentTurn + 1) % roomPlayers.length;
          setCurrentTurn(nextTurn);
          setTimeLeft(20);
          setTurnPhase('placing');

          await supabase.from('rooms').update({
            current_turn: nextTurn,
            time_left: 20,
            turn_phase: 'placing'
          }).eq('id', SINGLE_ROOM_ID);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, countdownTime, timeLeft, turnPhase, currentTurn, roomPlayers, userRole, isPaused]);

  const loadCategoriesFromDB = async () => {
    const { data, error } = await supabase
      .from('category_items')
      .select(`
        id,
        item_value,
        image_url,
        categories (key_name)
      `);

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

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

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) return;

    const { data: userData } = await supabase.from('users').select('*').eq('username', cleanUsername).single();
    if (!userData || userData.password !== password) {
      alert('Invalid username or 4-digit password.');
      return;
    }

    const assignedRole = userData.role || 'player';

    setCookie('fc_username', cleanUsername);
    setCookie('fc_role', assignedRole);

    setUsername(cleanUsername);
    setUserRole(assignedRole);
    setIsLoggedIn(true);
    setGameState('mainMenu'); // เข้าหน้าหลักก่อนเสมอ
  };

  const handleImageUpload = async (categoryKey, itemIndex, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const item = categories[categoryKey][itemIndex];
    const fileExt = file.name.split('.').pop();
    const fileName = `${categoryKey}-${item.id}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('card-images')
      .upload(fileName, file);

    if (uploadError) {
      alert('อัปโหลดรูปไม่สำเร็จ: ' + uploadError.message);
      return;
    }

    const { data: publicURLData } = supabase.storage
      .from('card-images')
      .getPublicUrl(fileName);

    const publicUrl = publicURLData.publicUrl;

    const { error: updateError } = await supabase
      .from('category_items')
      .update({ image_url: publicUrl })
      .eq('id', item.id);

    if (updateError) {
      alert('บันทึกลงฐานข้อมูลไม่สำเร็จ');
      return;
    }

    const updatedCategories = { ...categories };
    updatedCategories[categoryKey][itemIndex].image = publicUrl;
    setCategories(updatedCategories);
  };

  const handleAddItem = async (categoryKey) => {
    const val = newValues[categoryKey].trim();
    if (!val) return;

    const exists = categories[categoryKey].some(item => item.value.toLowerCase() === val.toLowerCase());
    if (exists) {
      alert('มีข้อมูลนี้อยู่ในระบบแล้ว!');
      return;
    }

    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('key_name', categoryKey)
      .single();

    if (catError) {
      alert('ไม่พบหมวดหมู่ในฐานข้อมูล');
      return;
    }

    const { data, error } = await supabase
      .from('category_items')
      .insert([{ category_id: catData.id, item_value: val, image_url: '' }])
      .select();

    if (error) {
      alert('เพิ่มข้อมูลไม่สำเร็จ: ' + error.message);
      return;
    }

    const newItem = { id: data[0].id, value: data[0].item_value, image: '' };
    setCategories({
      ...categories,
      [categoryKey]: [...categories[categoryKey], newItem]
    });

    setNewValues({ ...newValues, [categoryKey]: '' });
  };

  const isMyTurn = roomPlayers[currentTurn]?.username?.toLowerCase() === username.toLowerCase();

  const handleSelectCard = async (cardIdx) => {
    if (isPaused || !isMyTurn || turnPhase !== 'placing') return;
    
    const player = roomPlayers[currentTurn];
    const card = player.hand[cardIdx];
    const updatedHand = player.hand.filter((_, idx) => idx !== cardIdx);

    const updatedTable = {
      ...tableCards,
      [card.type]: card
    };

    const updatedPlayers = roomPlayers.map((p, idx) => idx === currentTurn ? { ...p, hand: updatedHand } : p);
    setRoomPlayers(updatedPlayers);
    setTableCards(updatedTable);
    setTurnPhase('answering');

    await supabase.from('rooms').update({
      table_cards: updatedTable,
      players_data: updatedPlayers,
      turn_phase: 'answering'
    }).eq('id', SINGLE_ROOM_ID);
  };

  const handleSkipTurn = async () => {
    if (isPaused || !isMyTurn || turnPhase !== 'placing') return;
    const nextTurn = (currentTurn + 1) % roomPlayers.length;
    setCurrentTurn(nextTurn);
    setTimeLeft(20);
    setTurnPhase('placing');

    await supabase.from('rooms').update({
      current_turn: nextTurn,
      time_left: 20,
      turn_phase: 'placing'
    }).eq('id', SINGLE_ROOM_ID);
  };

  const handleOwnerAnswerCorrect = async () => {
    if (isPaused || !isMyTurn) return;
    const player = roomPlayers[currentTurn];
    const newScore = (player.score || 0) + 1;
    const updatedPlayers = roomPlayers.map((p, idx) => idx === currentTurn ? { ...p, score: newScore } : p);
    
    if (newScore >= 3 && player.hand?.length === 0) {
      setWinner(player);
      setGameState('finished');
      await supabase.from('rooms').update({
        status: 'finished',
        winner_data: player,
        players_data: updatedPlayers
      }).eq('id', SINGLE_ROOM_ID);
      return;
    }

    const nextTurn = (currentTurn + 1) % roomPlayers.length;
    setRoomPlayers(updatedPlayers);
    setCurrentTurn(nextTurn);
    setTimeLeft(20);
    setTurnPhase('placing');

    await supabase.from('rooms').update({
      players_data: updatedPlayers,
      current_turn: nextTurn,
      time_left: 20,
      turn_phase: 'placing'
    }).eq('id', SINGLE_ROOM_ID);
  };

  const handleOwnerAnswerWrong = async () => {
    if (isPaused || !isMyTurn) return;
    const updatedPlayers = roomPlayers.map((p, idx) => idx === currentTurn ? { ...p, score: (p.score || 0) - 1 } : p);
    
    const nextTurn = (currentTurn + 1) % roomPlayers.length;
    setRoomPlayers(updatedPlayers);
    setCurrentTurn(nextTurn);
    setTimeLeft(20);
    setTurnPhase('placing');

    await supabase.from('rooms').update({
      players_data: updatedPlayers,
      current_turn: nextTurn,
      time_left: 20,
      turn_phase: 'placing'
    }).eq('id', SINGLE_ROOM_ID);
  };

  const startGameHost = async () => {
    if (userRole !== 'admin') {
      alert('Only Admin can start the game.');
      return;
    }
    if (roomPlayers.length < 2) {
      alert('Need at least 2 players to start the game.');
      return;
    }

    const keys = Object.keys(categories);
    const updatedPlayers = roomPlayers.map((p, idx) => {
      const hand = [];
      for (let j = 0; j < 10; j++) {
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        const itemList = categories[randomKey];
        if (itemList && itemList.length > 0) {
          const randomItem = itemList[Math.floor(Math.random() * itemList.length)];
          hand.push({ type: randomKey, value: randomItem.value, image: randomItem.image });
        }
      }
      return { id: idx + 1, username: p.username, score: 0, hand };
    });

    const posList = categories.position;
    const leaList = categories.league;
    const natList = categories.nationality;
    const initialTable = {
      position: posList[Math.floor(Math.random() * posList.length)],
      league: leaList[Math.floor(Math.random() * leaList.length)],
      nationality: natList[Math.floor(Math.random() * natList.length)]
    };

    setRoomPlayers(updatedPlayers);
    setInitialPlayerCount(updatedPlayers.length);
    setTableCards(initialTable);
    setCurrentTurn(0);
    setWinner(null);
    setIsPaused(false);
    setCountdownTime(10);
    setGameState('countdown');

    await supabase.from('rooms').upsert({ 
      id: SINGLE_ROOM_ID,
      name: 'Main Lobby',
      host: username,
      status: 'countdown', 
      countdown_time: 10,
      players_data: updatedPlayers,
      table_cards: initialTable,
      current_turn: 0,
      turn_phase: 'placing',
      time_left: 20,
      is_paused: false,
      winner_data: null
    });
  };

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
      
      {gameState === 'playing' && isPaused && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-3 animate-bounce">⏸️</div>
          <h2 className="text-3xl font-bold text-amber-400 mb-2">เกมถูกหยุดชั่วคราว</h2>
          <p className="text-slate-300 text-sm mb-6">
            {userRole === 'admin' ? 'คุณสามารถกดปุ่มด้านล่างเพื่อเริ่มเกมต่อได้ทันที' : 'กรุณารอ Admin กดเล่นต่อเพื่อดำเนินการแข่งขัน...'}
          </p>

          {userRole === 'admin' && (
            <button 
              onClick={togglePauseGame}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition cursor-pointer text-base animate-pulse"
            >
              ▶️ เล่นต่อ (Resume Game)
            </button>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center">
        
        {/* หน้าหลัก (Main Menu) สำหรับทุกคน */}
        {gameState === 'mainMenu' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h1 className="text-2xl font-bold mb-2 text-emerald-400">⚽ Football Trivia Game</h1>
            <p className="text-xs text-slate-400 mb-6">ยินดีต้อนรับ, {username} ({userRole.toUpperCase()})</p>

            <div className="space-y-3">
              {userRole === 'admin' ? (
                <>
                  <button 
                    onClick={handleAdminCreateRoom}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition shadow cursor-pointer text-sm"
                  >
                    🏠 สร้างห้องเกมใหม่ (Create Room)
                  </button>
                  <button 
                    onClick={() => setGameState('customize')}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition cursor-pointer text-sm shadow"
                  >
                    ⚙️ ตั้งค่าข้อมูลและรูปการ์ด (Admin Settings)
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleJoinRoom}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition shadow cursor-pointer text-sm"
                >
                  🚪 เข้าร่วมห้องเกม (Join Room)
                </button>
              )}

              <button 
                onClick={handleLogoutClean}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 font-bold rounded-xl transition cursor-pointer text-sm text-red-400"
              >
                ออกจากระบบ (Logout)
              </button>
            </div>
          </div>
        )}

        {/* 1. Lobby */}
        {gameState === 'lobby' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h1 className="text-2xl font-bold mb-2 text-emerald-400">Main Game Lobby</h1>
            <p className="text-xs text-slate-400 mb-6">Welcome, {username} ({userRole.toUpperCase()}) - Waiting for players (2-4)</p>
            
            <div className="bg-slate-700/50 p-4 rounded-xl mb-6 text-left border border-slate-600">
              <h4 className="text-xs font-bold text-slate-300 mb-2 uppercase">Players in room ({roomPlayers.length}/4):</h4>
              <div className="space-y-2">
                {roomPlayers.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-700 p-2 rounded-lg text-sm">
                    <span>{userRole === 'admin' && p.username === username ? '👑' : '👤'} {p.username}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button 
                  onClick={handleLeaveRoom}
                  className="w-1/2 py-3 bg-red-600/80 hover:bg-red-600 font-bold rounded-xl transition cursor-pointer text-sm"
                >
                  🚪 ออกจากห้อง (Leave)
                </button>
                {userRole === 'admin' ? (
                  <button 
                    onClick={startGameHost}
                    disabled={roomPlayers.length < 2}
                    className="w-1/2 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition shadow-lg cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Game 🚀
                  </button>
                ) : (
                  <div className="w-1/2 flex items-center justify-center text-xs text-slate-400 italic">
                    Waiting for Admin to start...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. หน้าจอนับถอยหลัง 10 วินาที */}
        {gameState === 'countdown' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center animate-fadeIn">
            <h2 className="text-2xl font-bold mb-3 text-emerald-400">🚀 เตรียมตัวให้พร้อม!</h2>
            <p className="text-slate-300 text-sm mb-6">เกมกำลังจะเริ่มต้นขึ้นในอีก...</p>
            
            <div className="text-6xl font-black text-yellow-400 mb-6 animate-pulse">
              {countdownTime}
            </div>

            <p className="text-xs text-slate-400 italic">กำลังพาผู้เล่นทุกคนเข้าสู่สนามแข่งขัน...</p>
          </div>
        )}

        {/* หน้าจอเล่นเกมปกติ */}
        {gameState === 'playing' && (
          <div className="max-w-4xl w-full flex flex-col gap-6">
            
            {userRole === 'admin' && (
              <div className="bg-slate-800 p-3 rounded-xl shadow flex justify-between items-center border border-amber-500/50 flex-wrap gap-2">
                <span className="text-xs text-amber-400 font-bold">🛡️ Admin Control Panel</span>
                <div className="flex gap-2">
                  <button 
                    onClick={startGameHost}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow"
                    title="เริ่มเกมใหม่ทันที"
                  >
                    🔄 Restart
                  </button>
                  <button 
                    onClick={togglePauseGame}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow ${
                      isPaused ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isPaused ? '▶️ เล่นต่อ' : '⏸️ หยุด'}
                  </button>
                  <button 
                    onClick={handleAdminEndGame}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow"
                    title="ยกเลิกและลบห้อง"
                  >
                    🛑 ปิดห้อง (End Room)
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl shadow">
              <div>
                <span className="text-slate-400 text-sm">Current Turn:</span>
                <div className="text-xl font-bold text-emerald-400">
                  {roomPlayers[currentTurn]?.username} {isMyTurn ? '(Your Turn!)' : ''}
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex gap-4">
                  {roomPlayers.map((p, idx) => (
                    <div key={idx} className={`text-center px-3 py-1 rounded-lg ${idx === currentTurn ? 'bg-emerald-500/20 border border-emerald-500' : ''}`}>
                      <div className="text-xs text-slate-400">{p.username}</div>
                      <div className={`text-lg font-bold ${(p.score || 0) < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {p.score || 0} pts ({p.hand?.length || 0} cards)
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleLeaveRoom}
                  className="px-3 py-2 bg-red-600/80 hover:bg-red-600 text-xs font-bold rounded-lg transition cursor-pointer ml-2"
                  title="กลับหน้าหลัก"
                >
                  🏠 หน้าหลัก
                </button>
              </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-xl shadow flex flex-col items-center justify-center relative">
              <div className="absolute top-4 right-4 bg-slate-700 px-3 py-1 rounded-full text-yellow-400 font-bold text-sm">
                {turnPhase === 'answering' ? (
                  <span className="text-emerald-400">🎤 Answer Phase (No Time Limit)</span>
                ) : (
                  `⏳ Time: ${timeLeft}s (Think & Place)`
                )}
              </div>

              <h3 className="text-slate-400 mb-4">Table Conditions (Guess a player matching all 3!)</h3>
              <div className="flex gap-4 flex-wrap justify-center mb-6">
                {['position', 'league', 'nationality'].map((type) => {
                  const card = tableCards[type];
                  return (
                    <div key={type} className="bg-emerald-600 p-4 rounded-lg shadow-md text-center min-w-[130px] flex flex-col items-center">
                      <div className="text-xs text-emerald-200 uppercase">{type}</div>
                      <div className="w-12 h-12 my-2 bg-emerald-700 rounded-lg overflow-hidden flex items-center justify-center border border-emerald-400/50 shadow-inner">
                        {card?.image ? (
                          <img src={card.image} alt={card.value} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-emerald-200">⚽</span>
                        )}
                      </div>
                      <div className="text-sm font-bold mt-1">{card?.value || '-'}</div>
                    </div>
                  );
                })}
              </div>

              {isMyTurn && turnPhase === 'placing' && (
                <div className="text-center">
                  <p className="text-emerald-300 font-medium mb-2 animate-pulse">
                    👉 ตาของคุณ! คลิกเลือกการ์ดในมือเพื่อวางลงโต๊ะ
                  </p>
                  <button 
                    onClick={handleSkipTurn}
                    className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs cursor-pointer border border-slate-600"
                  >
                    ข้ามเทิร์นนี้
                  </button>
                </div>
              )}

              {!isMyTurn && turnPhase === 'placing' && (
                <div className="text-center text-slate-400 text-sm italic">
                  ⏳ รอ {roomPlayers[currentTurn]?.username} วางการ์ด...
                </div>
              )}

              {isMyTurn && turnPhase === 'answering' && (
                <div className="text-center bg-slate-700/80 p-4 rounded-xl w-full">
                  <p className="text-yellow-300 font-bold mb-2">🎤 คุณกำลังตอบชื่อนักเตะ</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={handleOwnerAnswerCorrect} className="px-4 py-2 bg-green-600 hover:bg-green-500 font-bold rounded-lg text-sm cursor-pointer">
                      ตอบถูก (+1 คะแนน)
                    </button>
                    <button onClick={handleOwnerAnswerWrong} className="px-4 py-2 bg-red-600 hover:bg-red-500 font-bold rounded-lg text-sm cursor-pointer">
                      ตอบผิด (-1 คะแนน)
                    </button>
                  </div>
                </div>
              )}

              {!isMyTurn && turnPhase === 'answering' && (
                <div className="text-center text-slate-300 text-sm italic">
                  🎤 {roomPlayers[currentTurn]?.username} กำลังตอบคำถาม...
                </div>
              )}
            </div>

            <div className="bg-slate-800 p-4 rounded-xl shadow">
              <h4 className="font-bold mb-3 text-emerald-300">
                Hand of <span className="text-yellow-400">{username} (Your Cards)</span>
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {roomPlayers.find(p => p.username?.toLowerCase() === username.toLowerCase())?.hand?.map((card, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => !isPaused && isMyTurn && turnPhase === 'placing' && handleSelectCard(idx)}
                    className={`p-3 rounded-lg min-w-[120px] text-center transition transform flex flex-col items-center ${
                      !isPaused && isMyTurn && turnPhase === 'placing' ? 'bg-slate-700 hover:bg-slate-600 cursor-pointer hover:-translate-y-1 border border-emerald-500/50' : 'bg-slate-800 opacity-60'
                    }`}
                  >
                    <div className="text-[10px] text-slate-400 uppercase">{card.type}</div>
                    <div className="w-10 h-10 my-1 bg-slate-800 rounded overflow-hidden flex items-center justify-center border border-slate-600">
                      {card.image ? (
                        <img src={card.image} alt={card.value} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs">⚽</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white mt-1">{card.value}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* หน้าจอ Customize (Admin Settings) */}
        {gameState === 'customize' && userRole === 'admin' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-2xl w-full">
            <h2 className="text-2xl font-bold mb-2 text-emerald-400 text-center">⚙️ ตั้งค่าข้อมูลและรูปภาพการ์ด (Admin Settings)</h2>
            <p className="text-slate-300 text-xs mb-6 text-center">เพิ่มข้อมูลใหม่และอัปโหลดรูปภาพเก็บลงฐานข้อมูลถาวร</p>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              {Object.keys(categories).map((catKey) => (
                <div key={catKey} className="bg-slate-700/50 p-4 rounded-xl border border-slate-600">
                  <h3 className="text-emerald-300 font-bold uppercase text-sm mb-3">{catKey}</h3>
                  
                  <div className="flex gap-2 mb-3">
                    <input 
                      type="text" 
                      placeholder={`เพิ่ม ${catKey} ใหม่...`}
                      value={newValues[catKey]}
                      onChange={(e) => setNewValues({ ...newValues, [catKey]: e.target.value })}
                      className="flex-1 p-2 rounded bg-slate-700 border border-slate-600 text-xs focus:outline-none focus:border-emerald-400"
                    />
                    <button 
                      onClick={() => handleAddItem(catKey)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold rounded cursor-pointer transition"
                    >
                      + เพิ่ม
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {categories[catKey].map((item, idx) => (
                      <div key={item.id || idx} className="bg-slate-700 p-2 rounded-lg flex flex-col items-center gap-2 border border-slate-600">
                        <div className="w-12 h-12 bg-slate-800 rounded flex items-center justify-center overflow-hidden border border-slate-500">
                          {item.image ? (
                            <img src={item.image} alt={item.value} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-slate-400">No Img</span>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-center truncate w-full">{item.value}</span>
                        <label className="text-[10px] bg-emerald-600 hover:bg-emerald-500 px-2 py-1 rounded cursor-pointer font-bold transition">
                          Choose File
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleImageUpload(catKey, idx, e)}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setGameState('mainMenu')}
              className="w-full mt-6 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition cursor-pointer shadow-lg text-sm"
            >
              บันทึกและกลับสู่หน้าหลัก
            </button>
          </div>
        )}

        {/* หน้าจอจบเกม */}
        {gameState === 'finished' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-3xl font-bold mb-2 text-emerald-400">🎉 Winner!</h2>
            <p className="text-xl text-yellow-400 font-bold mb-6">{winner?.username} wins the game!</p>
            
            <div className="flex flex-col gap-3">
              {userRole === 'admin' && (
                <button 
                  onClick={startGameHost}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition cursor-pointer shadow"
                >
                  🔄 เริ่มเกมใหม่ (Restart Game)
                </button>
              )}
              <button 
                onClick={handleAdminEndGame}
                className="w-full py-3 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-xl transition cursor-pointer"
              >
                🚪 กลับสู่หน้าหลัก (Main Menu)
              </button>
            </div>
          </div>
        )}

      </div>

      <footer className="w-full text-center py-4 text-xs text-slate-500 mt-6 border-t border-slate-800">
        © 2026 L88PER. Main Menu & Manual Room Creation Active.
      </footer>

    </div>
  );
}