// src/pages/RoomPage.jsx
import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function RoomPage() {
    const { roomId } = useParams();

    const [room, setRoom] = useState(null);
    const [phase, setPhase] = useState('waiting'); // waiting | intro | rules
    const [playersCount, setPlayersCount] = useState(0);

    // уникальный id вкладки = игрок
    const [clientId] = useState(() => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    });

    const roomRef = useRef(null);
    const phaseRef = useRef('waiting');
    phaseRef.current = phase;

    useEffect(() => {
        roomRef.current = room;
    }, [room]);

    useEffect(() => {
        if (!roomId) return;

        let introTimeout = null;
        let channel = null;

        const init = async () => {
            // 1) один запрос в БД — получить комнату
            const { data, error } = await supabase
                .from('rooms')
                .select('*')
                .eq('id', roomId)
                .single();

            if (error) {
                console.error('load room error', error);
                return;
            }
            setRoom(data);

            // если уже запущена (перезагрузка страницы во время игры)
            if (data.status === 'started') {
                setPhase('intro');
                introTimeout = setTimeout(() => setPhase('rules'), 5000);
            }

            // 2) Realtime канал с presence + postgres_changes
            channel = supabase.channel(`room-${roomId}`, {
                config: {
                    presence: { key: clientId },
                },
            });

            // presence: считаем игроков
            channel.on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const ids = Object.keys(state); // ключи = clientId всех игроков
                const count = ids.length;
                setPlayersCount(count);

                const r = roomRef.current;
                if (!r) return;

                // если игра ещё не началась и игроков достаточно
                if (r.status === 'waiting' && count >= r.required_players) {
                    const smallestId = [...ids].sort()[0];
                    // только один "лидер" делает UPDATE
                    if (smallestId === clientId) {
                        supabase
                            .from('rooms')
                            .update({ status: 'started' })
                            .eq('id', roomId)
                            .then(({ error: updError }) => {
                                if (updError) console.error('update room error', updError);
                            });
                    }
                }
            });

            // postgres_changes: ловим смену статуса
            channel.on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rooms',
                    filter: `id=eq.${roomId}`,
                },
                (payload) => {
                    const newRoom = payload.new;
                    setRoom(newRoom);

                    if (
                        newRoom.status === 'started' &&
                        phaseRef.current !== 'intro' &&
                        phaseRef.current !== 'rules'
                    ) {
                        setPhase('intro');
                        if (introTimeout) clearTimeout(introTimeout);
                        introTimeout = setTimeout(() => setPhase('rules'), 5000);
                    }

                    if (newRoom.status === 'waiting') {
                        setPhase('waiting');
                    }
                }
            );

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // отметиться в presence
                    channel.track({ clientId });
                }
            });
        };

        init();

        return () => {
            if (introTimeout) clearTimeout(introTimeout);
            if (channel) supabase.removeChannel(channel);
        };
    }, [roomId, clientId]);

    const requiredPlayers = room?.required_players ?? 0;

    return (
        <>
            <div className="app">
                <div className="screen">
                    <div className="status">
                        <span className="status-text">
              {room ? room.id.toUpperCase() : 'ROOM'}
            </span>
                        <span className="status-players">
              {playersCount}/{requiredPlayers}
            </span>
                    </div>

                    <div className="content">
                        {phase === 'waiting' && (
                            <div className="center">
                                <p className="placeholder">Ожидание других игроков…</p>
                            </div>
                        )}

                        {phase === 'intro' && room && (
                            <div className="center">
                                <div className="game-label">[{room.game_title}]</div>
                                <div className="suit">{room.suit}</div>
                                <div className="game-name">{room.game_name}</div>
                                <div className="game-subtitle">ゲームに生き残った方へ</div>
                            </div>
                        )}

                        {phase === 'rules' && room && (
                            <div className="rules">
                                <h2>Rules</h2>
                                <p>{room.rules}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
  /* --- GLOBAL --- */
  @font-face {
    font-family: "GameUI";
    font-weight: 400;
    src: local("Inter"), local("Roboto"), local("Noto Sans");
  }
   * {
    padding: 0;
    margin: 0;
   }
  .app {
    width: 100vw;
    height: 100vh;
    background: #f2f4f7; /* светлое небо */
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "GameUI", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #333;
  }

  /* --- PHONE SCREEN --- */
  .screen {
    width: 100%;
    height: 100%;
    max-width: 420px;
    max-height: 900px;
    background: #ffffff;
    padding: 18px 20px 28px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    margin: 0 auto;

    border-radius: 26px;
    box-shadow:
      0 4px 40px rgba(0,0,0,0.08),
      0 0 0 2px rgba(255,255,255,0.7) inset;
  }

  /* --- STATUS BAR --- */
  .status {
    font-size: 13px;
    color: #737b8c;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
    font-weight: 500;
    letter-spacing: 0.03em;
  }

  .back-link {
    color: #8b93a3;
    text-decoration: none;
    transition: 0.2s;
  }
  .back-link:hover {
    color: #555;
  }

  .status-text {
    color: #4c515d;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 12px;
  }

  .status-players {
    font-variant-numeric: tabular-nums;
    color: #606776;
  }

  /* --- CONTENT WINDOW --- */
  .content {
    flex: 1;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(0,0,0,0.05);

    padding: 32px 24px;
    display: flex;
    align-items: center;
    justify-content: center;

    backdrop-filter: blur(4px);
    box-shadow:
      0 0 25px rgba(0,0,0,0.03) inset,
      0 0 10px rgba(0,0,0,0.05);
  }

  .center {
    text-align: center;
    width: 100%;
  }

  /* --- Waiting --- */
  .placeholder {
    font-size: 15px;
    color: #667085;
    opacity: 0.9;
    letter-spacing: 0.02em;
    animation: fadeIn 0.5s ease forwards;
  }

  /* --- Intro --- */
  .game-label {
    font-size: 14px;
    letter-spacing: 0.25em;
    color: #8f96a4;
    margin-bottom: 20px;
    opacity: 0;
    animation: fadeIn 0.6s ease forwards;
  }

  .suit {
    font-size: 42px;
    margin-bottom: 16px;
    color: #41454f;
    text-shadow: 0 0 2px rgba(0,0,0,0.1);
    opacity: 0;
    animation: fadeUp 0.6s ease forwards 0.1s;
  }

  .game-name {
    font-size: 22px;
    margin-bottom: 6px;
    color: #2f3137;
    font-weight: 600;
    letter-spacing: 0.03em;
    opacity: 0;
    animation: fadeUp 0.6s ease forwards 0.2s;
  }

  .game-subtitle {
    font-size: 13px;
    color: #7b8291;
    opacity: 0;
    animation: fadeUp 0.6s ease forwards 0.35s;
  }

  /* --- Rules --- */
  .rules {
    animation: fadeIn 0.6s ease forwards;
  }

  .rules h2 {
    font-size: 20px;
    margin-bottom: 12px;
    text-align: center;
    color: #2a2d33;
    letter-spacing: 0.06em;
  }

  .rules p {
    font-size: 15px;
    line-height: 1.65;
    color: #475161;
    white-space: pre-wrap;
  }

  /* --- Animations --- */
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes fadeUp {
    from { transform: translateY(10px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }

  /* --- Mobile --- */
  @media (max-width: 480px) {
    .screen {
      padding: 14px 14px 22px;
    }
    .content {
      padding: 26px 16px;
    }
  }
`}</style>


        </>
    );
}
