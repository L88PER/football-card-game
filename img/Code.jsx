import React, { useState, useEffect } from 'react';
import './index.css';
import { supabase } from './supabaseClient';

export default function FootballCardGame() {
  const [categories, setCategories] = useState({
    position: [],
    league: [],
    nationality: []
  });

  const [gameState, setGameState] = useState('lobby'); // lobby, customize, firstRoundGuess, playing, transition, finished
  const [numPlayers, setNumPlayers] = useState(2);
  const [players, setPlayers] = useState([]);
  
  const [currentTurn, setCurrentTurn] = useState(0); 
  const [tableCards, setTableCards] = useState({
    position: null,
    league: null,
    nationality: null
  });

  const [refreshVotes, setRefreshVotes] = useState([]);
  const [turnPhase, setTurnPhase] = useState('placing'); 
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

  // โหลดข้อมูลจาก Supabase ทันทีที่เปิดเว็บ
  useEffect(() => {
    loadCategoriesFromDB();
  }, []);

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

  // ฟังก์ชันอัปโหลดรูปภาพลง Supabase Storage และอัปเดต SQL
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

  // ฟังก์ชันเพิ่มข้อมูลใหม่ลง SQL
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

  const randomizeTableCards = () => {
    const posList = categories.position;
    const leaList = categories.league;
    const natList = categories.nationality;

    if (posList.length === 0 || leaList.length === 0 || natList.length === 0) {
      alert('ข้อมูลในการ์ดไม่เพียงพอ กรุณาตรวจสอบฐานข้อมูล');
      return;
    }

    setTableCards({
      position: posList[Math.floor(Math.random() * posList.length)],
      league: leaList[Math.floor(Math.random() * leaList.length)],
      nationality: natList[Math.floor(Math.random() * natList.length)]
    });
    setRefreshVotes([]);
  };

  const startGame = () => {
    const initialPlayers = [];
    const keys = Object.keys(categories);

    for (let i = 1; i <= numPlayers; i++) {
      const hand = [];
      for (let j = 0; j < 10; j++) {
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        const itemList = categories[randomKey];
        if (itemList && itemList.length > 0) {
          const randomItem = itemList[Math.floor(Math.random() * itemList.length)];
          hand.push({ type: randomKey, value: randomItem.value, image: randomItem.image });
        }
      }
      initialPlayers.push({ id: i, name: `Player ${i}`, score: 0, hand });
    }

    setPlayers(initialPlayers);
    setWinner(null);
    setFeedback('');
    setLastPlayedCard(null);

    randomizeTableCards();
    setGameState('firstRoundGuess');
  };

  const handleVoteRefresh = (playerId) => {
    if (refreshVotes.includes(playerId)) return;
    const newVotes = [...refreshVotes, playerId];
    setRefreshVotes(newVotes);

    if (newVotes.length >= players.length) {
      randomizeTableCards();
    }
  };

  const handleFirstRoundWinner = (playerId) => {
    const winnerPlayer = players.find(p => p.id === playerId);
    const otherPlayers = players.filter(p => p.id !== playerId);
    const shuffledOthers = otherPlayers.sort(() => Math.random() - 0.5);
    
    const finalPlayers = [winnerPlayer, ...shuffledOthers].map((p, idx) => ({
      ...p,
      name: `Player ${idx + 1}`
    }));

    setPlayers(finalPlayers);
    setCurrentTurn(0);
    setGameState('playing');
    setTurnPhase('placing');
    setTimeLeft(20);
  };

  // ควบคุม Timer เฉพาะช่วง placing (20s) และ stealing (10s) เท่านั้น
  useEffect(() => {
    if (gameState !== 'playing') return;
    // ถ้าอยู่ในช่วง answering จะไม่รัน timer (ปล่อยให้คิดได้เรื่อยๆ)
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

  const nextTurnIdx = (currentTurn + 1) % players.length;

  const triggerTransition = (msg) => {
    setFeedback(msg);
    setNextPlayerName(players[nextTurnIdx].name);
    setTransitionTime(5);
    setGameState('transition');
  };

  const handleNoStealTimeout = () => {
    if (lastPlayedCard) {
      const player = players[currentTurn];
      const returnedHand = [...player.hand, lastPlayedCard];
      setPlayers(players.map((p, idx) => idx === currentTurn ? { ...p, hand: returnedHand } : p));
      setLastPlayedCard(null);
    }
    triggerTransition(`${players[currentTurn].name} ตอบไม่ได้และไม่มีคน Steal (-1 คะแนน, การ์ดกลับเข้ามือ)`);
  };

  const handleSelectCard = (cardIdx) => {
    if (turnPhase !== 'placing') return;
    executePlayCard(cardIdx);
  };

  const executePlayCard = (cardIdx) => {
    const player = players[currentTurn];
    const card = player.hand[cardIdx];

    setLastPlayedCard(card);
    setTableCards(prev => ({
      ...prev,
      [card.type]: card
    }));

    const updatedHand = player.hand.filter((_, idx) => idx !== cardIdx);
    setPlayers(players.map((p, idx) => idx === currentTurn ? { ...p, hand: updatedHand } : p));

    setFeedback('');
    setTurnPhase('answering'); // เข้าสู่ช่วงตอบแบบไม่จำกัดเวลา
  };

  const handleSkipTurn = () => {
    if (turnPhase !== 'placing') return;
    setTurnPhase('paused'); 
    triggerTransition(`${players[currentTurn].name} ไม่มีการ์ดลง / ข้ามเทิร์น`);
  };

  const handleOwnerAnswerCorrect = () => {
    const player = players[currentTurn];
    const newScore = player.score + 1;
    setLastPlayedCard(null);
    updateScoreAndCheckWin(currentTurn, newScore, `${player.name} ตอบถูก! (+1 คะแนน)`);
  };

  const handleOwnerAnswerWrong = () => {
    const updatedPlayers = players.map((p, idx) => idx === currentTurn ? { ...p, score: p.score - 1 } : p);
    setPlayers(updatedPlayers);
    setTurnPhase('stealing');
    setTimeLeft(10); // เริ่มนับเวลา 10 วิเฉพาะช่วง Steal
  };

  const handleStealClick = (playerId) => {
    setStealingPlayerId(playerId);
  };

  const handleStealCorrect = () => {
    const pIdx = players.findIndex(p => p.id === stealingPlayerId);
    const stealingPlayer = players[pIdx];
    const newScore = stealingPlayer.score + 1;
    
    const updatedPlayers = players.map((p, idx) => idx === pIdx ? { ...p, score: newScore } : p);
    setPlayers(updatedPlayers);
    
    setLastPlayedCard(null);
    triggerTransition(`${stealingPlayer.name} Steal สำเร็จ! (+1 คะแนน)`);
  };

  const handleStealWrong = () => {
    const pIdx = players.findIndex(p => p.id === stealingPlayerId);
    const stealingPlayer = players[pIdx];
    const updatedPlayers = players.map((p, idx) => idx === pIdx ? { ...p, score: p.score - 1 } : p);
    setPlayers(updatedPlayers);
    
    setLastPlayedCard(null);
    triggerTransition(`${stealingPlayer.name} Steal ผิด! (-1 คะแนน)`);
  };

  const updateScoreAndCheckWin = (playerIdx, newScore, msg) => {
    const updatedPlayers = players.map((p, idx) => idx === playerIdx ? { ...p, score: newScore } : p);
    setPlayers(updatedPlayers);

    const currentPlayer = updatedPlayers[playerIdx];

    if (newScore >= 3 && currentPlayer.hand.length === 0) {
      setWinner(currentPlayer);
      setGameState('finished');
    } else {
      triggerTransition(msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col justify-between font-sans">
      
      <div className="flex-1 flex flex-col items-center justify-center">
        
        {/* 1. Lobby */}
        {gameState === 'lobby' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h1 className="text-3xl font-bold mb-6 text-emerald-400">⚽ Football Trivia Card Game</h1>
            
            <div className="mb-6 text-left">
              <label className="block mb-2 font-medium">Select Number of Players (2-4):</label>
              <select 
                value={numPlayers} 
                onChange={(e) => setNumPlayers(Number(e.target.value))}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:border-emerald-400 mb-4"
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setGameState('customize')}
                className="w-1/2 py-3 bg-slate-700 hover:bg-slate-600 font-bold rounded-xl transition cursor-pointer border border-slate-600 text-sm"
              >
                ⚙️ จัดการข้อมูล/รูป
              </button>
              <button 
                onClick={startGame}
                className="w-1/2 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition shadow-lg cursor-pointer text-sm"
              >
                Start Game
              </button>
            </div>
          </div>
        )}

        {/* หน้าจอจัดการข้อมูลและอัปโหลดรูปภาพประจำการ์ด (เชื่อม Supabase) */}
        {gameState === 'customize' && (
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
              บันทึกและกลับสู่หน้าหลัก
            </button>
          </div>
        )}

        {/* รอบคัดเลือกหา Player 1 */}
        {gameState === 'firstRoundGuess' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-xl w-full text-center">
            <h2 className="text-2xl font-bold mb-2 text-emerald-400">🏁 รอบคัดเลือกหา Player 1</h2>
            <p className="text-slate-300 mb-6 text-sm">ดูการ์ด 3 ใบบบนกองกลาง แล้วแข่งกันตอบ ใครตอบถูกก่อนจะได้เป็น Player 1!</p>
            
            <div className="flex gap-4 justify-center mb-4">
              {['position', 'league', 'nationality'].map((type) => {
                const card = tableCards[type];
                return (
                  <div key={type} className="bg-emerald-600 p-3 rounded-lg shadow-md text-center min-w-[110px] flex flex-col items-center">
                    <div className="text-[10px] text-emerald-200 uppercase">{type}</div>
                    <div className="w-10 h-10 my-1 bg-emerald-700 rounded overflow-hidden flex items-center justify-center border border-emerald-400/50">
                      {card?.image ? (
                        <img src={card.image} alt={card.value} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] text-emerald-200">⚽</span>
                      )}
                    </div>
                    <div className="text-xs font-bold">{card?.value || '-'}</div>
                  </div>
                );
              })}
            </div>

            <div className="mb-6 bg-slate-700/50 p-4 rounded-xl border border-slate-600">
              <p className="text-xs text-slate-300 mb-3">การ์ดเซ็ตนี้ยากเกินไป? ทุกคนสามารถกดโหวตรีเฟรชการ์ดใหม่ได้ ({refreshVotes.length}/{players.length} Votes):</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {players.map(p => {
                  const hasVoted = refreshVotes.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleVoteRefresh(p.id)}
                      disabled={hasVoted}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow ${
                        hasVoted ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                      }`}
                    >
                      {p.name} {hasVoted ? '✓ Voted' : '🔄 Refresh Vote'}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-yellow-300 font-bold mb-3">ใครตอบถูกเลือกชื่อคนนั้นเป็น Player 1:</p>
            <div className="flex gap-3 justify-center flex-wrap">
              {players.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => handleFirstRoundWinner(p.id)}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-lg text-sm transition cursor-pointer shadow-lg"
                >
                  {p.name} ตอบถูก!
                </button>
              ))}
            </div>
          </div>
        )}

        {/* หน้าจอ Transition 5s */}
        {gameState === 'transition' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center animate-fadeIn">
            <h2 className="text-2xl font-bold mb-3 text-amber-400">⏳ จบเทิร์นนี้</h2>
            <p className="text-slate-200 text-lg mb-4 font-medium">{feedback}</p>
            
            <div className="bg-slate-700/60 p-4 rounded-xl mb-6">
              <span className="text-sm text-slate-400 block mb-1">เทิร์นถัดไปเตรียมตัว:</span>
              <span className="text-2xl font-bold text-emerald-400">{nextPlayerName}</span>
            </div>

            <div className="text-slate-400 text-sm">
              กำลังเริ่มตาถัดไปใน <span className="text-yellow-400 font-bold text-lg">{transitionTime}</span> วินาที...
            </div>
          </div>
        )}

        {/* หน้าจอเล่นเกมปกติ */}
        {gameState === 'playing' && (
          <div className="max-w-4xl w-full flex flex-col gap-6">
            
            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl shadow">
              <div>
                <span className="text-slate-400 text-sm">Current Turn:</span>
                <div className="text-xl font-bold text-emerald-400">{players[currentTurn]?.name}</div>
              </div>
              <div className="flex gap-4">
                {players.map((p, idx) => (
                  <div key={p.id} className={`text-center px-3 py-1 rounded-lg ${idx === currentTurn ? 'bg-emerald-500/20 border border-emerald-500' : ''}`}>
                    <div className="text-xs text-slate-400">{p.name}</div>
                    <div className={`text-lg font-bold ${p.score < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {p.score} pts ({p.hand.length} cards)
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
                    👉 {players[currentTurn]?.name} เลือกการ์ดในมือเพื่อวางลงโต๊ะ (ภายใน {timeLeft} วินาที)
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
                  <p className="text-yellow-300 font-bold mb-2">🎤 {players[currentTurn]?.name} กำลังตอบชื่อนักเตะ (ไม่จำกัดเวลา)</p>
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
                    {players.filter((_, idx) => idx !== currentTurn).map(p => (
                      <button key={p.id} onClick={() => handleStealClick(p.id)} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 font-bold rounded-lg text-sm cursor-pointer">
                        {p.name} Steal!
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {stealingPlayerId && (
                <div className="text-center bg-slate-700 p-4 rounded-xl w-full">
                  <p className="text-yellow-300 font-bold mb-2">⚡ {players.find(p => p.id === stealingPlayerId)?.name} กำลังแย่งตอบ (Steal)!</p>
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
                Hand of <span className="text-yellow-400">{players[currentTurn]?.name}</span> 
                {turnPhase === 'placing' ? ' (Click card to play)' : ''}
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {players[currentTurn]?.hand.map((card, idx) => (
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

        {/* หน้าจอจบเกม */}
        {gameState === 'finished' && (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-3xl font-bold mb-2 text-emerald-400">🎉 Winner!</h2>
            <p className="text-xl text-yellow-400 font-bold mb-6">{winner?.name} wins the game!</p>
            
            <div className="my-4 space-y-2 text-left">
              {[...players].sort((a,b) => b.score - a.score).map((p, idx) => (
                <div key={p.id} className="flex justify-between items-center bg-slate-700 p-3 rounded-lg">
                  <span>{idx === 0 ? '👑 ' : ''}{p.name}</span>
                  <span className={`font-bold ${p.score < 0 ? 'text-red-400' : 'text-yellow-400'}`}>{p.score} pts</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setGameState('lobby')}
              className="w-full mt-4 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl transition cursor-pointer"
            >
              Play Again
            </button>
          </div>
        )}

      </div>

      {/* Copyright ด้านล่าง */}
      <footer className="w-full text-center py-4 text-xs text-slate-500 mt-6 border-t border-slate-800">
        © 2026 L88PER. All rights reserved.
      </footer>

    </div>
  );
}