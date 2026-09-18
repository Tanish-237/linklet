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
    }
  };

  const restart = () => {
    setGameOver(false);
    setWin(false);
    setBoard(createBoard(size, totalMines));
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4 text-zinc-100">Minesweeper</h1>
      {gameOver && (
        <p className={`mb-2 font-semibold ${win ? "text-emerald-400" : "text-red-400"}`}>
          {win ? "🎉 You Win!" : "💥 Game Over"}
        </p>
      )}
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(28px, 40px))`
        }}
      >
        {board.map((cell, idx) => (
          <button
            key={idx}
            onClick={() => revealCell(idx)}
            className={`w-full aspect-square text-center font-bold border border-zinc-700 rounded ${
              cell.revealed
                ? cell.value === "M"
                  ? "bg-red-500 text-white"
                  : "bg-zinc-800 text-zinc-100"
                : "bg-zinc-600 hover:bg-zinc-500"
            }`}
          >
            {cell.revealed && cell.value !== 0 ? cell.value : ""}
          </button>
        ))}
      </div>
      <button
        onClick={restart}
        className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500"
      >
        Restart
      </button>
    </div>
  );
}
