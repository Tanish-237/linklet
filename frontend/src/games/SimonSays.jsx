import { useState } from "react";
import "./SimonSays.css";

const colors = ["red", "green", "blue", "yellow"];

export default function SimonSays() {
  const [sequence, setSequence] = useState([]);
  const [playerSeq, setPlayerSeq] = useState([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [message, setMessage] = useState("Click Start to Play");
  const [active, setActive] = useState(null);
  const [level, setLevel] = useState(0);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  const flash = async (color) => {
    setActive(color);
    await sleep(500);
    setActive(null);
    await sleep(200);
  };

  const playSequence = async (seq) => {
    setIsPlayingSequence(true);
    setIsPlayerTurn(false);
    setMessage("Watch the new color");

    // Only flash the new color (last one in sequence)
    await flash(seq[seq.length - 1]);

    setIsPlayingSequence(false);
    setIsPlayerTurn(true);
    setMessage("Now repeat the entire sequence");
  };

  const startGame = async () => {
    const newColor = colors[Math.floor(Math.random() * colors.length)];
    const newSeq = [newColor]; // Start with just one color
    setSequence(newSeq);
    setPlayerSeq([]);
    setLevel(1);
    await playSequence(newSeq);
  };

  const handlePlayerClick = async (color) => {
    if (!isPlayerTurn || isPlayingSequence) return;

    const newPlayerSeq = [...playerSeq, color];
    setPlayerSeq(newPlayerSeq);

    // Check if the current input matches the sequence up to this point
    const currentIdx = newPlayerSeq.length - 1;
    if (color !== sequence[currentIdx]) {
      setMessage("❌ Wrong! Game Over");
      setSequence([]);
      setPlayerSeq([]);
      setIsPlayerTurn(false);
      setLevel(0);
      return;
    }

    // If the player has completed the current sequence
    if (newPlayerSeq.length === sequence.length) {
      setMessage("✅ Good Job! Next Round");
      // Add a new color to the sequence
      const newColor = colors[Math.floor(Math.random() * colors.length)];
      const newSeq = [...sequence, newColor];
      setSequence(newSeq);
      setPlayerSeq([]);
      setLevel(newSeq.length);
      setTimeout(() => playSequence(newSeq), 1000);
    }
  };

  return (
    <div className="simon-says-container">
      <h1 className="game-title">Simon Says 🎵</h1>
      <p className="level-text">Level: {level}</p>
      <div className="simon-grid">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => handlePlayerClick(color)}
            className={`simon-button ${color} ${
              active === color ? "active" : ""
            }`}
            disabled={!isPlayerTurn || isPlayingSequence}
          />
        ))}
      </div>
      <button
        onClick={startGame}
        className="start-button"
        disabled={sequence.length > 0 || isPlayingSequence}
      >
        {sequence.length === 0 ? "Start Game" : "Game in Progress"}
      </button>
      <p className="message">{message}</p>
    </div>
  );
}
