"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

// Dev-only game - redirect in production
const isDev = process.env.NODE_ENV === "development";

type UserData = {
  id: string;
  username: string;
  avatar_url: string | null;
};

// Game constants
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const INITIAL_DROP_SPEED = 800;
const SPEED_INCREASE_PER_LEVEL = 150;
const LINES_PER_LEVEL = 10;

// Custom piece shapes (avoiding Tetris's exact 7 tetrominoes)
// All pieces can be meaningfully rotated
const PIECES = [
  // 3-block pieces
  { name: "tri", blocks: [[0, 0], [1, 0], [2, 0]], color: "#dc2626" }, // Straight 3
  { name: "corner", blocks: [[0, 0], [1, 0], [0, 1]], color: "#f97316" }, // L-3
  
  // 4-block pieces
  { name: "line", blocks: [[0, 0], [1, 0], [2, 0], [3, 0]], color: "#22c55e" }, // Line
  { name: "tee", blocks: [[0, 0], [1, 0], [2, 0], [1, 1]], color: "#06b6d4" }, // T-shape
  { name: "snake", blocks: [[0, 0], [1, 0], [1, 1], [2, 1]], color: "#8b5cf6" }, // S-shape
  { name: "bolt", blocks: [[1, 0], [2, 0], [0, 1], [1, 1]], color: "#ec4899" }, // Z-shape
  { name: "elbow", blocks: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#eab308" }, // J-like
  { name: "hook", blocks: [[2, 0], [0, 1], [1, 1], [2, 1]], color: "#84cc16" }, // L-like
  
  // 5-block pieces (pentominoes - unique to Rock Drop)
  { name: "utah", blocks: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], color: "#14b8a6" }, // L-pentomino
  { name: "stairs", blocks: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]], color: "#f43f5e" }, // Staircase
];

// Rock-themed level names
const LEVEL_NAMES = [
  "Open Mic",
  "Local Gig", 
  "Club Show",
  "Festival",
  "Arena Tour",
  "Stadium Show",
  "Headliner",
  "Legend",
  "Rock God",
  "Hall of Fame"
];

type Cell = string | null;
type Board = Cell[][];
type Position = { x: number; y: number };
type Piece = {
  blocks: number[][];
  color: string;
  name: string;
};

function createEmptyBoard(): Board {
  return Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null));
}

function rotatePiece(blocks: number[][]): number[][] {
  // Rotate 90 degrees clockwise
  const maxX = Math.max(...blocks.map(b => b[0]));
  const maxY = Math.max(...blocks.map(b => b[1]));
  return blocks.map(([x, y]) => [maxY - y, x]);
}

export default function RockDropPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Game state
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Piece | null>(null);
  const [position, setPosition] = useState<Position>({ x: 4, y: 0 });
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const dropPieceRef = useRef<() => void>(() => {});
  const supabase = createBrowserClient();
  const router = useRouter();

  // Get random piece
  const getRandomPiece = useCallback((): Piece => {
    const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
    return { ...piece, blocks: [...piece.blocks.map(b => [...b])] };
  }, []);

  // Check if position is valid
  const isValidPosition = useCallback((piece: Piece, pos: Position, boardState: Board): boolean => {
    for (const [bx, by] of piece.blocks) {
      const newX = pos.x + bx;
      const newY = pos.y + by;
      
      if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
        return false;
      }
      
      if (newY >= 0 && boardState[newY][newX] !== null) {
        return false;
      }
    }
    return true;
  }, []);

  // Lock piece to board
  const lockPiece = useCallback((piece: Piece, pos: Position, boardState: Board): Board => {
    const newBoard = boardState.map(row => [...row]);
    for (const [bx, by] of piece.blocks) {
      const newX = pos.x + bx;
      const newY = pos.y + by;
      if (newY >= 0 && newY < BOARD_HEIGHT && newX >= 0 && newX < BOARD_WIDTH) {
        newBoard[newY][newX] = piece.color;
      }
    }
    return newBoard;
  }, []);

  // Clear completed lines
  const clearLines = useCallback((boardState: Board): { newBoard: Board; clearedCount: number } => {
    const newBoard = boardState.filter(row => row.some(cell => cell === null));
    const clearedCount = BOARD_HEIGHT - newBoard.length;
    
    while (newBoard.length < BOARD_HEIGHT) {
      newBoard.unshift(Array(BOARD_WIDTH).fill(null));
    }
    
    return { newBoard, clearedCount };
  }, []);

  // Calculate score
  const calculateScore = useCallback((clearedLines: number, currentLevel: number, currentCombo: number): number => {
    const basePoints = [0, 100, 300, 500, 800][clearedLines] || 0;
    const comboMultiplier = 1 + (currentCombo * 0.5);
    return Math.floor(basePoints * currentLevel * comboMultiplier);
  }, []);

  // Drop piece one row
  const dropPiece = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;

    const newPos = { x: position.x, y: position.y + 1 };
    
    if (isValidPosition(currentPiece, newPos, board)) {
      setPosition(newPos);
    } else {
      // Lock piece
      const newBoard = lockPiece(currentPiece, position, board);
      const { newBoard: clearedBoard, clearedCount } = clearLines(newBoard);
      
      setBoard(clearedBoard);
      
      if (clearedCount > 0) {
        const newCombo = combo + 1;
        setCombo(newCombo);
        const points = calculateScore(clearedCount, level, newCombo);
        setScore(prev => prev + points);
        setLines(prev => {
          const newLines = prev + clearedCount;
          const newLevel = Math.floor(newLines / LINES_PER_LEVEL) + 1;
          if (newLevel > level) {
            setLevel(newLevel);
          }
          return newLines;
        });
      } else {
        setCombo(0);
      }
      
      // Spawn next piece
      const next = nextPiece || getRandomPiece();
      const startPos = { x: Math.floor((BOARD_WIDTH - 2) / 2), y: 0 };
      
      if (!isValidPosition(next, startPos, clearedBoard)) {
        setGameOver(true);
        if (score > highScore) {
          setHighScore(score);
        }
        return;
      }
      
      setCurrentPiece(next);
      setNextPiece(getRandomPiece());
      setPosition(startPos);
    }
  }, [currentPiece, position, board, gameOver, isPaused, isValidPosition, lockPiece, clearLines, calculateScore, combo, level, nextPiece, getRandomPiece, score, highScore]);

  // Keep dropPieceRef updated with the latest dropPiece function
  useEffect(() => {
    dropPieceRef.current = dropPiece;
  }, [dropPiece]);

  // Move piece
  const movePiece = useCallback((dx: number) => {
    if (!currentPiece || gameOver || isPaused) return;
    
    const newPos = { x: position.x + dx, y: position.y };
    if (isValidPosition(currentPiece, newPos, board)) {
      setPosition(newPos);
    }
  }, [currentPiece, position, board, gameOver, isPaused, isValidPosition]);

  // Rotate piece
  const rotate = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;
    
    const rotatedBlocks = rotatePiece(currentPiece.blocks);
    const rotatedPiece = { ...currentPiece, blocks: rotatedBlocks };
    
    // Try normal rotation
    if (isValidPosition(rotatedPiece, position, board)) {
      setCurrentPiece(rotatedPiece);
      return;
    }
    
    // Wall kick - try shifting left/right
    for (const dx of [-1, 1, -2, 2]) {
      const kickPos = { x: position.x + dx, y: position.y };
      if (isValidPosition(rotatedPiece, kickPos, board)) {
        setCurrentPiece(rotatedPiece);
        setPosition(kickPos);
        return;
      }
    }
  }, [currentPiece, position, board, gameOver, isPaused, isValidPosition]);

  // Hard drop
  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver || isPaused) return;
    
    let newY = position.y;
    while (isValidPosition(currentPiece, { x: position.x, y: newY + 1 }, board)) {
      newY++;
    }
    setPosition({ x: position.x, y: newY });
    
    // Immediately lock
    setTimeout(() => dropPiece(), 50);
  }, [currentPiece, position, board, gameOver, isPaused, isValidPosition, dropPiece]);

  // Start game
  const startGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setScore(0);
    setLines(0);
    setLevel(1);
    setCombo(0);
    setGameOver(false);
    setGameStarted(true);
    setIsPaused(false);
    
    const firstPiece = getRandomPiece();
    setCurrentPiece(firstPiece);
    setNextPiece(getRandomPiece());
    setPosition({ x: Math.floor((BOARD_WIDTH - 2) / 2), y: 0 });
  }, [getRandomPiece]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStarted || gameOver) {
        if (e.code === "Space" || e.code === "Enter") {
          startGame();
        }
        return;
      }
      
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          movePiece(-1);
          break;
        case "ArrowRight":
        case "KeyD":
          movePiece(1);
          break;
        case "ArrowDown":
        case "KeyS":
          dropPiece();
          break;
        case "ArrowUp":
        case "KeyW":
          rotate();
          break;
        case "Space":
          hardDrop();
          break;
        case "KeyP":
        case "Escape":
          setIsPaused(p => !p);
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameStarted, gameOver, movePiece, dropPiece, rotate, hardDrop, startGame]);

  // Game loop - uses ref to avoid resetting interval when dropPiece changes
  useEffect(() => {
    if (!gameStarted || gameOver || isPaused) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }
    
    const speed = Math.max(100, INITIAL_DROP_SPEED - (level - 1) * SPEED_INCREASE_PER_LEVEL);
    
    gameLoopRef.current = setInterval(() => {
      dropPieceRef.current();
    }, speed);
    
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver, isPaused, level]);

  // Initialize
  useEffect(() => {
    async function init() {
      // Redirect to home in production - this game is dev-only
      if (!isDev) {
        router.push("/");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      const { data: userInfo } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .eq("id", currentUser.id)
        .single();
      
      if (userInfo) {
        setUserData(userInfo);
      }

      setLoading(false);
    }

    init();
  }, [supabase, router]);

  // Render board with current piece
  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);
    
    // Add current piece to display
    if (currentPiece && !gameOver) {
      for (const [bx, by] of currentPiece.blocks) {
        const x = position.x + bx;
        const y = position.y + by;
        if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
          displayBoard[y][x] = currentPiece.color;
        }
      }
      
      // Ghost piece
      let ghostY = position.y;
      while (isValidPosition(currentPiece, { x: position.x, y: ghostY + 1 }, board)) {
        ghostY++;
      }
      if (ghostY !== position.y) {
        for (const [bx, by] of currentPiece.blocks) {
          const x = position.x + bx;
          const y = ghostY + by;
          if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH && displayBoard[y][x] === null) {
            displayBoard[y][x] = currentPiece.color + "40"; // Ghost with transparency
          }
        }
      }
    }
    
    return displayBoard;
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a" }}>
        <div style={{ 
          height: 60, 
          background: "rgba(0,0,0,0.3)", 
          borderBottom: "1px solid rgba(255,255,255,0.1)"
        }} />
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          minHeight: "60vh" 
        }}>
          <div style={{
            width: 48,
            height: 48,
            border: "3px solid rgba(220, 38, 38, 0.2)",
            borderTopColor: "#dc2626",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  const displayBoard = renderBoard();
  const levelName = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(180deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%)",
    }}>
      <Header 
        user={user} 
        userUsername={userData?.username || null} 
        userAvatarUrl={userData?.avatar_url || null} 
      />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px" }}>
        {/* Back link */}
        <Link 
          href="/game-hub" 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 8, 
            color: "#dc2626", 
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          ← Back to Game Hub
        </Link>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ 
            fontSize: 36, 
            fontWeight: 800, 
            color: "#dc2626",
            margin: 0,
            textShadow: "0 0 20px rgba(220, 38, 38, 0.5)",
            fontFamily: "system-ui",
            letterSpacing: 2,
          }}>
            🎸 ROCK DROP 🎸
          </h1>
          <p style={{ color: "#888", fontSize: 14, margin: "8px 0 0 0" }}>
            {levelName} • Level {level}
          </p>
        </div>

        <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
          {/* Game Board */}
          <div style={{
            background: "rgba(0,0,0,0.6)",
            borderRadius: 12,
            padding: 12,
            border: "2px solid #dc262640",
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${BOARD_WIDTH}, 24px)`,
              gridTemplateRows: `repeat(${BOARD_HEIGHT}, 24px)`,
              gap: 1,
              background: "#111",
              padding: 2,
              borderRadius: 4,
            }}>
              {displayBoard.map((row, y) =>
                row.map((cell, x) => (
                  <div
                    key={`${x}-${y}`}
                    style={{
                      width: 24,
                      height: 24,
                      background: cell 
                        ? cell.includes("40") 
                          ? `${cell.replace("40", "")}20` 
                          : cell 
                        : "#1a1a1a",
                      borderRadius: 2,
                      border: cell && !cell.includes("40") 
                        ? `1px solid ${cell}80` 
                        : cell?.includes("40")
                          ? `1px dashed ${cell.replace("40", "")}40`
                          : "1px solid #222",
                      boxShadow: cell && !cell.includes("40") 
                        ? `inset 0 -2px 4px rgba(0,0,0,0.3), 0 0 8px ${cell}40` 
                        : "none",
                    }}
                  />
                ))
              )}
            </div>
            
            {/* Game Over / Start overlay */}
            {(!gameStarted || gameOver) && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.8)",
                borderRadius: 12,
              }}>
                {gameOver ? (
                  <>
                    <div style={{ fontSize: 32, fontWeight: 800, color: "#dc2626", marginBottom: 8 }}>
                      GAME OVER
                    </div>
                    <div style={{ color: "#888", marginBottom: 16 }}>
                      Final Score: {score.toLocaleString()}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 24, fontWeight: 600, color: "#fff", marginBottom: 16 }}>
                    Ready to Rock?
                  </div>
                )}
                <button
                  onClick={startGame}
                  style={{
                    padding: "12px 32px",
                    fontSize: 16,
                    fontWeight: 600,
                    background: "#dc2626",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  {gameOver ? "Play Again" : "Start Game"}
                </button>
                <p style={{ color: "#666", fontSize: 12, marginTop: 12 }}>
                  Press SPACE or ENTER to start
                </p>
              </div>
            )}
            
            {/* Pause overlay */}
            {isPaused && gameStarted && !gameOver && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.8)",
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#dc2626" }}>
                  PAUSED
                </div>
                <p style={{ color: "#888", fontSize: 14 }}>
                  Press P or ESC to resume
                </p>
              </div>
            )}
          </div>

          {/* Side Panel */}
          <div style={{ width: 160 }}>
            {/* Score */}
            <div style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              border: "1px solid #dc262630",
            }}>
              <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>SCORE</div>
              <div style={{ color: "#dc2626", fontSize: 24, fontWeight: 700 }}>
                {score.toLocaleString()}
              </div>
              {combo > 1 && (
                <div style={{ color: "#f97316", fontSize: 12, marginTop: 4 }}>
                  🔥 {combo}x COMBO!
                </div>
              )}
            </div>

            {/* Lines & Level */}
            <div style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              border: "1px solid #dc262630",
            }}>
              <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>LINES</div>
              <div style={{ color: "#fff", fontSize: 20, fontWeight: 600 }}>{lines}</div>
              <div style={{ color: "#888", fontSize: 12, marginBottom: 4, marginTop: 12 }}>LEVEL</div>
              <div style={{ color: "#fff", fontSize: 20, fontWeight: 600 }}>{level}</div>
            </div>

            {/* Next Piece */}
            <div style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              border: "1px solid #dc262630",
            }}>
              <div style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>NEXT</div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 16px)",
                gridTemplateRows: "repeat(3, 16px)",
                gap: 2,
                justifyContent: "center",
              }}>
                {Array(12).fill(null).map((_, i) => {
                  const x = i % 4;
                  const y = Math.floor(i / 4);
                  const isBlock = nextPiece?.blocks.some(([bx, by]) => bx === x && by === y);
                  return (
                    <div
                      key={i}
                      style={{
                        width: 16,
                        height: 16,
                        background: isBlock ? nextPiece?.color : "transparent",
                        borderRadius: 2,
                        border: isBlock ? `1px solid ${nextPiece?.color}80` : "none",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* High Score */}
            <div style={{
              background: "rgba(0,0,0,0.4)",
              borderRadius: 8,
              padding: 16,
              border: "1px solid #dc262630",
            }}>
              <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>HIGH SCORE</div>
              <div style={{ color: "#eab308", fontSize: 18, fontWeight: 600 }}>
                {highScore.toLocaleString()}
              </div>
            </div>

            {/* Controls */}
            <div style={{
              marginTop: 16,
              padding: 12,
              background: "rgba(0,0,0,0.3)",
              borderRadius: 8,
              fontSize: 11,
              color: "#666",
            }}>
              <div style={{ marginBottom: 4 }}>← → Move</div>
              <div style={{ marginBottom: 4 }}>↑ Rotate</div>
              <div style={{ marginBottom: 4 }}>↓ Soft Drop</div>
              <div style={{ marginBottom: 4 }}>SPACE Hard Drop</div>
              <div>P / ESC Pause</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
