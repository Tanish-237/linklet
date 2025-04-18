import { useState } from "react";

export default function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(""));
  const [currentPlayer, setCurrentPlayer] = useState("X");
  const [status, setStatus] = useState("It's X's turn");
  const [gameActive, setGameActive] = useState(true);

  const winConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const handleClick = (index) => {
    if (board[index] || !gameActive) return;

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    if (checkWin(newBoard)) {
      setStatus(`${currentPlayer} wins! 🎉`);
      setGameActive(false);
    } else if (newBoard.every(cell => cell !== "")) {
      setStatus("It's a draw! 🤝");
      setGameActive(false);
    } else {
      const nextPlayer = currentPlayer === "X" ? "O" : "X";
      setCurrentPlayer(nextPlayer);
      setStatus(`It's ${nextPlayer}'s turn`);
    }
  };

  const checkWin = (board) => {
    return winConditions.some(([a, b, c]) => {
      return board[a] && board[a] === board[b] && board[a] === board[c];
    });
  };

  const restartGame = () => {
    setBoard(Array(9).fill(""));
    setCurrentPlayer("X");
    setStatus("It's X's turn");
    setGameActive(true);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-4">Tic Tac Toe</h1>
      <div className="grid grid-cols-3 gap-2">
        {board.map((cell, index) => (
          <div
            key={index}
            onClick={() => handleClick(index)}
            className="w-24 h-24 flex items-center justify-center text-3xl font-bold border border-gray-700 bg-white hover:bg-gray-200 cursor-pointer"
          >
            {cell}
          </div>
        ))}
      </div>
      <p className="mt-4 text-lg font-medium">{status}</p>
      <button
        onClick={restartGame}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Restart
      </button>
    </div>
  );
}
