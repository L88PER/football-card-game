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

  const [gameState, setGameState] = useState('lobby'); // lobby, customize, countdown, playing, transition, finished
  const [countdownTime, setCountdownTime] = useState(10);

  const [currentTurn, setCurrentTurn] = useState(0); 
  const [tableCards, setTableCards] = useState({
    position: null,
    league: null,
    nationality: null
  });

  const [turnPhase, setTurnPhase] = useState('placing'); // placing, answering, stealing, paused
  const [timeLeft, setTimeLeft] = useState(20);
  const [lastPlayedCard, setLastPlayedCard] = useState(null);
  const [stealingPlayerId, setStealingPlayerId] = useState(null);
  const [winner, setWinner] = useState(null);
  const [feedback, setFeedback] = useState('');
  
  const [transitionTime, setTransitionTime] = useState(5);
  const [nextPlayerName, setNextPlayerName] = useState('');
  const [newValues, setNewValues] = useState({
    position: '',
    league: '',
    nationality: ''
  });

  useEffect(() => {
    loadCategoriesFromDB();
    if (isLoggedIn && username) {
      checkAndRestoreSession();
    }
  }, []);

  const checkAndRestoreSession = async () => {
    const { data: activePlayers } = await supabase.from('room_players').select('*').eq('room_id', SINGLE_ROOM_ID);
    if (activePlayers) {
      const alreadyInRoom = activePlayers.some(p => p.username === username);
      if (!alreadyInRoom && activePlayers.length < 4) {
        await supabase.from('room_players').insert([{ 
          room_id: SINGLE_ROOM_ID, 
          username: username, 
          score: 0, 
          hand: [] 
        }]);
      }
    }
  };

  // 1. Realtime Subscribe สำหรับซิงค์ผู้เล่น
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

  // 2. Polling เช็คสถานะห้องทุกๆ 1 วินาที
  useEffect(() => {
    if (!isLoggedIn) return;

    const roomInterval = setInterval(async () => {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', SINGLE_ROOM_ID)
        .single();

      if (roomData) {
        if (roomData.status === 'countdown' && gameState === 'lobby') {
          if (roomData.players_data) setRoomPlayers(roomData.players_data);
          if (roomData.table_cards) setTableCards(roomData.table_cards);
          setGameState('countdown');
          setCountdownTime(10);
        } else if (roomData.status === 'playing' && (gameState === 'lobby' || gameState === 'countdown')) {
          if (roomData.players_data) setRoomPlayers(roomData.players_data);
          if (roomData.table_cards) setTableCards(roomData.table_cards);
          setGameState('playing');
        }
      }
    }, 1000);

    return () => clearInterval(roomInterval);
  }, [isLoggedIn, gameState]);

  // นับถอยหลัง 10 วิ ก่อนเข้าเกม
  useEffect(() => {
    if (gameState !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdownTime(prev => {
        if (prev > 1) return prev - 1;
        setGameState('playing');
        return 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  // ควบคุม Timer ในหน้าเล่นเกม (Placing 20s และ Stealing 10s)
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (turnPhase === 'answering') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev > 1) return prev - 1;

        if (turnPhase === 'placing') {
          triggerTransition('หมดเวลาวางการ์ด (20s)! เทิร์นตกไปผู้เล่นถัดไป');
          return 0;
        } else if (turnPhase === 'stealing') {
          handleNoStealTimeout();
          return 0;
        }
        return 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, turnPhase, currentTurn, lastPlayedCard]);

  // หน้าจอ Transition ระหว่างเทิร์น (5 วิ)
  useEffect(() => {
    if (gameState !== 'transition') return;

    const transTimer = setInterval(() => {
      setTransitionTime(prev => {
        if (prev > 1) return prev - 1;
        
        setCurrentTurn(nextTurnIdx);
        setStealingPlayerId(null);
        setFeedback('');
        setLastPlayedCard(null);
        setTurnPhase('placing');
        setTimeLeft(20);
        setGameState('playing');
        return 0;
      });
    }, 1000);

    return () => clearInterval(transTimer);
  }, [gameState]);

  const nextTurnIdx = roomPlayers.length > 0 ? (currentTurn + 1) % roomPlayers.length : 0;

  const triggerTransition = (msg) => {
    setFeedback(msg);
    if (roomPlayers.length > 0) {
      setNextPlayerName(roomPlayers[nextTurnIdx]?.username || roomPlayers[nextTurnIdx]?.name);
    }
    setTransitionTime(5);
    setGameState('transition');
  };

  const handleNoStealTimeout = () => {
    if (lastPlayedCard && roomPlayers[currentTurn]) {
      const player = roomPlayers[currentTurn];
      const returnedHand = [...(player.hand || []), lastPlayedCard];
      setRoomPlayers(roomPlayers.map((p, idx) => idx === currentTurn ? { ...p, hand: returnedHand } : p));
      setLastPlayedCard(null);
    }
    triggerTransition(`ตอบไม่ได้และไม่มีคน Steal (-1 คะแนน, การ์ดกลับเข้ามือ)`);
  };

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

    const { data: activePlayers } = await supabase.from('room_players').select('*').eq('room_id', SINGLE_ROOM_ID);
    if (activePlayers && activePlayers.length >= 4) {
      alert('The room is full (maximum 4 players).');
      return;
    }

    if (activePlayers && activePlayers.some(p => p.username.toLowerCase() === cleanUsername.toLowerCase())) {
      alert('This username is already active in the room.');
      return;
    }

    const { error: joinError } = await supabase.from('room_players').insert([{ 
      room_id: SINGLE_ROOM_ID, 
      username: cleanUsername, 
      score: 0, 
      hand: [] 
    }]);

    if (joinError) {
      alert('Failed to join the room.');
      return;
    }

    const assignedRole = userData.role || 'player';

    setCookie('fc_username', cleanUsername);
    setCookie('fc_role', assignedRole);

    setUsername(cleanUsername);
    setUserRole(assignedRole);
    setIsLoggedIn(true);
    setGameState('lobby');
  };

  const fetchRoomPlayers = async (roomId) => {
    const { data: playersData } = await supabase.from('room_players').select('*').eq('room_id', roomId);
    if (playersData) {
      setRoomPlayers(playersData);
    }
  };

  const handleLogoutClean = async () => {
    if (username) {
      await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID).eq('username', username);
    }
    deleteCookie('fc_username');
    deleteCookie('fc_role');

    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setUserRole('player');
    setRoomPlayers([]);
    setGameState('lobby');
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

  // ลอจิกการเล่นเกม (วางการ์ด, ตอบถูก/ผิด, Steal)
  const handleSelectCard = (cardIdx) => {
    if (turnPhase !== 'placing') return;
    executePlayCard(cardIdx);
  };

  const executePlayCard = (cardIdx) => {
    const player = roomPlayers[currentTurn];
    const card = player.hand[cardIdx];

    setLastPlayedCard(card);
    setTableCards(prev => ({
      ...prev,
      [card.type]: card
    }));

    const updatedHand = player.hand.filter((_, idx) => idx !== cardIdx);
    setRoomPlayers(roomPlayers.map((p, idx) => idx === currentTurn ? { ...p, hand: updatedHand } : p));

    setFeedback('');
    setTurnPhase('answering');
  };

  const handleSkipTurn = () => {
    if (turnPhase !== 'placing') return;
    setTurnPhase('paused'); 
    triggerTransition(`${roomPlayers[currentTurn]?.username || roomPlayers[currentTurn]?.name} ข้ามเทิร์น`);
  };

  const handleOwnerAnswerCorrect = () => {
    const player = roomPlayers[currentTurn];
    const newScore = (player.score || 0) + 1;
    setLastPlayedCard(null);
    updateScoreAndCheckWin(currentTurn, newScore, `${player.username || player.name} ตอบถูก! (+1 คะแนน)`);
  };

  const handleOwnerAnswerWrong = () => {
    const updatedPlayers = roomPlayers.map((p, idx) => idx === currentTurn ? { ...p, score: (p.score || 0) - 1 } : p);
    setRoomPlayers(updatedPlayers);
    setTurnPhase('stealing');
    setTimeLeft(10);
  };

  const handleStealClick = (playerId) => {
    setStealingPlayerId(playerId);
  };

  const handleStealCorrect = () => {
    const pIdx = roomPlayers.findIndex(p => p.id === stealingPlayerId || p.username === stealingPlayerId);
    const stealingPlayer = roomPlayers[pIdx];
    const newScore = (stealingPlayer.score || 0) + 1;
    
    const updatedPlayers = roomPlayers.map((p, idx) => idx === pIdx ? { ...p, score: newScore } : p);
    setRoomPlayers(updatedPlayers);
    
    setLastPlayedCard(null);
    triggerTransition(`${stealingPlayer.username || stealingPlayer.name} Steal สำเร็จ! (+1 คะแนน)`);
  };

  const handleStealWrong = () => {
    const pIdx = roomPlayers.findIndex(p => p.id === stealingPlayerId || p.username === stealingPlayerId);
    const stealingPlayer = roomPlayers[pIdx];
    const updatedPlayers = roomPlayers.map((p, idx) => idx === pIdx ? { ...p, score: (p.score || 0) - 1 } : p);
    setRoomPlayers(updatedPlayers);
    
    setLastPlayedCard(null);
    triggerTransition(`${stealingPlayer.username || stealingPlayer.name} Steal ผิด! (-1 คะแนน)`);
  };

  const updateScoreAndCheckWin = (playerIdx, newScore, msg) => {
    const updatedPlayers = roomPlayers.map((p, idx) => idx === playerIdx ? { ...p, score: newScore } : p);
    setRoomPlayers(updatedPlayers);

    const currentPlayer = updatedPlayers[playerIdx];

    if (newScore >= 3 && currentPlayer.hand?.length === 0) {
      setWinner(currentPlayer);
      setGameState('finished');
    } else {
      triggerTransition(msg);
    }
  };

  const startGameHost = async () => {
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
      return { id: idx + 1, username: p.username || p.name, name: p.username || p.name, score: 0, hand };
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
    setTableCards(initialTable);
    setCurrentTurn(0);
    setWinner(null);
    setFeedback('');
    setLastPlayedCard(null);

    await supabase.from('rooms').upsert({ 
      id: SINGLE_ROOM_ID,
      name: 'Main Lobby',
      host: roomPlayers[0].username,
      status: 'countdown', 
      players_data: updatedPlayers,
      table_cards: initialTable,
      current_turn: 0
    });

    setGameState('countdown');
    setCountdownTime(10);
  };

  const isHost = roomPlayers.length > 0 && roomPlayers[0].username === username;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-2 text-emerald-400">⚽ Football Trivia Game</h1>
          <p className="text-xs text-slate-400 mb-6">
            {authMode === 'login' ? 'Login to join the room' : 'Create a new account'}
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
              {authMode === 'login' ? 'Login & Join Room' : 'Sign Up'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col justify-between font-sans">
      
      <div className="flex-1 flex flex-col items-center justify-center">
        
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
                    <span>{idx === 0 ? '👑' : '👤'} {p.username || p.name} {idx === 0 ? '(Host)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {userRole === 'admin' && (
                <button 
                  onClick={() => setGameState('customize')}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl transition cursor-pointer text-sm shadow"
                >
                  ⚙️ จัดการข้อมูลและรูปภาพการ์ด (Admin)
                </button>
              )}

              <div className="flex gap-3">
                <button 
                  onClick={handleLogoutClean}
                  className="w-1/2 py-3 bg-red-600/80 hover:bg-red-600 font-bold rounded-xl transition cursor-pointer text-sm"
                >
                  Logout
                </button>
                {isHost ? (
                  <button 
                    onClick={startGameHost}
                    disabled={roomPlayers.length < 2}
                    className="w-1/2 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition shadow-lg cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* หน้าจอ Transition 5s */}
        {gameState === 'transition' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center animate-fadeIn">
            <h2 className="text-2xl font-bold mb-3 text-amber-400">⏳ จบเทิร์นนี้</h2>
            <p className="text-slate-200 text-lg mb-4 font-medium">{feedback}</p>

            <div className="text-slate-400 text-sm">
              กำลังเริ่มตาถัดไปใน <span className="text-yellow-400 font-bold text-lg">{transitionTime}</span> วินาที...
            </div>
          </div>
        )}

        {/* หน้าจอเล่นเกมปกติ (มีปุ่มวางการ์ด ปุ่มตอบ และปุ่ม Steal ครบถ้วน) */}
        {gameState === 'playing' && (
          <div className="max-w-4xl w-full flex flex-col gap-6">
            
            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl shadow">
              <div>
                <span className="text-slate-400 text-sm">Current Turn:</span>
                <div className="text-xl font-bold text-emerald-400">{roomPlayers[currentTurn]?.username || roomPlayers[currentTurn]?.name}</div>
              </div>
              <div className="flex gap-4">
                {roomPlayers.map((p, idx) => (
                  <div key={idx} className={`text-center px-3 py-1 rounded-lg ${idx === currentTurn ? 'bg-emerald-500/20 border border-emerald-500' : ''}`}>
                    <div className="text-xs text-slate-400">{p.username || p.name}</div>
                    <div className={`text-lg font-bold ${(p.score || 0) < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {p.score || 0} pts ({p.hand?.length || 0} cards)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-xl shadow flex flex-col items-center justify-center relative">
              <div className="absolute top-4 right-4 bg-slate-700 px-3 py-1 rounded-full text-yellow-400 font-bold text-sm">
                {turnPhase === 'answering' ? (
                  <span className="text-emerald-400">🎤 Answer Phase (No Time Limit)</span>
                ) : (
                  `⏳ Time: ${timeLeft}s (${turnPhase === 'placing' ? 'Think & Place (20s)' : 'Steal Phase (10s)'})`
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

              {turnPhase === 'placing' && (
                <div className="text-center">
                  <p className="text-emerald-300 font-medium mb-2 animate-pulse">
                    👉 {roomPlayers[currentTurn]?.username || roomPlayers[currentTurn]?.name} เลือกการ์ดในมือเพื่อวางลงโต๊ะ (ภายใน {timeLeft} วินาที)
                  </p>
                  <button 
                    onClick={handleSkipTurn}
                    className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs cursor-pointer border border-slate-600"
                  >
                    ไม่มีการ์ดลง / ข้ามเทิร์น
                  </button>
                </div>
              )}

              {turnPhase === 'answering' && (
                <div className="text-center bg-slate-700/80 p-4 rounded-xl w-full">
                  <p className="text-yellow-300 font-bold mb-2">🎤 {roomPlayers[currentTurn]?.username || roomPlayers[currentTurn]?.name} กำลังตอบชื่อนักเตะ (ไม่จำกัดเวลา)</p>
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

              {turnPhase === 'stealing' && !stealingPlayerId && (
                <div className="text-center bg-amber-500/20 border border-amber-500/50 p-4 rounded-xl w-full">
                  <p className="text-amber-300 font-bold mb-2">⚡ เจ้าของเทิร์นตอบผิด! ผู้เล่นคนอื่นกด Steal เพื่อแย่งตอบได้ ({timeLeft}s)</p>
                  <div className="flex gap-3 justify-center flex-wrap">
                    {roomPlayers.filter((_, idx) => idx !== currentTurn).map(p => (
                      <button key={p.id} onClick={() => handleStealClick(p.id)} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 font-bold rounded-lg text-sm cursor-pointer">
                        {p.username || p.name} Steal!
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {stealingPlayerId && (
                <div className="text-center bg-slate-700 p-4 rounded-xl w-full">
                  <p className="text-yellow-300 font-bold mb-2">⚡ {roomPlayers.find(p => p.id === stealingPlayerId || p.username === stealingPlayerId)?.username || roomPlayers.find(p => p.id === stealingPlayerId || p.username === stealingPlayerId)?.name} กำลังแย่งตอบ (Steal)!</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={handleStealCorrect} className="px-4 py-2 bg-green-600 hover:bg-green-500 font-bold rounded-lg text-sm cursor-pointer">
                      Steal สำเร็จ (+1)
                    </button>
                    <button onClick={handleStealWrong} className="px-4 py-2 bg-red-600 hover:bg-red-500 font-bold rounded-lg text-sm cursor-pointer">
                      Steal ผิด (-1)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-800 p-4 rounded-xl shadow">
              <h4 className="font-bold mb-3 text-emerald-300">
                Hand of <span className="text-yellow-400">{roomPlayers[currentTurn]?.username || roomPlayers[currentTurn]?.name}</span> 
                {turnPhase === 'placing' ? ' (Click card to play)' : ''}
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {roomPlayers[currentTurn]?.hand?.map((card, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => turnPhase === 'placing' && handleSelectCard(idx)}
                    className={`p-3 rounded-lg min-w-[120px] text-center transition transform flex flex-col items-center ${
                      turnPhase === 'placing' ? 'bg-slate-700 hover:bg-slate-600 cursor-pointer hover:-translate-y-1 border border-emerald-500/50' : 'bg-slate-800 opacity-50'
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

        {/* หน้าจอ Customize (Admin) */}
        {gameState === 'customize' && userRole === 'admin' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-2xl w-full">
            <h2 className="text-2xl font-bold mb-2 text-emerald-400 text-center">⚙️ จัดการข้อมูลและรูปภาพการ์ด (SQL)</h2>
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
              onClick={() => setGameState('lobby')}
              className="w-full mt-6 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition cursor-pointer shadow-lg text-sm"
            >
              บันทึกและกลับสู่ล็อบบี้
            </button>
          </div>
        )}

        {/* หน้าจอจบเกม */}
        {gameState === 'finished' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-3xl font-bold mb-2 text-emerald-400">🎉 Winner!</h2>
            <p className="text-xl text-yellow-400 font-bold mb-6">{winner?.username || winner?.name} wins the game!</p>
            
            <button 
              onClick={() => setGameState('lobby')}
              className="w-full mt-4 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition cursor-pointer"
            >
              Back to Lobby
            </button>
          </div>
        )}

      </div>

      <footer className="w-full text-center py-4 text-xs text-slate-500 mt-6 border-t border-slate-800">
        © 2026 L88PER. All rights reserved.
      </footer>

    </div>
  );
}