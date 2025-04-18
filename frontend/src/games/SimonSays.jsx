

import { useState, useEffect } from "react";

const colors = ["red", "green", "blue", "yellow"];

export default function SimonSays() {
  const [sequence, setSequence] = useState([]);
  const [playerSeq, setPlayerSeq] = useState([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [message, setMessage] = useState("Click Start to Play");
  const [active, setActive] = useState(null);
  const [level, setLevel] = useState(0);

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  const flash = async (color) => {
    setActive(color);
    await sleep(500);
    setActive(null);
    await sleep(100);
  };

  const playSequence = async (seq) => {
    setIsPlayerTurn(false);
    setMessage("Watch the sequence");
    for (let color of seq) {
      await flash(color);
    }
    setIsPlayerTurn(true);
    setMessage("Now it's your turn");
  };

  const startGame = async () => {
    const newColor = colors[Math.floor(Math.random() * colors.length)];
    const newSeq = [...sequence, newColor];
    setSequence(newSeq);
    setPlayerSeq([]);
    setLevel(newSeq.length);
    await playSequence(newSeq);
  };

  const handlePlayerClick = async (color) => {
    if (!isPlayerTurn) return;
    const newPlayerSeq = [...playerSeq, color];
    setPlayerSeq(newPlayerSeq);
    flash(color);

    const currentIdx = newPlayerSeq.length - 1;
    if (color !== sequence[currentIdx]) {
      setMessage("❌ Wrong! Game Over");
      setSequence([]);
      setPlayerSeq([]);
      setIsPlayerTurn(false);
      setLevel(0);
      return;
    }

    if (newPlayerSeq.length === sequence.length) {
      setMessage("✅ Good Job! Next Round");
      setTimeout(() => startGame(), 1000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-4">Simon Says 🎵</h1>
      <p className="mb-4 text-xl">Level: {level}</p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        {colors.map((color) => (
          <div
            key={color}
            onClick={() => handlePlayerClick(color)}
            className={`w-24 h-24 rounded-lg cursor-pointer transition-all duration-200 ${
              active === color ? `bg-${color}-300` : `bg-${color}-600`
            }`}
          ></div>
        ))}
      </div>
      <button
        onClick={startGame}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Start Game
      </button>
      <p className="mt-4 text-lg">{message}</p>
    </div>
  );
}
