import React, { useState, useEffect, useRef } from "react";
import TicTac from "../games/TicTac";
import Minesweeper from "../games/Minesweeper";
import SimonSays from "../games/SimonSays";
import "./GamesAndVideos.css";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../config";

const GamesAndVideos = () => {
  const [activeTab, setActiveTab] = useState("games");
  const [selectedGame, setSelectedGame] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [embedUrl, setEmbedUrl] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");

  const games = [
    { id: "tictac", name: "Tic Tac Toe", component: TicTac },
    { id: "minesweeper", name: "Minesweeper", component: Minesweeper },
    { id: "simonsays", name: "Simon Says", component: SimonSays },
  ];

  const GameWrapper = ({
    game: GameComponent,
    isHost,
    gameState,
    onMove,
    players,
    socket,
    roomId,
  }) => {
    // Use a ref to prevent re-renders from resetting game state
    const gameStateRef = useRef(gameState);

    useEffect(() => {
      gameStateRef.current = gameState;
    }, [gameState]);

    return (
      <GameComponent
        isHost={isHost}
        gameState={gameStateRef.current}
        onMove={onMove}
        players={players}
        socket={socket}
        roomId={roomId}
      />
    );
  };

  useEffect(() => {
  }, [gameState]);

  useEffect(() => {
    const socketUrl = API_BASE_URL;
    // The backend now requires every socket connection to present a valid
    // access token at handshake time (see backend/socket.js) — without this,
    // the connection is rejected outright and none of the room/game events
    // below would ever fire.
    const token = typeof window !== "undefined" && window.localStorage
      ? localStorage.getItem("accessToken")
      : null;

    const newSocket = io(socketUrl, {
      auth: { token },
      withCredentials: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 5000,
      transports: ["websocket"],
      forceNew: true,
    });

    newSocket.on("connect", () => {
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setIsCreatingRoom(false);
      alert(
        `Connection error: ${error.message}. Please check if the server is running.`
      );
    });

    newSocket.on("error", (error) => {
      console.error("Socket error:", error);
      setIsCreatingRoom(false);
    });

    newSocket.on("disconnect", () => {
      setIsCreatingRoom(false);
    });

    // Room-related event listeners
    newSocket.on("room-created", (room) => {
      setRoomId(room);
      setIsHost(true);
      setIsCreatingRoom(false);
      setPlayers([newSocket.id]); // Initialize players array with host
    });

    newSocket.on("player-joined", (players) => {
      setPlayers(players);
    });

    newSocket.on("game-state-update", (state) => {
      setGameState(state);
    });

    newSocket.on("video-url-change", (url) => {
      setVideoUrl(url);
      setEmbedUrl(convertToEmbedUrl(url));
    });

    // A peer's move, relayed by the server — update shared game state so
    // this player's board reflects it (see backend socket.js "game-move").
    newSocket.on("game-move", ({ move }) => {
      setGameState(move);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.removeAllListeners();
        newSocket.close();
      }
    };
  }, []);

  const convertToEmbedUrl = (url) => {
    if (!url) return "";

    // Handle YouTube URLs
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const regExp =
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      const videoId = match && match[2].length === 11 ? match[2] : null;
      return videoId
        ? `https://www.youtube.com/embed/${videoId}?autoplay=1`
        : "";
    }

    // Handle other video platforms if needed
    return url;
  };

  const createRoom = async () => {

    if (!socket) {
      console.error("Socket is null");
      alert("Socket not initialized. Please refresh the page.");
      return;
    }

    if (!socket.connected) {
      console.error(
        "Socket is not connected. Connection state:",
        socket.connected
      );
      alert("Not connected to server. Please check if the server is running.");
      return;
    }

    setIsCreatingRoom(true);

    try {
      // Set a timeout for room creation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Room creation timed out")), 5000);
      });

      const roomCreatedPromise = new Promise((resolve, reject) => {
        socket.once("room-created", (roomId) => {
          resolve(roomId);
        });

        socket.once("error", (error) => {
          console.error("Received error event:", error);
          reject(error);
        });
      });

      socket.emit("create-room");

      // Race between room creation and timeout
      const roomId = await Promise.race([roomCreatedPromise, timeoutPromise]);

      setRoomId(roomId);
      setIsHost(true);
    } catch (error) {
      console.error("Error in createRoom:", error);
      alert("Failed to create room: " + error.message);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleGameMove = (move) => {
    if (!socket || !roomId) {
      console.error("Socket or roomId not available");
      return;
    }

    // Emit the move to the server
    socket.emit("game-move", { roomId, move });
  };

  const joinRoom = () => {
    if (!socket || !joinRoomId) {
      console.error("Socket or roomId not available");
      return;
    }
    socket.emit("join-room", joinRoomId);
  };

  const handleVideoSubmit = (e) => {
    e.preventDefault();
    if (!socket || !roomId) {
      console.error("Socket or roomId not available");
      return;
    }

    socket.emit("video-url-change", { roomId, url: videoUrl });
  };

  return (
    <div className="games-videos-container">
      <div className="room-controls">
        {!roomId ? (
          <div className="room-actions">
            <button
              onClick={createRoom}
              className={`create-room-btn ${isCreatingRoom ? "loading" : ""}`}
              disabled={isCreatingRoom}
            >
              {isCreatingRoom ? "Creating Room..." : "Create Room"}
            </button>
            <div className="join-room">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                className="join-room-input"
              />
              <button
                onClick={joinRoom}
                className="join-room-btn"
                disabled={!joinRoomId.trim()}
              >
                Join Room
              </button>
            </div>
          </div>
        ) : (
          <div className="room-info">
            <h3>Room ID: {roomId}</h3>
            <p>Players: {players.length}</p>
            {isHost && <p>(You are the host)</p>}
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          className={activeTab === "games" ? "active" : ""}
          onClick={() => setActiveTab("games")}
        >
          Games
        </button>
        <button
          className={activeTab === "videos" ? "active" : ""}
          onClick={() => setActiveTab("videos")}
        >
          Videos
        </button>
      </div>

      {activeTab === "games" ? (
        <div className="games-section">
          <h2>Choose a Game</h2>
          <div className="games-grid">
            {games.map((game) => (
              <div
                key={game.id}
                className="game-card"
                onClick={() => setSelectedGame(game)}
              >
                <h3>{game.name}</h3>
                <p>Multiplayer Support: Yes</p>
              </div>
            ))}
          </div>

          {selectedGame && (
            <div className="game-container">
              <button
                className="back-button"
                onClick={() => setSelectedGame(null)}
              >
                Back to Games
              </button>
              <GameWrapper
                game={selectedGame.component}
                isHost={isHost}
                gameState={gameState}
                onMove={handleGameMove}
                players={players}
                socket={socket}
                roomId={roomId}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="videos-section">
          <h2>Watch Videos Together</h2>
          <form onSubmit={handleVideoSubmit} className="video-form">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Enter YouTube URL"
              className="video-input"
              disabled={!isHost}
            />
            <button type="submit" className="submit-button" disabled={!isHost}>
              Start Watching
            </button>
          </form>

          {embedUrl && (
            <div className="video-container">
              <iframe
                src={embedUrl}
                title="Video Player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                frameBorder="0"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GamesAndVideos;
