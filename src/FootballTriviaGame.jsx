import React, { useState, useEffect } from 'react';
import './index.css';
import { supabase } from './supabaseClient';

export default function FootballCardGame() {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [view, setView] = useState('lobby'); // lobby, game, customize
  const [roomPlayers, setRoomPlayers] = useState([]);
  const SINGLE_ROOM_ID = 1; // ล็อกไอดีห้องกลางไว้ 1 ห้องถาวร

  // Categories and cards data
  const [categories, setCategories] = useState({
    position: [],
    league: [],
    nationality: []
  });

  // Load categories from Supabase
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

  // Login handler & Join fixed room automatically
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    if (username.trim().length > 8) {
      alert('Username must not exceed 8 characters.');
      return;
    }

    // Check duplicate username in active room
    const { data: existingPlayers } = await supabase.from('room_players').select('*').eq('room_id', SINGLE_ROOM_ID);
    
    if (existingPlayers && existingPlayers.length >= 4) {
      alert('The room is full (maximum 4 players).');
      return;
    }

    if (existingPlayers && existingPlayers.some(p => p.username.toLowerCase() === username.toLowerCase())) {
      alert('This username is already taken in the room.');
      return;
    }

    // Insert user into fixed room
    const { error } = await supabase.from('room_players').insert([{ 
      room_id: SINGLE_ROOM_ID, 
      username: username.trim(), 
      score: 0, 
      hand: [] 
    }]);

    if (error) {
      alert('Failed to join the room.');
      return;
    }

    setIsLoggedIn(true);
    setView('lobby');
    subscribeRoom(SINGLE_ROOM_ID);
  };

  // Realtime Subscribe for the fixed room
  const subscribeRoom = (roomId) => {
    const channel = supabase.channel(`room-fixed-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, () => {
        fetchRoomPlayers(roomId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        if (payload.new.status === 'playing') {
          setView('game');
        }
      })
      .subscribe();

    fetchRoomPlayers(roomId);
    return () => { supabase.removeChannel(channel); };
  };

  const fetchRoomPlayers = async (roomId) => {
    const { data: playersData } = await supabase.from('room_players').select('*').eq('room_id', roomId);
    if (playersData) {
      setRoomPlayers(playersData);
    }
  };

  // Leave room handler (cleanup user session)
  const leaveRoom = async () => {
    await supabase.from('room_players').delete().eq('room_id', SINGLE_ROOM_ID).eq('username', username);
    setIsLoggedIn(false);
    setUsername('');
    setRoomPlayers([]);
  };

  // First player in the room is the host who can start the game
  const isHost = roomPlayers.length > 0 && roomPlayers[0].username === username;

  // Start game handler (Host only, min 2 players, max 4 players)
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

    // Update fixed room status to playing
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

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-4 text-emerald-400">⚽ Football Trivia Game</h1>
          <p className="text-xs text-slate-400 mb-6">Enter your username (Max 8 characters)</p>
          <input 
            type="text" 
            maxLength={8}
            placeholder="Username (Max 8 chars)" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-center text-white mb-4 focus:outline-none focus:border-emerald-400 font-bold"
          />
          <button type="submit" className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition cursor-pointer">
            Join Room
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col justify-between font-sans">
      <div className="flex-1 flex flex-col items-center justify-center">
        
        {/* Lobby View */}
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
              <button onClick={leaveRoom} className="w-1/2 py-3 bg-red-600/80 hover:bg-red-600 font-bold rounded-xl text-sm transition cursor-pointer">
                Leave Room
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

        {/* Game View Placeholder */}
        {view === 'game' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-2xl font-bold mb-4 text-emerald-400">🎮 Game Started!</h2>
            <p className="text-sm text-slate-300 mb-6">Match is in progress...</p>
            <button onClick={leaveRoom} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-sm font-bold rounded-xl">
              Exit Game
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