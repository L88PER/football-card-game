import React, { useState, useEffect, useRef } from 'react';
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

  const playSound = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'place') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } else if (type === 'bounce') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'whistle') {
        const now = ctx.currentTime;
        [2400, 2600].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.15);
          gain.gain.setValueAtTime(0.2, now + i * 0.15);
          gain.gain.linearRampToValueAtTime(0.01, now + i * 0.15 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.15);
          osc.stop(now + i * 0.15 + 0.25);
        });
      } else if (type === 'correct') {
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.2, now + i * 0.08);
          gain.gain.linearRampToValueAtTime(0.01, now + i * 0.08 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.2);
        });
      } else if (type === 'wrong') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.25);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'join') {
        const now = ctx.currentTime;
        [440, 880].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.1);
          gain.gain.setValueAtTime(0.2, now + i * 0.1);
          gain.gain.linearRampToValueAtTime(0.01, now + i * 0.1 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.25);
        });
      } else if (type === 'leave') {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.linearRampToValueAtTime(250, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'victory') {
        const now = ctx.currentTime;
        [523.25, 587.33, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
          gain.gain.setValueAtTime(0.25, now + i * 0.12);
          gain.gain.linearRampToValueAtTime(0.01, now + i * 0.12 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.3);
        });
      }
    } catch (e) {
      console.error('Audio play error:', e);
    }
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
  const [hasAdminExists, setHasAdminExists] = useState(false);

  const [roomPlayers, setRoomPlayers] = useState([]);
  const prevPlayersLengthRef = useRef(0);
  const lastSoundEventRef = useRef(null);
  const SINGLE_ROOM_ID = 1;

  const [categories, setCategories] = useState({
    position: [],
    league: [],
    nationality: []
  });

  const [gameState, setGameState] = useState('mainMenu'); 
  const [countdownTime, setCountdownTime] = useState(0); 
  const [initialPlayerCount, setInitialPlayerCount] = useState(0);

  const [currentTurn, setCurrentTurn] = useState(0); 
  const [tableCards, setTableCards] = useState({
    position: null,
    league: null,
    nationality: null
  });

  const [turnPhase, setTurnPhase] = useState('placing'); 
  const [timeLeft, setTimeLeft] = useState(30); 
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState(null);
  
  const [selectedCardToConfirm, setSelectedCardToConfirm] = useState(null);

  const [newValues, setNewValues] = useState({
    position: '',
    league: '',
    nationality: ''
  });

  useEffect(() => {
    loadCategoriesFromDB();
    checkAdminExists();
  }, [authMode]);

  const checkAdminExists = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('role', 'admin');

    if (!error && data && data.length > 0) {
      setHasAdminExists(true);
    } else {
      setHasAdminExists(false);
    }
  };

  const syncGameState = (roomData) => {
    if (!roomData) {
      if (gameState !== 'mainMenu' && gameState !== 'customize') {
        setGameState('mainMenu');
        setRoomPlayers([]);
        prevPlayersLengthRef.current = 0;
      }
      return;
    }

    if (roomData.sound_event && roomData.sound_event !== lastSoundEventRef.current) {
      lastSoundEventRef.current = roomData.sound_event;
      if (roomData.sound_event.startsWith('correct_')) playSound('correct');
      if (roomData.sound_event.startsWith('wrong_')) playSound('wrong');
      if (roomData.sound_event.startsWith('place_')) playSound('place');
      if (roomData.sound_event.startsWith('bounce_')) playSound('bounce');
      if (roomData.sound_event.startsWith('whistle_')) playSound('whistle');
    }

    if (roomData.status === 'countdown') {
      if (gameState !== 'countdown') {
        playSound('whistle');
      }
      setGameState('countdown');
      if (roomData.countdown_time !== undefined) setCountdownTime(roomData.countdown_time);
    } else if (roomData.status === 'playing') {
      setGameState('playing');
    } else if (roomData.status === 'finished') {
      if (gameState !== 'finished') {
        playSound('victory');
      }
      setGameState('finished');
      if (roomData.winner_data) setWinner(roomData.winner_data);
    }

    if (roomData.status !== 'waiting' && roomData.players_data) {
      const newLen = roomData.players_data.length;
      if (gameState === 'lobby') {
        if (newLen > prevPlayersLengthRef.current && prevPlayersLengthRef.current > 0) {
          playSound('join');
        } else if (newLen < prevPlayersLengthRef.current && prevPlayersLengthRef.current > 0) {
          playSound('leave');
        }
      }
      prevPlayersLengthRef.current = newLen;
      setRoomPlayers(roomData.players_data);
      setInitialPlayerCount(newLen);
    }

    if (roomData.table_cards) setTableCards(roomData.table_cards);
    if (roomData.current_turn !== undefined) setCurrentTurn(roomData.current_turn);
    if (roomData.turn_phase) setTurnPhase(roomData.turn_phase);
    if (roomData.time_left !== undefined) {
      if (roomData.time_left <= 5 && roomData.time_left > 0 && roomData.turn_phase === 'placing') {
        playSound('tick');
      }
      setTimeLeft(roomData.time_left);
    }
    if (roomData.is_paused !== undefined) setIsPaused(roomData.is_paused);
  };

  const joinRoomProcess = async (uname) => {
    const { data: activePlayers, error: fetchErr } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', SINGLE_ROOM_ID);

    if (fetchErr) {
      console.error('Error fetching players:', fetchErr);
      return false;
    }

    const existingPlayer = activePlayers?.find(p => p.username.toLowerCase() === uname.toLowerCase());
    
    if (!existingPlayer) {
      if (activePlayers && activePlayers.length >= 4) {
        alert('ห้องเต็มแล้ว (สูงสุด 4 คน)');
        return false;
      }
      const { error: insertErr } = await supabase.from('room_players').insert([{ 
        room_id: SINGLE_ROOM_ID, 
        username: uname, 
        score: 0, 
        hand: [] 
      }]);

      if (insertErr) {
        console.error('Error inserting player:', insertErr);
        alert('ไม่สามารถเข้าห้องได้');
        return false;
      }
    }
    await fetchRoomPlayers(SINGLE_ROOM_ID);
    return true;
  };

  const fetchRoomPlayers = async (roomId) => {
    const { data: playersData } = await supabase.from('room_players').select('*').eq('room_id', roomId);
    if (playersData) {
      const newLen = playersData.length;
      if (gameState === 'lobby') {
        if (newLen > prevPlayersLengthRef.current && prevPlayersLengthRef.current > 0) {
          playSound('join');
        } else if (newLen < prevPlayersLengthRef.current && prevPlayersLengthRef.current > 0) {
          playSound('leave');
        }
      }
      prevPlayersLengthRef.current = newLen;
      setRoomPlayers(playersData);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    const roomChannel = supabase.channel(`room-state-changes-${SINGLE_ROOM_ID}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${SINGLE_ROOM_ID}` },
        (payload) => {
          if (payload.new) {
            syncGameState(payload.new);
          }
        }
      )
      .subscribe();

    const playersChannel = supabase.channel(`room-players-changes-${SINGLE_ROOM_ID}`)
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${SINGLE_ROOM_ID}` }, 
        () => {
          if (gameState === 'lobby') {
            fetchRoomPlayers(SINGLE_ROOM_ID);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
    };
  }, [isLoggedIn, gameState]);

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
          prevPlayersLengthRef.current = 0;
        }
        return;
      }

      const { data: activePlayers } = await supabase.from('room_players').select('*').eq('room_id', SINGLE_ROOM_ID);
      if (activePlayers && activePlayers.length > 0) {
        const adminStillInRoom = activePlayers.some(p => p.username.toLowerCase() === roomData.host?.toLowerCase());
        if (!adminStillInRoom) {
          await supabase.from('rooms').delete().eq('id', SINGLE_ROOM_ID);
          await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID);
          setGameState('mainMenu');
          setRoomPlayers([]);
          prevPlayersLengthRef.current = 0;
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
    playSound('leave');
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
    prevPlayersLengthRef.current = 0;
    setGameState('mainMenu');
  };

  const handleLeaveRoom = async () => {
    playSound('leave');
    if (username) {
      if (userRole === 'admin') {
        await supabase.from('rooms').delete().eq('id', SINGLE_ROOM_ID);
      } else {
        await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID).eq('username', username);
      }
    }
    prevPlayersLengthRef.current = 0;
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
      alert('สร้างห้องไม่สำเร็จ');
      return;
    }

    const success = await joinRoomProcess(username);
    if (success) {
      prevPlayersLengthRef.current = 1;
      setGameState('lobby');
    }
  };

  const handleJoinRoom = async () => {
    const { data: roomData } = await supabase.from('rooms').select('*').eq('id', SINGLE_ROOM_ID).single();
    if (!roomData) {
      alert('ยังไม่มีห้องที่ Admin สร้างในขณะนี้');
      return;
    }

    const { data: activePlayers } = await supabase.from('room_players').select('*').eq('room_id', SINGLE_ROOM_ID);
    prevPlayersLengthRef.current = activePlayers ? activePlayers.length : 0;

    const success = await joinRoomProcess(username);
    if (success) {
      setGameState('lobby');
    }
  };

  const handleAdminEndGame = async () => {
    if (userRole !== 'admin') return;
    if (!window.confirm('ต้องการปิดห้องนี้และพาทุกคนกลับหน้าหลักใช่ไหม?')) return;

    await supabase.from('rooms').delete().eq('id', SINGLE_ROOM_ID);
    await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID);

    setGameState('mainMenu');
    setIsPaused(false);
    setWinner(null);
    setRoomPlayers([]);
    prevPlayersLengthRef.current = 0;
  };

  const togglePauseGame = async () => {
    if (userRole !== 'admin') return;
    const newPauseState = !isPaused;
    setIsPaused(newPauseState);

    await supabase.from('rooms').update({ is_paused: newPauseState }).eq('id', SINGLE_ROOM_ID);
  };

  useEffect(() => {
    if (!isLoggedIn || userRole !== 'admin') return;
    if (isPaused) return;
    if (gameState !== 'countdown' && gameState !== 'playing') return;

    const timer = setInterval(async () => {
      if (gameState === 'countdown') {
        if (countdownTime < 5) {
          const nextCount = countdownTime + 1;
          playSound('bounce');
          setCountdownTime(nextCount);
          await supabase.from('rooms').update({ 
            countdown_time: nextCount,
            sound_event: `bounce_${Date.now()}` 
          }).eq('id', SINGLE_ROOM_ID);
        } else {
          setGameState('playing');
          setTimeLeft(30);
          setTurnPhase('placing');
          await supabase.from('rooms').update({ 
            status: 'playing', 
            time_left: 30, 
            turn_phase: 'placing',
            countdown_time: 0 
          }).eq('id', SINGLE_ROOM_ID);
        }
      } else if (gameState === 'playing') {
        if (turnPhase === 'answering') return;

        if (timeLeft > 1) {
          const nextTime = timeLeft - 1;
          if (nextTime <= 5) playSound('tick');
          setTimeLeft(nextTime);
          await supabase.from('rooms').update({ time_left: nextTime }).eq('id', SINGLE_ROOM_ID);
        } else {
          const nextTurn = (currentTurn + 1) % roomPlayers.length;
          setCurrentTurn(nextTurn);
          setTimeLeft(30);
          setTurnPhase('placing');

          await supabase.from('rooms').update({
            current_turn: nextTurn,
            time_left: 30,
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
      alert('ชื่อผู้ใช้ต้องไม่เกิน 8 ตัวอักษร');
      return;
    }
    if (password.length !== 4) {
      alert('รหัสผ่านต้องเป็นตัวเลข 4 หลัก');
      return;
    }

    const { data: existingUser } = await supabase.from('users').select('*').eq('username', cleanUsername).single();
    if (existingUser) {
      alert('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
      return;
    }

    let roleToAssign = 'player';
    if (isAdminRegister) {
      const { data: checkAdmin } = await supabase.from('users').select('username').eq('role', 'admin');
      if (checkAdmin && checkAdmin.length > 0) {
        alert('ในระบบมี Admin อยู่แล้ว ไม่สามารถสมัครเป็น Admin ได้');
        return;
      }
      roleToAssign = 'admin';
    }

    const { error } = await supabase.from('users').insert([{ 
      username: cleanUsername, 
      password, 
      role: roleToAssign 
    }]);

    if (error) {
      alert('สมัครสมาชิกไม่สำเร็จ');
      return;
    }

    alert(`สมัครสมาชิกสำเร็จ (${roleToAssign.toUpperCase()}) กรุณาเข้าสู่ระบบ`);
    setAuthMode('login');
    setPassword('');
    setIsAdminRegister(false);
    checkAdminExists();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername) return;

    const { data: userData } = await supabase.from('users').select('*').eq('username', cleanUsername).single();
    if (!userData || userData.password !== password) {
      alert('ชื่อผู้ใช้หรือรหัสผ่าน 4 หลักไม่ถูกต้อง');
      return;
    }

    const assignedRole = userData.role || 'player';

    setCookie('fc_username', cleanUsername);
    setCookie('fc_role', assignedRole);

    setUsername(cleanUsername);
    setUserRole(assignedRole);
    setIsLoggedIn(true);
    setGameState('mainMenu');
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
      alert('มีข้อมูลนี้อยู่ในระบบแล้ว');
      return;
    }

    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('key_name', categoryKey)
      .single();

    if (catError) {
      alert('ไม่พบหมวดหมู่');
      return;
    }

    const { data, error } = await supabase
      .from('category_items')
      .insert([{ category_id: catData.id, item_value: val, image_url: '' }])
      .select();

    if (error) {
      alert('เพิ่มข้อมูลไม่สำเร็จ');
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

  const handleOpenConfirmModal = (cardIdx) => {
    if (isPaused || !isMyTurn || turnPhase !== 'placing') return;
    const player = roomPlayers[currentTurn];
    const card = player.hand[cardIdx];
    setSelectedCardToConfirm({ card, cardIdx });
  };

  const handleConfirmPlayCard = async () => {
    if (!selectedCardToConfirm) return;
    const { card, cardIdx } = selectedCardToConfirm;
    setSelectedCardToConfirm(null);

    playSound('place');

    const player = roomPlayers[currentTurn];
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
      turn_phase: 'answering',
      sound_event: `place_${Date.now()}`
    }).eq('id', SINGLE_ROOM_ID);
  };

  const handleSkipTurn = async () => {
    if (isPaused || !isMyTurn || turnPhase !== 'placing') return;
    const nextTurn = (currentTurn + 1) % roomPlayers.length;
    setCurrentTurn(nextTurn);
    setTimeLeft(30);
    setTurnPhase('placing');

    await supabase.from('rooms').update({
      current_turn: nextTurn,
      time_left: 30,
      turn_phase: 'placing'
    }).eq('id', SINGLE_ROOM_ID);
  };

  const handleAdminAnswerCorrect = async () => {
    if (userRole !== 'admin') return;
    playSound('correct');

    const player = roomPlayers[currentTurn];
    const newScore = (player.score || 0) + 1;
    const updatedPlayers = roomPlayers.map((p, idx) => idx === currentTurn ? { ...p, score: newScore } : p);
    
    if (newScore >= 3 && player.hand?.length === 0) {
      playSound('victory');
      setWinner(player);
      setGameState('finished');
      await supabase.from('rooms').update({
        status: 'finished',
        winner_data: player,
        players_data: updatedPlayers,
        sound_event: `correct_${Date.now()}`
      }).eq('id', SINGLE_ROOM_ID);
      return;
    }

    const nextTurn = (currentTurn + 1) % roomPlayers.length;
    setRoomPlayers(updatedPlayers);
    setCurrentTurn(nextTurn);
    setTimeLeft(30);
    setTurnPhase('placing');

    await supabase.from('rooms').update({
      players_data: updatedPlayers,
      current_turn: nextTurn,
      time_left: 30,
      turn_phase: 'placing',
      sound_event: `correct_${Date.now()}`
    }).eq('id', SINGLE_ROOM_ID);
  };

  const handleAdminAnswerWrong = async () => {
    if (userRole !== 'admin') return;
    playSound('wrong');

    const updatedPlayers = roomPlayers.map((p, idx) => idx === currentTurn ? { ...p, score: (p.score || 0) - 1 } : p);
    
    const nextTurn = (currentTurn + 1) % roomPlayers.length;
    setRoomPlayers(updatedPlayers);
    setCurrentTurn(nextTurn);
    setTimeLeft(30);
    setTurnPhase('placing');

    await supabase.from('rooms').update({
      players_data: updatedPlayers,
      current_turn: nextTurn,
      time_left: 30,
      turn_phase: 'placing',
      sound_event: `wrong_${Date.now()}`
    }).eq('id', SINGLE_ROOM_ID);
  };

  const startGameHost = async () => {
    if (userRole !== 'admin') {
      alert('เฉพาะ Admin เท่านั้นที่เริ่มเกมได้');
      return;
    }
    if (roomPlayers.length < 2) {
      alert('ต้องการผู้เล่นอย่างน้อย 2 คนเพื่อเริ่มเกม');
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
    setCountdownTime(0); 
    setGameState('countdown');
    playSound('whistle');

    await supabase.from('rooms').upsert({ 
      id: SINGLE_ROOM_ID,
      name: 'Main Lobby',
      host: username,
      status: 'countdown', 
      countdown_time: 0,
      players_data: updatedPlayers,
      table_cards: initialTable,
      current_turn: 0,
      turn_phase: 'placing',
      time_left: 30,
      is_paused: false,
      winner_data: null,
      sound_event: `whistle_${Date.now()}`
    });
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center">
          <div className="text-4xl mb-2">⚽</div>
          <h1 className="text-xl font-black mb-1 text-emerald-400 tracking-wide">FOOTBALL TRIVIA</h1>
          <p className="text-xs text-slate-400 mb-6">
            {authMode === 'login' ? 'เข้าสู่ระบบเพื่อเล่นเกม' : 'สมัครสมาชิกใหม่'}
          </p>

          <div className="flex bg-slate-800 p-1 rounded-2xl mb-6 border border-slate-700">
            <button 
              onClick={() => { setAuthMode('login'); setPassword(''); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${authMode === 'login' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              เข้าสู่ระบบ
            </button>
            <button 
              onClick={() => { setAuthMode('register'); setPassword(''); checkAdminExists(); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${authMode === 'register' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              สมัครสมาชิก
            </button>
          </div>

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-3.5">
            <input 
              type="text" 
              maxLength={8}
              placeholder="Username (สูงสุด 8 ตัว)" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-center text-white focus:outline-none focus:border-emerald-400 font-bold text-sm shadow-inner"
              required
            />
            <input 
              type="password" 
              maxLength={4}
              placeholder="รหัสผ่าน (ตัวเลข 4 หลัก)" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-center text-white focus:outline-none focus:border-emerald-400 font-bold tracking-widest text-sm shadow-inner"
              required
            />

            {authMode === 'register' && !hasAdminExists && (
              <div className="flex items-center justify-center gap-2 py-1 text-xs text-slate-300">
                <input 
                  type="checkbox" 
                  id="adminCheck"
                  checked={isAdminRegister}
                  onChange={(e) => setIsAdminRegister(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                />
                <label htmlFor="adminCheck" className="cursor-pointer font-medium">สมัครเป็น Admin 🛡️</label>
              </div>
            )}

            <button type="submit" className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-2xl transition cursor-pointer text-sm shadow-lg shadow-emerald-500/20 active:scale-95">
              {authMode === 'login' ? 'เข้าสู่ระบบ' : 'ยืนยันการสมัคร'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-3 sm:p-4 flex flex-col justify-between font-sans max-w-md mx-auto">
      
      {selectedCardToConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl max-w-xs w-full flex flex-col items-center">
            <h3 className="text-sm font-bold text-slate-400 mb-2 uppercase">ยืนยันการลงการ์ด</h3>
            
            <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 p-3 rounded-2xl shadow-md text-center w-28 my-3 border border-emerald-500/40">
              <div className="text-[10px] text-emerald-200 uppercase font-bold truncate w-full">{selectedCardToConfirm.card.type}</div>
              <div className="w-12 h-12 my-2 mx-auto bg-emerald-800/80 rounded-xl overflow-hidden flex items-center justify-center border border-emerald-400/40 shadow-inner">
                {selectedCardToConfirm.card.image ? (
                  <img src={selectedCardToConfirm.card.image} alt={selectedCardToConfirm.card.value} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm">⚽</span>
                )}
              </div>
              <div className="text-xs font-bold text-white truncate w-full px-1">{selectedCardToConfirm.card.value}</div>
            </div>

            <p className="text-xs text-slate-300 mb-5">คุณต้องการลงการ์ดใบนี้ลงบนโต๊ะใช่หรือไม่?</p>

            <div className="flex gap-2.5 w-full">
              <button 
                onClick={() => setSelectedCardToConfirm(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl text-xs text-slate-300 transition cursor-pointer border border-slate-700"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleConfirmPlayCard}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl text-xs text-white transition cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                ยืนยันลงการ์ด ✅
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === 'playing' && isPaused && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-3 animate-bounce">📺</div>
          <h2 className="text-2xl font-black text-amber-400 mb-2 tracking-widest">VAR CHECK</h2>
          <p className="text-slate-300 text-xs mb-6 px-4">
            {userRole === 'admin' ? 'กำลังตรวจสอบจังหวะการแข่งขัน คุณสามารถกดปุ่มด้านล่างเพื่อเล่นต่อได้ทันที' : 'กรรมการกำลังตรวจสอบภาพช้า (VAR) กรุณารอสักครู่...'}
          </p>

          {userRole === 'admin' && (
            <button 
              onClick={togglePauseGame}
              className="w-full max-w-xs py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg transition cursor-pointer text-sm animate-pulse flex items-center justify-center gap-2"
            >
              📺 เล่นต่อ (Resume)
            </button>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        
        {/* Main Menu */}
        {gameState === 'mainMenu' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl w-full text-center">
            <div className="text-3xl mb-1">⚽</div>
            <h1 className="text-lg font-black mb-1 text-emerald-400">FOOTBALL TRIVIA</h1>
            <p className="text-xs text-slate-400 mb-6">ผู้เล่น: <span className="text-white font-bold">{username}</span> ({userRole.toUpperCase()})</p>

            <div className="space-y-3">
              {userRole === 'admin' ? (
                <>
                  <button 
                    onClick={handleAdminCreateRoom}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-2xl transition shadow-lg shadow-emerald-500/20 cursor-pointer text-sm active:scale-95"
                  >
                    🏠 สร้างห้องเกมใหม่ (Create Room)
                  </button>
                  <button 
                    onClick={() => setGameState('customize')}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 font-bold rounded-2xl transition shadow-lg shadow-blue-600/20 cursor-pointer text-sm active:scale-95"
                  >
                    ⚙️ จัดการการ์ด / รูปภาพ (Settings)
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleJoinRoom}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-2xl transition shadow-lg shadow-emerald-500/20 cursor-pointer text-sm active:scale-95"
                >
                  🚪 เข้าร่วมห้องเกม (Join Room)
                </button>
              )}

              <button 
                onClick={handleLogoutClean}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-2xl transition cursor-pointer text-sm text-red-400 border border-slate-700 active:scale-95"
              >
                ออกจากระบบ (Logout)
              </button>
            </div>
          </div>
        )}

        {/* Lobby */}
        {gameState === 'lobby' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl w-full text-center">
            <h1 className="text-lg font-black mb-1 text-emerald-400">GAME LOBBY</h1>
            <p className="text-xs text-slate-400 mb-5">รอผู้เล่นเข้าห้อง (2-4 คน)</p>
            
            <div className="bg-slate-950/60 p-4 rounded-2xl mb-5 text-left border border-slate-800">
              <h4 className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">ผู้เล่นในห้อง ({roomPlayers.length}/4):</h4>
              <div className="space-y-2">
                {roomPlayers.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-800/80 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-700/50">
                    <span>{idx === 0 ? '👑 Admin' : '👤 Player'}</span>
                    <span className="text-emerald-400 font-bold">{p.username}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-2.5">
                <button 
                  onClick={handleLeaveRoom}
                  className="w-1/2 py-3 bg-red-600/80 hover:bg-red-600 font-bold rounded-2xl transition cursor-pointer text-xs active:scale-95"
                >
                  🚪 ออกจากห้อง
                </button>
                {userRole === 'admin' ? (
                  <button 
                    onClick={startGameHost}
                    disabled={roomPlayers.length < 2}
                    className="w-1/2 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-2xl transition shadow-lg shadow-emerald-500/20 cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    เริ่มเกม 🚀
                  </button>
                ) : (
                  <div className="w-1/2 flex items-center justify-center text-[11px] text-slate-400 italic bg-slate-800 rounded-2xl p-2">
                    รอ Admin เริ่มเกม...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Countdown */}
        {gameState === 'countdown' && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full text-center">
            <h2 className="text-lg font-black mb-1 text-emerald-400">🟨 ปี๊ดดด! เตรียมตัวเริ่มเกม!</h2>
            <p className="text-slate-400 text-xs mb-8">กรรมการเป่านกหวีดแล้ว...</p>
            
            <div className="relative w-full bg-slate-950 h-7 rounded-full overflow-visible p-1 border border-slate-800 mb-4 shadow-inner">
              <div 
                className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full transition-all duration-1000 ease-linear shadow-lg relative"
                style={{ width: `${(countdownTime / 5) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-8 bg-slate-900 rounded-full border-2 border-emerald-400 flex items-center justify-center text-base shadow-lg animate-bounce">
                  ⚽
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Playing Screen */}
        {gameState === 'playing' && (
          <div className="w-full flex flex-col gap-3.5 pb-4">
            
            {userRole === 'admin' && (
              <div className="bg-slate-900 border border-amber-500/30 p-2.5 rounded-2xl shadow flex justify-between items-center gap-2">
                <span className="text-[10px] text-amber-400 font-bold pl-1">🛡️ Admin</span>
                <div className="flex gap-1.5">
                  <button 
                    onClick={startGameHost}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-bold transition cursor-pointer shadow"
                  >
                    🔄 รีสตาร์ท
                  </button>
                  <button 
                    onClick={togglePauseGame}
                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[10px] font-bold transition cursor-pointer shadow flex items-center gap-1"
                    title="VAR Check"
                  >
                    📺 VAR
                  </button>
                  <button 
                    onClick={handleAdminEndGame}
                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-bold transition cursor-pointer shadow"
                  >
                    🛑 ปิดห้อง
                  </button>
                </div>
              </div>
            )}

            {/* Turn & Score Header */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 block">เทิร์นปัจจุบัน:</span>
                <div className="text-sm font-bold text-emerald-400 truncate max-w-[120px]">
                  {roomPlayers[currentTurn]?.username} {isMyTurn ? '(ตาคุณ!)' : ''}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex gap-1.5 overflow-x-auto max-w-[170px] pb-1">
                  {roomPlayers.map((p, idx) => (
                    <div key={idx} className={`text-center px-2 py-1 rounded-xl text-[10px] shrink-0 ${idx === currentTurn ? 'bg-emerald-500/20 border border-emerald-500 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}>
                      <div className="truncate max-w-[50px]">{p.username}</div>
                      <div className="text-yellow-400 font-black">⭐ {p.score || 0}</div>
                      <div className="text-emerald-300 text-[9px]">🎴 {p.hand?.length || 0}</div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleLeaveRoom}
                  className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-700 shrink-0"
                  title="หน้าหลัก"
                >
                  🏠
                </button>
              </div>
            </div>

            {/* Table Area */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow flex flex-col items-center justify-center relative">
              <div className="absolute top-3 right-3 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full text-yellow-400 font-bold text-[11px]">
                {turnPhase === 'answering' ? (
                  <span className="text-emerald-400">🎤 รอ Admin ตัดสิน</span>
                ) : (
                  <span className={timeLeft <= 5 ? 'text-red-400 animate-pulse font-black' : ''}>
                    ⏳ {timeLeft}s
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-400 mb-3 text-center font-medium">เงื่อนไขบนโต๊ะ (หาผู้เล่นที่ตรงกับทั้ง 3 ข้อ):</div>
              <div className="flex gap-2.5 justify-center w-full">
                {['position', 'league', 'nationality'].map((type) => {
                  const card = tableCards[type];
                  return (
                    <div key={type} className="bg-gradient-to-b from-emerald-600 to-emerald-700 p-2 rounded-xl shadow-md text-center flex-1 max-w-[100px] flex flex-col items-center border border-emerald-500/40">
                      <div className="text-[9px] text-emerald-200 uppercase tracking-wider font-bold truncate w-full">{type}</div>
                      <div className="w-10 h-10 my-1.5 bg-emerald-800/80 rounded-lg overflow-hidden flex items-center justify-center border border-emerald-400/40 shadow-inner">
                        {card?.image ? (
                          <img src={card.image} alt={card.value} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs">⚽</span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-white truncate w-full px-1">{card?.value || '-'}</div>
                    </div>
                  );
                })}
              </div>

              {isMyTurn && turnPhase === 'placing' && (
                <div className="text-center mt-3.5 w-full">
                  <p className="text-emerald-300 text-xs font-semibold mb-2 animate-pulse">
                    👉 ตาของคุณ! เลือกการ์ดด้านล่างเพื่อวาง
                  </p>
                  <button 
                    onClick={handleSkipTurn}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] cursor-pointer border border-slate-700 font-medium"
                  >
                    ข้ามเทิร์นนี้
                  </button>
                </div>
              )}

              {!isMyTurn && turnPhase === 'placing' && (
                <div className="text-center text-slate-400 text-xs italic mt-3.5">
                  ⏳ รอ <span className="text-white font-bold">{roomPlayers[currentTurn]?.username}</span> วางการ์ด...
                </div>
              )}

              {turnPhase === 'answering' && (
                <div className="text-center bg-slate-800 border border-slate-700 p-3.5 rounded-2xl w-full mt-3.5">
                  {userRole === 'admin' ? (
                    <>
                      <p className="text-yellow-300 text-xs font-bold mb-2">🛡️ [Admin] ตัดสินคำตอบของ {roomPlayers[currentTurn]?.username}</p>
                      <div className="flex gap-2 justify-center">
                        <button onClick={handleAdminAnswerCorrect} className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-xs shadow cursor-pointer">
                          ✅ ตอบถูก (+1)
                        </button>
                        <button onClick={handleAdminAnswerWrong} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow cursor-pointer">
                          ❌ ตอบผิด (-1)
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-yellow-300 text-xs font-bold animate-pulse py-2">
                      ⏳ {roomPlayers[currentTurn]?.username} กำลังตอบคำถาม (รอ Admin ตัดสิน)...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Hand Cards */}
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow">
              <h4 className="font-bold text-xs mb-2.5 text-emerald-400 flex justify-between items-center">
                <span>การ์ดในมือคุณ ({roomPlayers.find(p => p.username?.toLowerCase() === username.toLowerCase())?.hand?.length || 0})</span>
                <span className="text-[10px] text-slate-400 font-normal">เลื่อนดู ➡️</span>
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                {roomPlayers.find(p => p.username?.toLowerCase() === username.toLowerCase())?.hand?.map((card, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => !isPaused && isMyTurn && turnPhase === 'placing' && handleOpenConfirmModal(idx)}
                    className={`p-2.5 rounded-2xl min-w-[95px] max-w-[95px] text-center transition transform flex flex-col items-center shrink-0 border ${
                      !isPaused && isMyTurn && turnPhase === 'placing' 
                        ? 'bg-slate-800 hover:bg-slate-700 cursor-pointer active:scale-95 border-emerald-500/60 shadow-md shadow-emerald-500/10' 
                        : 'bg-slate-950/60 opacity-50 border-slate-800'
                    }`}
                  >
                    <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold truncate w-full">{card.type}</div>
                    <div className="w-10 h-10 my-1 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-700 shadow-inner">
                      {card.image ? (
                        <img src={card.image} alt={card.value} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs">⚽</span>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-white truncate w-full mt-0.5">{card.value}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Customize / Admin Settings */}
        {gameState === 'customize' && userRole === 'admin' && (
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-2xl w-full max-h-[85vh] flex flex-col">
            <h2 className="text-base font-bold mb-1 text-emerald-400 text-center">⚙️ จัดการข้อมูลและการ์ด</h2>
            <p className="text-slate-400 text-[11px] mb-4 text-center">เพิ่มข้อมูลและอัปโหลดรูปภาพการ์ด</p>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {Object.keys(categories).map((catKey) => (
                <div key={catKey} className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <h3 className="text-emerald-300 font-bold uppercase text-xs mb-2">{catKey}</h3>
                  
                  <div className="flex gap-2 mb-2.5">
                    <input 
                      type="text" 
                      placeholder={`เพิ่ม ${catKey} ใหม่...`}
                      value={newValues[catKey]}
                      onChange={(e) => setNewValues({ ...newValues, [catKey]: e.target.value })}
                      className="flex-1 p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs focus:outline-none focus:border-emerald-400"
                    />
                    <button 
                      onClick={() => handleAddItem(catKey)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold rounded-xl cursor-pointer transition shrink-0"
                    >
                      + เพิ่ม
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {categories[catKey].map((item, idx) => (
                      <div key={item.id || idx} className="bg-slate-800/80 p-2 rounded-xl flex flex-col items-center gap-1.5 border border-slate-700/60">
                        <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden border border-slate-700">
                          {item.image ? (
                            <img src={item.image} alt={item.value} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] text-slate-500">ไม่มีรูป</span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-center truncate w-full">{item.value}</span>
                        <label className="text-[10px] bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 rounded-lg cursor-pointer font-bold transition w-full text-center">
                          เปลี่ยนรูป
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
              className="w-full mt-4 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-2xl transition cursor-pointer shadow-lg text-xs"
            >
              บันทึกและกลับหน้าหลัก
            </button>
          </div>
        )}

        {/* Finished Screen */}
        {gameState === 'finished' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl w-full text-center">
            <div className="text-4xl mb-1 animate-bounce">🏆</div>
            <h2 className="text-xl font-black mb-1 text-emerald-400">สรุปผลการแข่งขัน</h2>
            <p className="text-xs text-yellow-400 font-bold mb-4">ผู้ชนะ: {winner?.username} คว้าแชมป์ไปครอง!</p>
            
            <div className="bg-slate-950/60 p-3.5 rounded-2xl mb-5 text-left border border-slate-800">
              <h4 className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider text-center">คะแนนรวมทั้งหมด:</h4>
              <div className="space-y-2">
                {[...roomPlayers]
                  .sort((a, b) => (b.score || 0) - (a.score || 0))
                  .map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-800/80 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤'}</span>
                        <span className="text-white">{p.username}</span>
                      </div>
                      <span className="text-yellow-400 font-black">{p.score || 0} คะแนน</span>
                    </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {userRole === 'admin' && (
                <button 
                  onClick={startGameHost}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition cursor-pointer shadow-lg text-xs active:scale-95"
                >
                  🔄 เริ่มเกมใหม่อีกครั้ง (Restart)
                </button>
              )}
              <button 
                onClick={handleAdminEndGame}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-red-400 font-bold rounded-2xl transition cursor-pointer text-xs border border-slate-700 active:scale-95"
              >
                🚪 กลับสู่หน้าหลัก (Main Menu)
              </button>
            </div>
          </div>
        )}

      </div>

      <footer className="w-full text-center py-3 text-[10px] text-slate-500 mt-4 border-t border-slate-900">
        © 2026 L88PER • Mobile Optimized
      </footer>

    </div>
  );
}