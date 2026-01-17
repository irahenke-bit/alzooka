"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

type UserData = {
  id: string;
  username: string;
  avatar_url: string | null;
};

// Upgrade types
type UpgradeType = {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  zpsBonus: number;
  zpcBonus: number;
  maxLevel: number;
  category: "instrument" | "gear" | "skill" | "attraction";
};

const UPGRADES: UpgradeType[] = [
  // Skills - boost click power
  { id: "practice", name: "Practice", description: "Better technique", baseCost: 25, costMultiplier: 1.08, zpsBonus: 0, zpcBonus: 1, maxLevel: 100, category: "skill" },
  { id: "repertoire", name: "Song Repertoire", description: "More songs = more tips", baseCost: 200, costMultiplier: 1.1, zpsBonus: 0, zpcBonus: 3, maxLevel: 75, category: "skill" },
  { id: "showmanship", name: "Showmanship", description: "Work the crowd", baseCost: 1000, costMultiplier: 1.1, zpsBonus: 0, zpcBonus: 10, maxLevel: 50, category: "skill" },
  { id: "charisma", name: "Charisma", description: "Natural charm", baseCost: 10000, costMultiplier: 1.12, zpsBonus: 0, zpcBonus: 50, maxLevel: 50, category: "skill" },
  { id: "viral", name: "Go Viral", description: "Internet fame", baseCost: 250000, costMultiplier: 1.15, zpsBonus: 0, zpcBonus: 500, maxLevel: 25, category: "skill" },
  
  // Instruments - passive income
  { id: "acoustic", name: "Acoustic Guitar", description: "Your trusty six-string", baseCost: 50, costMultiplier: 1.15, zpsBonus: 1, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "harmonica", name: "Harmonica", description: "Blues vibes", baseCost: 300, costMultiplier: 1.15, zpsBonus: 4, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "electric", name: "Electric Guitar", description: "Plug in and rock", baseCost: 2500, costMultiplier: 1.15, zpsBonus: 15, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "keyboard", name: "Keyboard", description: "Ivory keys", baseCost: 15000, costMultiplier: 1.15, zpsBonus: 60, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "drums", name: "Drum Kit", description: "Keep the beat", baseCost: 100000, costMultiplier: 1.15, zpsBonus: 250, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  
  // Gear - multipliers
  { id: "amp", name: "Amplifier", description: "Get loud", baseCost: 150, costMultiplier: 1.12, zpsBonus: 2, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "mic", name: "Microphone", description: "Sing it out", baseCost: 800, costMultiplier: 1.12, zpsBonus: 6, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "speakers", name: "Speakers", description: "Full sound", baseCost: 5000, costMultiplier: 1.12, zpsBonus: 30, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "lights", name: "String Lights", description: "Ambiance", baseCost: 25000, costMultiplier: 1.12, zpsBonus: 100, zpcBonus: 0, maxLevel: 40, category: "gear" },
  
  // Attraction - more listeners
  { id: "sign", name: "Tip Sign", description: "Tips Appreciated!", baseCost: 100, costMultiplier: 1.2, zpsBonus: 3, zpcBonus: 0, maxLevel: 20, category: "attraction" },
  { id: "banner", name: "Banner", description: "Advertise yourself", baseCost: 2000, costMultiplier: 1.2, zpsBonus: 20, zpcBonus: 0, maxLevel: 20, category: "attraction" },
  { id: "costume", name: "Cool Outfit", description: "Look the part", baseCost: 20000, costMultiplier: 1.2, zpsBonus: 120, zpcBonus: 0, maxLevel: 20, category: "attraction" },
  { id: "mascot", name: "Dancing Mascot", description: "Draws a crowd", baseCost: 150000, costMultiplier: 1.2, zpsBonus: 600, zpcBonus: 0, maxLevel: 20, category: "attraction" },
];

function formatNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(1) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return Math.floor(num).toString();
}

function getUpgradeCost(upgrade: UpgradeType, level: number): number {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level));
}

// Pedestrian types for variety
const PEDESTRIAN_STYLES = [
  { hair: "#2c1810", skin: "#e8c4a0", shirt: "#3b5998", pants: "#2d3436", type: "business" },
  { hair: "#8b4513", skin: "#deb887", shirt: "#e74c3c", pants: "#1a1a2e", type: "casual" },
  { hair: "#1a1a1a", skin: "#c4a67c", shirt: "#27ae60", pants: "#34495e", type: "casual" },
  { hair: "#d4a574", skin: "#fdd9b5", shirt: "#9b59b6", pants: "#2c3e50", type: "casual" },
  { hair: "#4a3728", skin: "#e8beac", shirt: "#f39c12", pants: "#1a252f", type: "hipster" },
  { hair: "#1a1a1a", skin: "#8d5524", shirt: "#1abc9c", pants: "#2d3436", type: "casual" },
  { hair: "#a0522d", skin: "#f5deb3", shirt: "#e84393", pants: "#0c0c0c", type: "stylish" },
  { hair: "#696969", skin: "#deb887", shirt: "#636e72", pants: "#2d3436", type: "elder" },
];

// Realistic Person Component
function Person({ 
  style, 
  isWalking, 
  direction,
  isStopped,
  scale = 1,
}: { 
  style: typeof PEDESTRIAN_STYLES[0];
  isWalking: boolean;
  direction: "left" | "right";
  isStopped: boolean;
  scale?: number;
}) {
  return (
    <svg 
      width={30 * scale} 
      height={70 * scale} 
      viewBox="0 0 30 70" 
      style={{ 
        transform: direction === "left" ? "scaleX(-1)" : "scaleX(1)",
      }}
    >
      {/* Shadow */}
      <ellipse cx="15" cy="68" rx="10" ry="2" fill="rgba(0,0,0,0.2)" />
      
      {/* Legs */}
      <g style={{ 
        animation: isWalking && !isStopped ? "walkLegs 0.4s ease-in-out infinite" : undefined,
        transformOrigin: "15px 42px",
      }}>
        {/* Left leg */}
        <path 
          d={`M12,42 Q11,52 10,62 Q10,65 12,66 L14,66 Q15,65 14,62 Q14,52 14,42`}
          fill={style.pants}
        />
        {/* Right leg */}
        <path 
          d={`M16,42 Q17,52 18,62 Q18,65 16,66 L18,66 Q19,65 20,62 Q20,52 18,42`}
          fill={style.pants}
        />
        {/* Shoes */}
        <ellipse cx="12" cy="66" rx="4" ry="2" fill="#1a1a1a" />
        <ellipse cx="18" cy="66" rx="4" ry="2" fill="#1a1a1a" />
      </g>
      
      {/* Body/Torso */}
      <path 
        d="M8,22 Q6,24 6,28 L6,42 Q6,44 10,44 L20,44 Q24,44 24,42 L24,28 Q24,24 22,22 Q18,20 15,20 Q12,20 8,22"
        fill={style.shirt}
      />
      {/* Collar detail */}
      <path d="M12,22 L15,26 L18,22" fill="none" stroke={style.skin} strokeWidth="1.5" />
      
      {/* Arms */}
      <g style={{
        animation: isWalking && !isStopped ? "walkArms 0.4s ease-in-out infinite" : undefined,
        transformOrigin: "15px 24px",
      }}>
        {/* Left arm */}
        <path 
          d="M6,24 Q4,28 5,36 Q5,38 7,38 Q9,38 9,36 Q10,30 8,24"
          fill={style.shirt}
        />
        <ellipse cx="6" cy="38" rx="2.5" ry="3" fill={style.skin} />
        
        {/* Right arm */}
        <path 
          d="M24,24 Q26,28 25,36 Q25,38 23,38 Q21,38 21,36 Q20,30 22,24"
          fill={style.shirt}
        />
        <ellipse cx="24" cy="38" rx="2.5" ry="3" fill={style.skin} />
      </g>
      
      {/* Neck */}
      <rect x="13" y="16" width="4" height="5" fill={style.skin} rx="1" />
      
      {/* Head */}
      <ellipse cx="15" cy="11" rx="7" ry="8" fill={style.skin} />
      
      {/* Hair */}
      <path 
        d="M8,9 Q8,3 15,3 Q22,3 22,9 Q22,7 20,6 Q15,4 10,6 Q8,7 8,9"
        fill={style.hair}
      />
      {style.type === "hipster" && (
        <rect x="9" y="4" width="12" height="4" rx="2" fill={style.hair} />
      )}
      
      {/* Face */}
      <ellipse cx="12" cy="10" rx="1" ry="1.2" fill="#2c2c2c" />
      <ellipse cx="18" cy="10" rx="1" ry="1.2" fill="#2c2c2c" />
      <path d="M13,14 Q15,15.5 17,14" fill="none" stroke="#c4846a" strokeWidth="0.8" />
      
      {/* Ear */}
      <ellipse cx="22" cy="11" rx="1.5" ry="2" fill={style.skin} />
    </svg>
  );
}

// Street Musician Component
function StreetMusician({ 
  isPlaying, 
  hasElectric,
  hasMic,
  outfitLevel,
}: { 
  isPlaying: boolean;
  hasElectric: boolean;
  hasMic: boolean;
  outfitLevel: number;
}) {
  const shirtColor = outfitLevel >= 3 ? "#1a1a1a" : outfitLevel >= 2 ? "#8b4513" : outfitLevel >= 1 ? "#2c5282" : "#4a5568";
  const pantsColor = outfitLevel >= 2 ? "#1a1a1a" : "#3d4852";
  const hasHat = outfitLevel >= 1;
  const hasSunglasses = outfitLevel >= 3;
  
  return (
    <svg width="80" height="160" viewBox="0 0 80 160">
      {/* Shadow */}
      <ellipse cx="40" cy="156" rx="25" ry="4" fill="rgba(0,0,0,0.3)" />
      
      {/* Stool/Seat */}
      <rect x="25" y="105" width="30" height="8" rx="2" fill="#5c4033" />
      <rect x="28" y="113" width="4" height="25" fill="#4a3728" />
      <rect x="48" y="113" width="4" height="25" fill="#4a3728" />
      <rect x="24" y="135" width="32" height="4" rx="1" fill="#4a3728" />
      
      {/* Legs (seated) */}
      <path d="M32,108 Q28,120 30,138 L34,138 Q35,125 34,108" fill={pantsColor} />
      <path d="M48,108 Q52,120 50,138 L46,138 Q45,125 46,108" fill={pantsColor} />
      {/* Shoes */}
      <ellipse cx="31" cy="140" rx="6" ry="3" fill="#2c2c2c" />
      <ellipse cx="49" cy="140" rx="6" ry="3" fill="#2c2c2c" />
      
      {/* Body */}
      <path 
        d="M28,55 Q22,58 22,65 L22,108 Q22,112 30,112 L50,112 Q58,112 58,108 L58,65 Q58,58 52,55 Q46,52 40,52 Q34,52 28,55"
        fill={shirtColor}
      />
      {/* Shirt details */}
      {outfitLevel >= 2 && (
        <>
          <line x1="40" y1="55" x2="40" y2="75" stroke="#fbbf24" strokeWidth="2" />
          <circle cx="40" cy="60" r="3" fill="#fbbf24" />
        </>
      )}
      
      {/* Guitar */}
      <g style={{
        transform: isPlaying ? "rotate(-3deg)" : "rotate(0deg)",
        transformOrigin: "40px 85px",
        transition: "transform 0.1s",
      }}>
        {/* Guitar neck */}
        <rect x="55" y="45" width="6" height="45" rx="2" fill={hasElectric ? "#1a1a1a" : "#8b6914"} />
        {/* Frets */}
        {[0,1,2,3,4,5].map(i => (
          <rect key={i} x="55" y={48 + i*7} width="6" height="1" fill="#ccc" />
        ))}
        {/* Headstock */}
        <rect x="54" y="38" width="8" height="10" rx="2" fill={hasElectric ? "#1a1a1a" : "#5c4033"} />
        {/* Tuning pegs */}
        <circle cx="55" cy="42" r="1.5" fill="#888" />
        <circle cx="61" cy="42" r="1.5" fill="#888" />
        
        {/* Guitar body */}
        <ellipse 
          cx="45" cy="95" rx="18" ry="22" 
          fill={hasElectric ? "#dc2626" : "#d4a574"}
          stroke={hasElectric ? "#991b1b" : "#8b6914"}
          strokeWidth="2"
        />
        {!hasElectric && (
          <ellipse cx="45" cy="95" rx="6" ry="7" fill="#3d2810" />
        )}
        {hasElectric && (
          <>
            <rect x="38" y="85" width="14" height="4" rx="1" fill="#fbbf24" />
            <rect x="38" y="100" width="14" height="4" rx="1" fill="#fbbf24" />
          </>
        )}
        {/* Strings */}
        <line x1="45" y1="73" x2="58" y2="48" stroke="#ddd" strokeWidth="0.5" />
        <line x1="47" y1="73" x2="59" y2="48" stroke="#ddd" strokeWidth="0.5" />
      </g>
      
      {/* Arms */}
      <g style={{
        animation: isPlaying ? "strum 0.15s ease-in-out infinite alternate" : undefined,
      }}>
        {/* Left arm (on neck) */}
        <path 
          d="M28,60 Q20,65 22,75 Q22,78 25,78 L30,75 Q32,72 30,65 Q30,60 28,60"
          fill={shirtColor}
        />
        <ellipse cx="54" cy="60" rx="5" ry="6" fill="#e8c4a0" />
        
        {/* Right arm (strumming) */}
        <path 
          d="M52,60 Q60,68 58,85 Q58,88 55,88 L50,85 Q48,80 50,70 Q50,62 52,60"
          fill={shirtColor}
        />
        <ellipse cx="52" cy="88" rx="5" ry="6" fill="#e8c4a0" />
      </g>
      
      {/* Neck */}
      <rect x="35" y="42" width="10" height="12" rx="3" fill="#e8c4a0" />
      
      {/* Head */}
      <ellipse cx="40" cy="30" rx="14" ry="16" fill="#e8c4a0" />
      
      {/* Hair */}
      <path 
        d="M26,26 Q26,14 40,14 Q54,14 54,26 Q54,20 48,18 Q40,15 32,18 Q26,20 26,26"
        fill="#2c1810"
      />
      
      {/* Hat (if upgraded) */}
      {hasHat && (
        <>
          <ellipse cx="40" cy="16" rx="16" ry="4" fill="#1a1a1a" />
          <rect x="30" y="8" width="20" height="10" rx="2" fill="#1a1a1a" />
        </>
      )}
      
      {/* Face */}
      {hasSunglasses ? (
        <>
          <rect x="30" y="26" width="9" height="6" rx="1" fill="#1a1a1a" />
          <rect x="41" y="26" width="9" height="6" rx="1" fill="#1a1a1a" />
          <line x1="39" y1="29" x2="41" y2="29" stroke="#1a1a1a" strokeWidth="1" />
        </>
      ) : (
        <>
          <ellipse cx="34" cy="28" rx="2" ry="2.5" fill="#2c2c2c" />
          <ellipse cx="46" cy="28" rx="2" ry="2.5" fill="#2c2c2c" />
        </>
      )}
      
      {/* Nose */}
      <path d="M40,30 L40,35 Q40,37 42,37" fill="none" stroke="#c4846a" strokeWidth="1.5" />
      
      {/* Mouth */}
      <path 
        d={isPlaying ? "M35,40 Q40,44 45,40" : "M36,40 Q40,42 44,40"} 
        fill="none" 
        stroke="#c4846a" 
        strokeWidth="1.5" 
      />
      
      {/* Ears */}
      <ellipse cx="26" cy="30" rx="2" ry="4" fill="#e8c4a0" />
      <ellipse cx="54" cy="30" rx="2" ry="4" fill="#e8c4a0" />
      
      {/* Microphone on stand (if owned) */}
      {hasMic && (
        <g>
          <rect x="12" y="50" width="3" height="80" fill="#444" />
          <rect x="8" y="125" width="11" height="8" rx="2" fill="#333" />
          <ellipse cx="13.5" cy="45" rx="6" ry="8" fill="#222" />
          <ellipse cx="13.5" cy="45" rx="4" ry="6" fill="#333" />
        </g>
      )}
    </svg>
  );
}

// Walking Pedestrian Component
function WalkingPedestrian({ 
  x, 
  style, 
  direction, 
  speed,
  willStop,
  willTip,
  stopPosition,
  onTip,
}: { 
  x: number;
  style: typeof PEDESTRIAN_STYLES[0];
  direction: "left" | "right";
  speed: number;
  willStop: boolean;
  willTip: boolean;
  stopPosition: number;
  onTip: () => void;
}) {
  const [currentX, setCurrentX] = useState(x);
  const [isStopped, setIsStopped] = useState(false);
  const [hasTipped, setHasTipped] = useState(false);
  const [showCoin, setShowCoin] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentX(prev => {
        const next = direction === "right" ? prev + speed : prev - speed;
        
        // Check if should stop
        if (willStop && !isStopped) {
          const distToStop = Math.abs(next - stopPosition);
          if (distToStop < 10) {
            setIsStopped(true);
            // Stay stopped for a while, maybe tip
            setTimeout(() => {
              if (willTip && !hasTipped) {
                setShowCoin(true);
                setHasTipped(true);
                onTip();
                setTimeout(() => setShowCoin(false), 800);
              }
              // Resume walking after stopping
              setTimeout(() => setIsStopped(false), willTip ? 2000 : 1500);
            }, 1000);
          }
        }
        
        return next;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [direction, speed, willStop, stopPosition, isStopped, willTip, hasTipped, onTip]);
  
  // Remove when off screen
  if ((direction === "right" && currentX > 500) || (direction === "left" && currentX < -50)) {
    return null;
  }
  
  return (
    <div style={{
      position: "absolute",
      left: currentX,
      bottom: 20,
      transition: isStopped ? "none" : undefined,
    }}>
      <Person 
        style={style} 
        isWalking={!isStopped} 
        direction={direction}
        isStopped={isStopped}
        scale={0.9}
      />
      {/* Coin throw animation */}
      {showCoin && (
        <div style={{
          position: "absolute",
          top: 20,
          left: direction === "right" ? 30 : -10,
          animation: "throwCoin 0.8s ease-out forwards",
        }}>
          🪙
        </div>
      )}
    </div>
  );
}

// Guitar Case / Tip Jar
function GuitarCase({ amount }: { amount: number }) {
  const fillHeight = Math.min(80, (amount % 500) / 5);
  
  return (
    <svg width="70" height="35" viewBox="0 0 70 35">
      {/* Case shadow */}
      <ellipse cx="35" cy="33" rx="32" ry="2" fill="rgba(0,0,0,0.3)" />
      
      {/* Case body */}
      <path 
        d="M5,8 Q2,8 2,12 L2,28 Q2,32 8,32 L62,32 Q68,32 68,28 L68,12 Q68,8 65,8 L55,5 Q50,3 35,3 Q20,3 15,5 L5,8"
        fill="#2c1810"
        stroke="#1a0f08"
        strokeWidth="1"
      />
      
      {/* Case interior */}
      <path 
        d="M8,10 L62,10 L60,28 L10,28 Z"
        fill="#4a3728"
      />
      
      {/* Velvet lining */}
      <path 
        d="M10,12 L60,12 L58,26 L12,26 Z"
        fill="#722f37"
      />
      
      {/* Coins */}
      <clipPath id="coinClip">
        <path d="M12,26 L58,26 L60,12 L10,12 Z" />
      </clipPath>
      <g clipPath="url(#coinClip)">
        <rect 
          x="10" 
          y={26 - fillHeight} 
          width="50" 
          height={fillHeight} 
          fill="url(#coinGradient)"
        />
        {/* Coin texture */}
        {Array.from({ length: Math.floor(fillHeight / 4) }).map((_, i) => (
          <ellipse 
            key={i} 
            cx={15 + (i * 7) % 40} 
            cy={24 - i * 3} 
            rx="4" 
            ry="2" 
            fill="#eab308"
            stroke="#ca8a04"
            strokeWidth="0.5"
          />
        ))}
      </g>
      
      {/* Gradient definition */}
      <defs>
        <linearGradient id="coinGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
      </defs>
      
      {/* Case latch */}
      <rect x="32" y="6" width="6" height="4" rx="1" fill="#b8860b" />
    </svg>
  );
}

// Flying Coin Effect
function FlyingCoin({ x, y, amount }: { x: number; y: number; amount: number }) {
  return (
    <div style={{
      position: "absolute",
      left: x,
      top: y,
      pointerEvents: "none",
      animation: "coinFly 1s ease-out forwards",
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      gap: 4,
      color: "#fbbf24",
      fontWeight: 700,
      fontSize: 18,
      textShadow: "0 2px 4px rgba(0,0,0,0.8)",
    }}>
      <span>🪙</span>
      <span>+{formatNumber(amount)}</span>
    </div>
  );
}

export default function MusicianBeggarPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Game state
  const [zc, setZc] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [zps, setZps] = useState(0);
  const [zpc, setZpc] = useState(1);
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [flyingCoins, setFlyingCoins] = useState<Array<{ id: number; x: number; y: number; amount: number }>>([]);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"skill" | "instrument" | "gear" | "attraction">("skill");
  const [pedestrians, setPedestrians] = useState<Array<{
    id: number;
    x: number;
    style: typeof PEDESTRIAN_STYLES[0];
    direction: "left" | "right";
    speed: number;
    willStop: boolean;
    willTip: boolean;
  }>>([]);
  
  const coinIdRef = useRef(0);
  const pedestrianIdRef = useRef(0);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const spawnLoopRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createBrowserClient();
  const router = useRouter();

  // Calculate stats from upgrades
  const recalculateStats = useCallback((levels: Record<string, number>) => {
    let newZps = 0;
    let newZpc = 1;
    
    for (const upgrade of UPGRADES) {
      const level = levels[upgrade.id] || 0;
      newZps += upgrade.zpsBonus * level;
      newZpc += upgrade.zpcBonus * level;
    }
    
    setZps(newZps);
    setZpc(newZpc);
  }, []);

  // Load game
  const loadGame = useCallback(() => {
    try {
      const saved = localStorage.getItem("musician-beggar-v3");
      if (saved) {
        const data = JSON.parse(saved);
        setZc(data.zc || 0);
        setTotalEarned(data.totalEarned || 0);
        setUpgradeLevels(data.upgradeLevels || {});
        recalculateStats(data.upgradeLevels || {});
        
        // Offline earnings
        if (data.lastSave && data.zps) {
          const offlineSeconds = Math.min((Date.now() - data.lastSave) / 1000, 8 * 60 * 60);
          const offlineEarnings = Math.floor(offlineSeconds * data.zps * 0.5);
          if (offlineEarnings > 0) {
            setZc(prev => prev + offlineEarnings);
            setTotalEarned(prev => prev + offlineEarnings);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load:", e);
    }
  }, [recalculateStats]);

  // Save game
  const saveGame = useCallback(() => {
    try {
      localStorage.setItem("musician-beggar-v3", JSON.stringify({
        zc, totalEarned, upgradeLevels, zps, lastSave: Date.now(),
      }));
    } catch (e) {
      console.error("Failed to save:", e);
    }
  }, [zc, totalEarned, upgradeLevels, zps]);

  // Spawn pedestrians
  const spawnPedestrian = useCallback(() => {
    const direction: "left" | "right" = Math.random() > 0.5 ? "right" : "left";
    const attractionLevel = (upgradeLevels["sign"] || 0) + (upgradeLevels["banner"] || 0) + (upgradeLevels["costume"] || 0) + (upgradeLevels["mascot"] || 0);
    const stopChance = Math.min(0.4, 0.1 + attractionLevel * 0.02);
    const tipChance = Math.min(0.6, 0.2 + attractionLevel * 0.03);
    
    const newPedestrian = {
      id: pedestrianIdRef.current++,
      x: direction === "right" ? -50 : 450,
      style: PEDESTRIAN_STYLES[Math.floor(Math.random() * PEDESTRIAN_STYLES.length)],
      direction,
      speed: 1.5 + Math.random() * 1.5,
      willStop: Math.random() < stopChance,
      willTip: Math.random() < tipChance,
    };
    
    setPedestrians(prev => [...prev.slice(-15), newPedestrian]); // Keep max 15 pedestrians
  }, [upgradeLevels]);

  // Handle pedestrian tip
  const handlePedestrianTip = useCallback(() => {
    const tipAmount = Math.floor(zpc * (0.5 + Math.random() * 1));
    setZc(prev => prev + tipAmount);
    setTotalEarned(prev => prev + tipAmount);
  }, [zpc]);

  // Handle click on musician
  const handleMusicianClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setZc(prev => prev + zpc);
    setTotalEarned(prev => prev + zpc);
    setIsPlaying(true);
    
    // Flying coin effect
    const coinId = coinIdRef.current++;
    setFlyingCoins(prev => [...prev, { id: coinId, x, y, amount: zpc }]);
    setTimeout(() => setFlyingCoins(prev => prev.filter(c => c.id !== coinId)), 1000);
    
    setTimeout(() => setIsPlaying(false), 150);
  }, [zpc]);

  // Buy upgrade
  const buyUpgrade = useCallback((upgradeId: string) => {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return;
    
    const level = upgradeLevels[upgradeId] || 0;
    if (level >= upgrade.maxLevel) return;
    
    const cost = getUpgradeCost(upgrade, level);
    if (zc < cost) return;
    
    setZc(prev => prev - cost);
    setUpgradeLevels(prev => {
      const newLevels = { ...prev, [upgradeId]: level + 1 };
      recalculateStats(newLevels);
      return newLevels;
    });
  }, [zc, upgradeLevels, recalculateStats]);

  // Initialize
  useEffect(() => {
    async function init() {
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
      
      if (userInfo) setUserData(userInfo);
      loadGame();
      setLoading(false);
    }
    init();
  }, [supabase, router, loadGame]);

  // Game loop for passive income
  useEffect(() => {
    if (loading) return;
    
    gameLoopRef.current = setInterval(() => {
      if (zps > 0) {
        const earned = zps / 10;
        setZc(prev => prev + earned);
        setTotalEarned(prev => prev + earned);
      }
    }, 100);
    
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, [loading, zps]);

  // Pedestrian spawn loop
  useEffect(() => {
    if (loading) return;
    
    // Initial spawn
    for (let i = 0; i < 3; i++) {
      setTimeout(() => spawnPedestrian(), i * 500);
    }
    
    spawnLoopRef.current = setInterval(spawnPedestrian, 2000 + Math.random() * 2000);
    
    return () => { if (spawnLoopRef.current) clearInterval(spawnLoopRef.current); };
  }, [loading, spawnPedestrian]);

  // Auto-save
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(saveGame, 30000);
    return () => { clearInterval(interval); saveGame(); };
  }, [loading, saveGame]);

  // Save on leave
  useEffect(() => {
    window.addEventListener("beforeunload", saveGame);
    return () => window.removeEventListener("beforeunload", saveGame);
  }, [saveGame]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#1a1a2e" }}>
        <div style={{ height: 60, background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.1)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{
            width: 48, height: 48,
            border: "3px solid rgba(234, 179, 8, 0.2)",
            borderTopColor: "#eab308",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
        </div>
      </div>
    );
  }

  const hasElectric = (upgradeLevels["electric"] || 0) > 0;
  const hasMic = (upgradeLevels["mic"] || 0) > 0;
  const outfitLevel = Math.min(3, (upgradeLevels["costume"] || 0));

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)" }}>
      <Header user={user} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px" }}>
        <Link href="/game-hub" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#eab308", textDecoration: "none", fontSize: 14, marginBottom: 16 }}>
          ← Back to Game Hub
        </Link>

        {/* ZC Display */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ color: "#fbbf24", fontSize: 42, fontWeight: 800, textShadow: "0 0 30px rgba(234, 179, 8, 0.5)" }}>
            🪙 {formatNumber(zc)} ZC
          </div>
          <div style={{ color: "#888", fontSize: 14 }}>
            {formatNumber(zpc)}/click • {formatNumber(zps)}/sec
          </div>
        </div>

        {/* Street Scene */}
        <div 
          onClick={handleMusicianClick}
          style={{
            position: "relative",
            height: 380,
            borderRadius: 16,
            overflow: "hidden",
            cursor: "pointer",
            border: "2px solid rgba(255,255,255,0.1)",
            marginBottom: 16,
          }}
        >
          {/* Sky */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 150,
            background: "linear-gradient(180deg, #0f0f23 0%, #1a1a3e 50%, #2d2d5a 100%)",
          }} />
          
          {/* Stars */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              top: 10 + Math.random() * 100,
              left: `${Math.random() * 100}%`,
              width: 2,
              height: 2,
              background: "#fff",
              borderRadius: "50%",
              opacity: 0.3 + Math.random() * 0.5,
            }} />
          ))}
          
          {/* Moon */}
          <div style={{
            position: "absolute",
            top: 20,
            right: 40,
            width: 40,
            height: 40,
            background: "radial-gradient(circle at 30% 30%, #fffacd, #f0e68c)",
            borderRadius: "50%",
            boxShadow: "0 0 30px rgba(255, 250, 205, 0.4)",
          }} />
          
          {/* Buildings background */}
          <div style={{ position: "absolute", bottom: 120, left: 0, right: 0, height: 180 }}>
            {/* Far buildings */}
            <div style={{ position: "absolute", bottom: 0, left: 20, width: 60, height: 140, background: "#1a1a2e", borderRadius: "4px 4px 0 0" }}>
              {[20, 50, 80, 110].map((top, i) => (
                <div key={i} style={{ position: "absolute", top, left: 10, width: 12, height: 15, background: Math.random() > 0.3 ? "#fbbf2440" : "#333", borderRadius: 2 }} />
              ))}
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 90, width: 80, height: 170, background: "#16213e", borderRadius: "4px 4px 0 0" }}>
              {[20, 50, 80, 110, 140].map((top, i) => (
                <div key={i} style={{ position: "absolute", top, left: 15, width: 15, height: 18, background: Math.random() > 0.4 ? "#fbbf2430" : "#2a2a4a", borderRadius: 2 }} />
              ))}
              {[20, 50, 80, 110, 140].map((top, i) => (
                <div key={i} style={{ position: "absolute", top, right: 15, width: 15, height: 18, background: Math.random() > 0.4 ? "#fbbf2430" : "#2a2a4a", borderRadius: 2 }} />
              ))}
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 60, width: 70, height: 120, background: "#1a1a2e", borderRadius: "4px 4px 0 0" }}>
              {[15, 40, 65, 90].map((top, i) => (
                <div key={i} style={{ position: "absolute", top, left: 12, width: 14, height: 16, background: Math.random() > 0.3 ? "#fbbf2440" : "#333", borderRadius: 2 }} />
              ))}
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 140, width: 55, height: 100, background: "#0f1629", borderRadius: "4px 4px 0 0" }} />
            
            {/* Store fronts closer */}
            <div style={{ position: "absolute", bottom: 0, left: 180, width: 100, height: 80, background: "#2a2a4a", borderRadius: "4px 4px 0 0" }}>
              {/* Store window */}
              <div style={{ position: "absolute", bottom: 10, left: 10, width: 35, height: 40, background: "#fbbf2420", border: "2px solid #3d3d5c", borderRadius: 2 }} />
              <div style={{ position: "absolute", bottom: 10, right: 10, width: 35, height: 40, background: "#fbbf2420", border: "2px solid #3d3d5c", borderRadius: 2 }} />
              {/* Store sign */}
              <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", padding: "2px 8px", background: "#dc2626", borderRadius: 2, fontSize: 8, color: "#fff" }}>OPEN</div>
            </div>
          </div>
          
          {/* Street lamp */}
          <div style={{ position: "absolute", bottom: 120, left: 50 }}>
            <div style={{ width: 6, height: 120, background: "#3d3d3d", borderRadius: 3 }} />
            <div style={{ position: "absolute", top: -15, left: -12, width: 30, height: 20, background: "#4a4a4a", borderRadius: "4px 4px 0 0" }} />
            <div style={{ position: "absolute", top: 0, left: -8, width: 22, height: 8, background: "#fbbf24", borderRadius: 2, boxShadow: "0 0 30px #fbbf24, 0 20px 40px rgba(251, 191, 36, 0.3)" }} />
          </div>
          
          {/* Street lamp 2 */}
          <div style={{ position: "absolute", bottom: 120, right: 80 }}>
            <div style={{ width: 6, height: 100, background: "#3d3d3d", borderRadius: 3 }} />
            <div style={{ position: "absolute", top: -15, left: -12, width: 30, height: 20, background: "#4a4a4a", borderRadius: "4px 4px 0 0" }} />
            <div style={{ position: "absolute", top: 0, left: -8, width: 22, height: 8, background: "#fbbf24", borderRadius: 2, boxShadow: "0 0 30px #fbbf24, 0 20px 40px rgba(251, 191, 36, 0.3)" }} />
          </div>
          
          {/* Road */}
          <div style={{
            position: "absolute",
            bottom: 60,
            left: 0,
            right: 0,
            height: 60,
            background: "#2d2d3d",
          }}>
            {/* Road lines */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 4,
              background: "repeating-linear-gradient(90deg, #eab308 0px, #eab308 30px, transparent 30px, transparent 60px)",
              transform: "translateY(-50%)",
            }} />
          </div>
          
          {/* Sidewalk */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            background: "linear-gradient(180deg, #4a4a5c 0%, #3d3d4d 100%)",
          }}>
            {/* Sidewalk tiles */}
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "repeating-linear-gradient(90deg, transparent 0px, transparent 58px, #3a3a4a 58px, #3a3a4a 60px)",
            }} />
            {/* Curb */}
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              background: "#5a5a6c",
            }} />
          </div>
          
          {/* Walking Pedestrians */}
          {pedestrians.map(ped => (
            <WalkingPedestrian
              key={ped.id}
              x={ped.x}
              style={ped.style}
              direction={ped.direction}
              speed={ped.speed}
              willStop={ped.willStop}
              willTip={ped.willTip}
              stopPosition={220}
              onTip={handlePedestrianTip}
            />
          ))}
          
          {/* Musician area */}
          <div style={{ 
            position: "absolute", 
            bottom: 60, 
            left: "50%", 
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}>
            {/* Guitar case */}
            <div style={{ position: "absolute", bottom: -10, left: 90 }}>
              <GuitarCase amount={zc} />
            </div>
            
            {/* The musician */}
            <StreetMusician 
              isPlaying={isPlaying} 
              hasElectric={hasElectric}
              hasMic={hasMic}
              outfitLevel={outfitLevel}
            />
            
            {/* Amp (if owned) */}
            {(upgradeLevels["amp"] || 0) > 0 && (
              <div style={{ position: "absolute", bottom: 0, left: -50 }}>
                <svg width="40" height="45" viewBox="0 0 40 45">
                  <rect x="2" y="5" width="36" height="38" rx="3" fill="#1a1a1a" stroke="#333" strokeWidth="2" />
                  <rect x="6" y="10" width="28" height="20" rx="2" fill="#0a0a0a" />
                  {/* Speaker grille */}
                  {Array.from({ length: 4 }).map((_, row) => (
                    Array.from({ length: 6 }).map((_, col) => (
                      <circle key={`${row}-${col}`} cx={10 + col * 4.5} cy={14 + row * 4.5} r="1.5" fill="#333" />
                    ))
                  ))}
                  {/* Knobs */}
                  <circle cx="12" cy="36" r="3" fill="#444" />
                  <circle cx="22" cy="36" r="3" fill="#444" />
                  <circle cx="32" cy="36" r="3" fill="#444" />
                  {/* Power light */}
                  <circle cx="7" cy="36" r="2" fill="#22c55e" />
                </svg>
              </div>
            )}
          </div>

          {/* Flying coins */}
          {flyingCoins.map(coin => (
            <FlyingCoin key={coin.id} x={coin.x} y={coin.y} amount={coin.amount} />
          ))}

          {/* Click hint */}
          <div style={{
            position: "absolute",
            bottom: 70,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.3)",
            fontSize: 11,
            pointerEvents: "none",
          }}>
            Click to play!
          </div>
        </div>

        {/* Upgrades Button */}
        <button
          onClick={() => setShowUpgrades(!showUpgrades)}
          style={{
            width: "100%",
            padding: "16px",
            background: showUpgrades ? "#eab308" : "rgba(234, 179, 8, 0.2)",
            border: "2px solid #eab308",
            borderRadius: 12,
            color: showUpgrades ? "#000" : "#eab308",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          {showUpgrades ? "▼ Hide Upgrades" : "▲ Show Upgrades"}
        </button>

        {/* Upgrades Panel */}
        {showUpgrades && (
          <div style={{
            background: "rgba(0,0,0,0.6)",
            borderRadius: 16,
            border: "2px solid rgba(234, 179, 8, 0.3)",
            overflow: "hidden",
          }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              {(["skill", "instrument", "gear", "attraction"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  style={{
                    flex: 1,
                    padding: "12px 8px",
                    background: selectedTab === tab ? "rgba(234, 179, 8, 0.2)" : "transparent",
                    border: "none",
                    borderBottom: selectedTab === tab ? "2px solid #eab308" : "2px solid transparent",
                    color: selectedTab === tab ? "#eab308" : "#888",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {tab === "skill" ? "✋" : tab === "instrument" ? "🎸" : tab === "gear" ? "🔊" : "✨"} {tab}
                </button>
              ))}
            </div>

            {/* Upgrade list */}
            <div style={{ maxHeight: 300, overflowY: "auto", padding: 8 }}>
              {UPGRADES.filter(u => u.category === selectedTab).map(upgrade => {
                const level = upgradeLevels[upgrade.id] || 0;
                const cost = getUpgradeCost(upgrade, level);
                const canAfford = zc >= cost && level < upgrade.maxLevel;
                const isMaxed = level >= upgrade.maxLevel;

                return (
                  <div key={upgrade.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 4,
                    background: level > 0 ? "rgba(234, 179, 8, 0.05)" : "transparent",
                  }}>
                    <div style={{ width: 50, textAlign: "center" }}>
                      <div style={{ fontSize: 24 }}>
                        {upgrade.category === "skill" ? "✋" : upgrade.category === "instrument" ? "🎸" : upgrade.category === "gear" ? "🔊" : "✨"}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                        {upgrade.name}
                        {level > 0 && <span style={{ color: "#eab308", marginLeft: 8 }}>Lv.{level}</span>}
                      </div>
                      <div style={{ color: "#888", fontSize: 12 }}>{upgrade.description}</div>
                      {!isMaxed && (
                        <div style={{ color: "#22c55e", fontSize: 11, marginTop: 2 }}>
                          +{upgrade.zpsBonus > 0 ? `${upgrade.zpsBonus}/sec` : `${upgrade.zpcBonus}/click`}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); buyUpgrade(upgrade.id); }}
                      disabled={!canAfford}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: isMaxed ? "#22c55e" : canAfford ? "linear-gradient(135deg, #eab308, #ca8a04)" : "#333",
                        color: isMaxed || canAfford ? "#000" : "#666",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: canAfford ? "pointer" : "default",
                        minWidth: 85,
                      }}
                    >
                      {isMaxed ? "MAX" : `${formatNumber(cost)} ZC`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes coinFly {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-100px) scale(1.5); }
        }
        @keyframes throwCoin {
          0% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          100% { opacity: 0; transform: translate(30px, 30px) rotate(360deg); }
        }
        @keyframes walkLegs {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(8deg); }
          75% { transform: rotate(-8deg); }
        }
        @keyframes walkArms {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes strum {
          0% { transform: rotate(-2deg); }
          100% { transform: rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
