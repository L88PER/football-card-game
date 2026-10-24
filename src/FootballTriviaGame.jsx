  const joinRoomProcess = async (uname) => {
    // 1. เช็คว่ามีผู้เล่นนี้อยู่ในห้องแล้วหรือยัง
    const { data: activePlayers } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', SINGLE_ROOM_ID);

    if (activePlayers) {
      const existingPlayer = activePlayers.find(p => p.username.toLowerCase() === uname.toLowerCase());
      
      if (!existingPlayer) {
        if (activePlayers.length >= 4) {
          alert('The room is full (maximum 4 players).');
          handleLogoutClean();
          return;
        }
        // ถ้ายังไม่มี ให้เพิ่มเข้าไปใหม่
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