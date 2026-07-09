import { useCallback, useEffect, useRef, useState } from 'react';

type Board = number[][];
type Direction = 'up' | 'down' | 'left' | 'right';

const SIZE = 4;
const STORAGE_KEY = 'cashflow-game2048-best';

const createEmptyBoard = (): Board =>
  Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));

const cloneBoard = (board: Board): Board => board.map(row => [...row]);

const getEmptyCells = (board: Board): Array<[number, number]> => {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
};

const addRandomTile = (board: Board): Board => {
  const emptyCells = getEmptyCells(board);
  if (emptyCells.length === 0) return board;
  const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const next = cloneBoard(board);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
};

const createInitialBoard = (): Board => {
  let board = createEmptyBoard();
  board = addRandomTile(board);
  board = addRandomTile(board);
  return board;
};

// Schiebt und verschmilzt eine einzelne Reihe nach links; Richtung wird vorher durch Rotation des Boards hergestellt.
const collapseRowLeft = (row: number[]): { row: number[]; gained: number; moved: boolean } => {
  const values = row.filter(v => v !== 0);
  const result: number[] = [];
  let gained = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const merged = values[i] * 2;
      result.push(merged);
      gained += merged;
      i++;
    } else {
      result.push(values[i]);
    }
  }

  while (result.length < SIZE) result.push(0);
  const moved = row.some((v, i) => v !== result[i]);
  return { row: result, gained, moved };
};

const rotateBoardClockwise = (board: Board): Board => {
  const next = createEmptyBoard();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      next[c][SIZE - 1 - r] = board[r][c];
    }
  }
  return next;
};

const boardToLeftAligned = (board: Board, direction: Direction): { board: Board; rotationsBack: number } => {
  // Anzahl der 90°-Rotationen im Uhrzeigersinn, um "direction" auf "left" abzubilden.
  const rotationsForward = { left: 0, up: 3, right: 2, down: 1 }[direction];
  let rotated = board;
  for (let i = 0; i < rotationsForward; i++) rotated = rotateBoardClockwise(rotated);
  return { board: rotated, rotationsBack: (4 - rotationsForward) % 4 };
};

const move = (board: Board, direction: Direction): { board: Board; gained: number; moved: boolean } => {
  const { board: leftAligned, rotationsBack } = boardToLeftAligned(board, direction);
  let gained = 0;
  let moved = false;

  const collapsed = leftAligned.map(row => {
    const result = collapseRowLeft(row);
    gained += result.gained;
    if (result.moved) moved = true;
    return result.row;
  });

  let restored = collapsed;
  for (let i = 0; i < rotationsBack; i++) restored = rotateBoardClockwise(restored);

  return { board: restored, gained, moved };
};

const boardsEqual = (a: Board, b: Board): boolean =>
  a.every((row, r) => row.every((v, c) => v === b[r][c]));

const hasMovesLeft = (board: Board): boolean => {
  if (getEmptyCells(board).length > 0) return true;
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  return directions.some(direction => {
    const { moved } = move(board, direction);
    return moved;
  });
};

const TILE_STYLES: Record<number, string> = {
  2: 'bg-slate-200 text-slate-900',
  4: 'bg-slate-100 text-slate-900',
  8: 'bg-orange-400 text-white',
  16: 'bg-orange-500 text-white',
  32: 'bg-orange-600 text-white',
  64: 'bg-red-500 text-white',
  128: 'bg-yellow-400 text-white',
  256: 'bg-yellow-500 text-white',
  512: 'bg-yellow-600 text-white',
  1024: 'bg-cyan-500 text-white',
  2048: 'bg-cyan-400 text-white',
};

const tileClasses = (value: number): string => {
  if (value === 0) return 'bg-white/5';
  return TILE_STYLES[value] ?? 'bg-fuchsia-500 text-white';
};

const tileFontSize = (value: number): string => {
  if (value >= 1000) return 'text-lg sm:text-2xl';
  if (value >= 100) return 'text-xl sm:text-3xl';
  return 'text-2xl sm:text-4xl';
};

export const Game2048Page = () => {
  const [board, setBoard] = useState<Board>(() => createInitialBoard());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : 0;
  });
  const [isGameOver, setIsGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const applyMove = useCallback((direction: Direction) => {
    if (isGameOver) return;

    setBoard(prevBoard => {
      const result = move(prevBoard, direction);
      if (!result.moved) return prevBoard;

      const nextBoard = addRandomTile(result.board);

      setScore(prevScore => {
        const nextScore = prevScore + result.gained;
        setBest(prevBest => {
          if (nextScore > prevBest) {
            localStorage.setItem(STORAGE_KEY, String(nextScore));
            return nextScore;
          }
          return prevBest;
        });
        return nextScore;
      });

      if (!won && nextBoard.some(row => row.some(v => v >= 2048))) {
        setWon(true);
      }

      if (!hasMovesLeft(nextBoard)) {
        setIsGameOver(true);
      }

      return boardsEqual(nextBoard, prevBoard) ? prevBoard : nextBoard;
    });
  }, [isGameOver, won]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };
      const direction = keyMap[event.key];
      if (direction) {
        event.preventDefault();
        applyMove(direction);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [applyMove]);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const SWIPE_THRESHOLD = 24;

    if (Math.max(absX, absY) < SWIPE_THRESHOLD) {
      touchStart.current = null;
      return;
    }

    if (absX > absY) {
      applyMove(deltaX > 0 ? 'right' : 'left');
    } else {
      applyMove(deltaY > 0 ? 'down' : 'up');
    }
    touchStart.current = null;
  };

  const resetGame = () => {
    setBoard(createInitialBoard());
    setScore(0);
    setIsGameOver(false);
    setWon(false);
  };

  return (
    <main className="flex flex-col items-center app-safe-area px-4 pb-8 pt-4 sm:pt-0">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center min-w-[4.5rem]">
              <div className="text-[0.65rem] uppercase tracking-wide text-slate-400">Score</div>
              <div className="text-lg font-bold text-white">{score}</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center min-w-[4.5rem]">
              <div className="text-[0.65rem] uppercase tracking-wide text-slate-400">Best</div>
              <div className="text-lg font-bold text-cyan-300">{best}</div>
            </div>
          </div>
          <button
            onClick={resetGame}
            className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/25 transition-colors"
          >
            Neu starten
          </button>
        </div>

        <p className="text-center text-slate-400 text-sm mb-4">
          Wische oder nutze die Pfeiltasten, um die Kacheln zu verschieben. Gleiche Zahlen verschmelzen zu ihrer Summe.
        </p>

        <div
          className="relative select-none rounded-2xl bg-slate-900/60 border border-white/10 p-2 sm:p-3 touch-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {board.flatMap((row, r) =>
              row.map((value, c) => (
                <div
                  key={`${r}-${c}`}
                  className={`aspect-square rounded-xl flex items-center justify-center font-bold transition-colors duration-100 ${tileClasses(value)} ${value ? tileFontSize(value) : ''}`}
                >
                  {value !== 0 ? value : ''}
                </div>
              ))
            )}
          </div>

          {(isGameOver || won) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-950/80 backdrop-blur-sm">
              <div className="text-2xl font-bold text-white">
                {won ? '🎉 2048 erreicht!' : 'Game Over'}
              </div>
              <button
                onClick={resetGame}
                className="rounded-full border border-cyan-400/30 bg-cyan-500/20 px-5 py-2.5 font-medium text-cyan-100 hover:bg-cyan-500/30 transition-colors"
              >
                Nochmal spielen
              </button>
              {won && (
                <button
                  onClick={() => setWon(false)}
                  className="text-sm text-slate-400 hover:text-slate-200 underline"
                >
                  Weiterspielen
                </button>
              )}
            </div>
          )}
        </div>

        {/* Direction buttons as fallback for non-touch mobile browsers */}
        <div className="mt-5 grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
          <div />
          <button
            onClick={() => applyMove('up')}
            className="rounded-xl bg-white/5 border border-white/10 py-3 text-slate-200 hover:bg-white/10 active:bg-white/15 transition-colors"
            aria-label="Nach oben"
          >
            ↑
          </button>
          <div />
          <button
            onClick={() => applyMove('left')}
            className="rounded-xl bg-white/5 border border-white/10 py-3 text-slate-200 hover:bg-white/10 active:bg-white/15 transition-colors"
            aria-label="Nach links"
          >
            ←
          </button>
          <button
            onClick={() => applyMove('down')}
            className="rounded-xl bg-white/5 border border-white/10 py-3 text-slate-200 hover:bg-white/10 active:bg-white/15 transition-colors"
            aria-label="Nach unten"
          >
            ↓
          </button>
          <button
            onClick={() => applyMove('right')}
            className="rounded-xl bg-white/5 border border-white/10 py-3 text-slate-200 hover:bg-white/10 active:bg-white/15 transition-colors"
            aria-label="Nach rechts"
          >
            →
          </button>
        </div>
      </div>
    </main>
  );
};
