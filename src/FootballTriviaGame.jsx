import React, { useState, useEffect } from 'react';
import './index.css';
import { supabase } from './supabaseClient';

export default function FootballCardGame() {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [view, setView] = useState('roomList'); // roomList, roomLobby, customize, game
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ข้อมูลหมวดหมู่และการ์ด
  const [categories, setCategories] = useState({
    position: [],
    league: [],
    nationality: []
  });
  const [newValues, setNewValues] = useState({ position: '', league: '', nationality: '' });

  // สถานะเกมในห้อง
  const [tableCards, setTableCards] = useState({ position: null, league: null, nationality: null });
  const [currentTurn, setCurrentTurn] = useState(0);
  const [turnPhase, setTurnPhase] = useState('placing');
  const [timeLeft, setTimeLeft] = useState(20);
  const [lastPlayedCard, setLastPlayedCard] = useState(null);
  const [stealingPlayerId, setStealingPlayerId] = useState(null);
  const [winner, setWinner] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [transitionTime, setTransitionTime] = useState(5);
  const [nextPlayerName, setNextPlayerName] = useState('');

  // 1. โหลดข้อมูล Categories จาก Supabase
  useEffect(() => {
    loadCategoriesFromDB();
  }, []);

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

  // จัดการ Login ชั่วคราว
  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    if (username.trim().length > 8) {
      alert('ชื่อผู้ใช้ต้องไม่เกิน 8 ตัวอักษร');
      return;
    }
    setIsLoggedIn(true);
    fetchRooms();
  };

  // ดึงรายการห้อง
  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('status', 'waiting');
    if (data) setRooms(data);
  };

  const handleRefreshRooms = async () => {
    setIsRefreshing(true);
    await fetchRooms();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // สร้างห้องใหม่
  const createRoom = async () => {
    const roomName = `${username}'s Room`;
    const { data, error } = await supabase
      .from('rooms')
      .insert([{ name: roomName, host: username, status: 'waiting' }])
      .select()
      .single();

    if (error) {
      alert('สร้างห้องไม่สำเร็จ');
      return;
    }

    const newRoom = data;
    // เพิ่ม Host เข้าห้องเป็น Player คนแรก
    await supabase.from('room_players').insert([{ room_id: newRoom.id, username: username, score: 0, hand: [] }]);

    setCurrentRoom(newRoom);
    setView('roomLobby');
    subscribeRoom(newRoom.id);
  };

  // เข้าร่วมห้อง
  const joinRoom = async (room) => {
    const { data: existing } = await supabase.from('room_players').select('*').eq('room_id', room.id);
    if (existing && existing.length >= 4) {
      alert('ห้องนี้เต็มแล้ว (สูงสุด 4 คน)');
      return;
    }
    if (existing && existing.some(p => p.username === username)) {
      alert('คุณอยู่ในห้องนี้แล้ว');
      return;
    }

    await supabase.from('room_players').insert([{ room_id: room.id, username: username, score: 0, hand: [] }]);
    setCurrentRoom(room);
    setView('roomLobby');
    subscribeRoom(room.id);
  };

  // Realtime Subscribe ห้องและผู้เล่น
  const subscribeRoom = (roomId) => {
    const channel = supabase.channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, () => {
        fetchRoomPlayers(roomId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        if (payload.new.status === 'playing') {
          setCurrentRoom(payload.new);
          setView('game');
        }
      })
      .subscribe();

    fetchRoomPlayers(roomId);
    return () => { supabase.removeChannel(channel); };
  };

  const fetchRoomPlayers = async (roomId) => {
    // แก้ไขจาก eq('id', roomId) เป็น eq('room_id', roomId) ให้ถูกต้อง
    const { data: playersData } = await supabase.from('room_players').select('*').eq('room_id', roomId);
    if (playersData) setRoomPlayers(playersData);
  };

  // ออกจากห้อง
  const leaveRoom = async () => {
    if (currentRoom) {
      await supabase.from('room_players').delete().eq('room_id', currentRoom.id).eq('username', username);
      if (currentRoom.host === username) {
        await supabase.from('rooms').delete().eq('id', currentRoom.id);
      }
    }
    setCurrentRoom(null);
    setView('roomList');
    fetchRooms();
  };

  // Host กดเริ่มเกม
  const startGameHost = async () => {
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

    await supabase.from('rooms').update({ 
      status: 'playing', 
      players_data: updatedPlayers,
      table_cards: initialTable,
      current_turn: 0
    }).eq('id', currentRoom.id);
  };

  // หน้าจอ Login (ชื่อชั่วคราว ไม่เกิน 8 ตัวอักษร)
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-4 text-emerald-400">⚽ เข้าสู่เกมฟุตบอลเทวิยา</h1>
          <p className="text-xs text-slate-400 mb-6">กรอกชื่อของคุณ (สูงสุด 8 ตัวอักษร เล่นเสร็จข้อมูลจะถูกล้าง)</p>
          <input 
            type="text" 
            maxLength={8}
            placeholder="ชื่อผู้เล่น (ไม่เกิน 8 ตัว)" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-center text-white mb-4 focus:outline-none focus:border-emerald-400 font-bold"
          />
          <button type="submit" className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition cursor-pointer">
            เข้าสู่หน้าหลักห้อง
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col justify-between font-sans">
      <div className="flex-1 flex flex-col items-center justify-center">
        
        {/* หน้าแสดงรายการห้อง (Room List) */}
        {view === 'roomList' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-xl font-bold text-emerald-400">👤 ผู้เล่น: {username}</h1>
              <button onClick={() => setView('customize')} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg border border-slate-600">
                ⚙️ จัดการข้อมูล
              </button>
            </div>

            <div className="flex gap-3 mb-6">
              <button onClick={createRoom} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition shadow cursor-pointer text-sm">
                + สร้างห้องใหม่
              </button>
              <button 
                onClick={handleRefreshRooms} 
                disabled={isRefreshing}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 font-bold rounded-xl transition cursor-pointer text-sm disabled:opacity-50"
              >
                {isRefreshing ? '🔄 กำลังโหลด...' : '🔄 รีเฟรช'}
              </button>
            </div>

            <h3 className="text-slate-400 text-sm mb-3">ห้องที่เปิดรออยู่:</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {rooms.length === 0 ? (
                <p className="text-center text-slate-500 text-xs py-4">ยังไม่มีห้องว่าง สร้างห้องเองได้เลย!</p>
              ) : (
                rooms.map(room => (
                  <div key={room.id} className="flex justify-between items-center bg-slate-700/60 p-3 rounded-xl border border-slate-600">
                    <div>
                      <div className="font-bold text-sm">{room.name}</div>
                      <div className="text-[10px] text-slate-400">Host: {room.host}</div>
                    </div>
                    <button onClick={() => joinRoom(room)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold rounded-lg cursor-pointer">
                      เข้าร่วม
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* หน้า Lobby รอผู้เล่นเข้าห้อง */}
        {view === 'roomLobby' && currentRoom && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-2xl font-bold mb-2 text-emerald-400">{currentRoom.name}</h2>
            <p className="text-xs text-slate-400 mb-6">รอผู้เล่นคนอื่นเข้าร่วม (สูงสุด 4 คน)</p>

            <div className="bg-slate-700/50 p-4 rounded-xl mb-6 text-left border border-slate-600">
              <h4 className="text-xs font-bold text-slate-300 mb-2 uppercase">ผู้เล่นในห้อง ({roomPlayers.length}/4):</h4>
              <div className="space-y-2">
                {roomPlayers.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-700 p-2 rounded-lg text-sm">
                    <span>👑 {p.username} {p.username === currentRoom.host ? '(Host)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={leaveRoom} className="w-1/2 py-3 bg-red-600/80 hover:bg-red-600 font-bold rounded-xl text-sm transition cursor-pointer">
                ออกจากห้อง
              </button>
              {currentRoom.host === username ? (
                <button onClick={startGameHost} className="w-1/2 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl text-sm transition cursor-pointer shadow">
                  เริ่มเกม 🚀
                </button>
              ) : (
                <div className="w-1/2 flex items-center justify-center text-xs text-slate-400 italic">
                  รอ Host เริ่มเกม...
                </div>
              )}
            </div>
          </div>
        )}

        {/* หน้าจอจัดการข้อมูล (Customize) */}
        {view === 'customize' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-xl w-full text-center">
            <h2 className="text-xl font-bold mb-4 text-emerald-400">⚙️ ข้อมูลการ์ดในระบบ</h2>
            <p className="text-xs text-slate-400 mb-6">สามารถเพิ่มข้อมูลหรือดูรายการการ์ดได้ที่นี่</p>
            <button onClick={() => setView('roomList')} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-sm font-bold rounded-xl">
              กลับหน้าหลัก
            </button>
          </div>
        )}

      </div>

      <footer className="w-full text-center py-4 text-xs text-slate-500 mt-6 border-t border-slate-800">
        © 2026 L88PER. Temporary User Session Active.
      </footer>
    </div>
  );
}