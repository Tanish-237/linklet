import React, { useState, useEffect, useRef } from "react";
import TicTac from "../games/TicTac";
import Minesweeper from "../games/Minesweeper";
import SimonSays from "../games/SimonSays";
import "./GamesAndVideos.css";
import { io } from "socket.io-client";

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
    console.log("Game state updated:", gameState);
  }, [gameState]);

  useEffect(() => {
    const socketUrl = "http://localhost:5000";
    console.log("Connecting to socket server at:", socketUrl);

    const newSocket = io(socketUrl, {
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 5000,
      transports: ["websocket"],
      forceNew: true,
    });

    newSocket.on("connect", () => {
      console.log("Successfully connected to socket server");
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

    newSocket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setIsCreatingRoom(false);
    });

    // Room-related event listeners
    newSocket.on("room-created", (room) => {
      console.log("Room created event received:", room);
      setRoomId(room);
      setIsHost(true);
      setIsCreatingRoom(false);
      setPlayers([newSocket.id]); // Initialize players array with host
    });

    newSocket.on("player-joined", (players) => {
      console.log("Player joined event received:", players);
      setPlayers(players);
    });

    newSocket.on("game-state-update", (state) => {
      console.log("Game state update received:", state);
      setGameState(state);
    });

    newSocket.on("video-url-change", (url) => {
      console.log("Video URL change received:", url);
      setVideoUrl(url);
      setEmbedUrl(convertToEmbedUrl(url));
    });

    newSocket.on("game-move", ({ roomId, move }) => {
      console.log("Game move received for room:", roomId, "move:", move);
      // Handle game move logic here
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
    console.log("createRoom function called");

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

    console.log("Socket is connected, attempting to create room...");
    setIsCreatingRoom(true);

    try {
      // Set a timeout for room creation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Room creation timed out")), 5000);
      });

      const roomCreatedPromise = new Promise((resolve, reject) => {
        socket.once("room-created", (roomId) => {
          console.log("Received room-created event with roomId:", roomId);
          resolve(roomId);
        });

        socket.once("error", (error) => {
          console.error("Received error event:", error);
          reject(error);
        });
      });

      console.log("Emitting create-room event");
      socket.emit("create-room");

      // Race between room creation and timeout
      const roomId = await Promise.race([roomCreatedPromise, timeoutPromise]);

      console.log("Room created successfully:", roomId);
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
    console.log("Handling game move:", move);
    if (!socket || !roomId) {
      console.error("Socket or roomId not available");
      return;
    }

    // Emit the move to the server
    socket.emit("game-move", { roomId, move });
    console.log("Game move emitted to server");
  };

  const joinRoom = () => {
    if (!socket || !joinRoomId) {
      console.error("Socket or roomId not available");
      return;
    }
    console.log("Joining room:", joinRoomId);
    socket.emit("join-room", joinRoomId);
  };

  const handleVideoSubmit = (e) => {
    e.preventDefault();
    if (!socket || !roomId) {
      console.error("Socket or roomId not available");
      return;
    }

    console.log("Submitting video URL:", videoUrl);
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
