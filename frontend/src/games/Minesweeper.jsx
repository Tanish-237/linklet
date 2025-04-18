import { useState, useEffect } from "react";

const createBoard = (size, mines) => {
  const board = Array(size * size).fill({ revealed: false, value: 0 });
  const newBoard = board.map((cell, i) => ({ ...cell, id: i }));

  // Place mines
  let mineCount = 0;
  while (mineCount < mines) {
    const rand = Math.floor(Math.random() * size * size);
    if (newBoard[rand].value !== "M") {
      newBoard[rand].value = "M";
      mineCount++;
    }
  }

  // Set numbers
  const dirs = [-1, 1, -size, size, -size - 1, -size + 1, size - 1, size + 1];
  newBoard.forEach((cell, idx) => {
    if (cell.value === "M") return;
    let count = 0;
    dirs.forEach((dir) => {
      const nIdx = idx + dir;
      const x = idx % size;
      const nx = nIdx % size;
      if (
        nIdx >= 0 &&
        nIdx < size * size &&
        Math.abs(x - nx) <= 1 &&
        newBoard[nIdx].value === "M"
      ) {
        count++;
      }
    });
    cell.value = count;
  });

  return newBoard;
};

export default function Minesweeper() {
  const size = 8;
  const totalMines = 10;
  const [board, setBoard] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);

  useEffect(() => {
    setBoard(createBoard(size, totalMines));
  }, []);

  const revealCell = (idx) => {
    if (gameOver || board[idx].revealed) return;

    const updated = [...board];
    updated[idx].revealed = true;

    if (updated[idx].value === "M") {
      setGameOver(true);
      alert("💣 Game Over!");
    } else if (updated[idx].value === 0) {
      revealAdjacent(idx, updated);
    }

    setBoard(updated);
    checkWin(updated);
  };

  const revealAdjacent = (idx, updated) => {
    const dirs = [-1, 1, -size, size, -size - 1, -size + 1, size - 1, size + 1];
    dirs.forEach((dir) => {
      const nIdx = idx + dir;
      const x = idx % size;
      const nx = nIdx % size;
      if (
        nIdx >= 0 &&
        nIdx < size * size &&
        Math.abs(x - nx) <= 1 &&
        !updated[nIdx].revealed
      ) {
        updated[nIdx].revealed = true;
        if (updated[nIdx].value === 0) {
          revealAdjacent(nIdx, updated);
        }
      }
    });
  };

  const checkWin = (updatedBoard) => {
    const unrevealed = updatedBoard.filter(cell => !cell.revealed);
    if (unrevealed.length === totalMines) {
      setWin(true);
      setGameOver(true);
      alert("🎉 You Win!");
    }
  };

  const restart = () => {
    setGameOver(false);
    setWin(false);
    setBoard(createBoard(size, totalMines));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-4">Minesweeper</h1>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${size}, 40px)`
        }}
      >
        {board.map((cell, idx) => (
          <button
            key={idx}
            onClick={() => revealCell(idx)}
            className={`w-10 h-10 text-center font-bold border rounded ${
              cell.revealed
                ? cell.value === "M"
                  ? "bg-red-500 text-white"
                  : "bg-white text-gray-800"
                : "bg-gray-400 hover:bg-gray-500"
            }`}
          >
            {cell.revealed && cell.value !== 0 ? cell.value : ""}
          </button>
        ))}
      </div>
      <button
        onClick={restart}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Restart
      </button>
    </div>
  );
}
