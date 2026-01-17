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

type UpgradeType = {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  zpsBonus: number;
  zpcBonus: number;
  maxLevel: number;
  category: "skill" | "instrument" | "gear" | "attraction";
};

const UPGRADES: UpgradeType[] = [
  { id: "practice", name: "Practice", description: "Better technique", baseCost: 25, costMultiplier: 1.08, zpsBonus: 0, zpcBonus: 1, maxLevel: 100, category: "skill" },
  { id: "repertoire", name: "Repertoire", description: "More songs", baseCost: 200, costMultiplier: 1.1, zpsBonus: 0, zpcBonus: 3, maxLevel: 75, category: "skill" },
  { id: "showmanship", name: "Showmanship", description: "Work the crowd", baseCost: 1000, costMultiplier: 1.1, zpsBonus: 0, zpcBonus: 10, maxLevel: 50, category: "skill" },
  { id: "charisma", name: "Charisma", description: "Natural charm", baseCost: 10000, costMultiplier: 1.12, zpsBonus: 0, zpcBonus: 50, maxLevel: 50, category: "skill" },
  { id: "viral", name: "Go Viral", description: "Internet fame", baseCost: 250000, costMultiplier: 1.15, zpsBonus: 0, zpcBonus: 500, maxLevel: 25, category: "skill" },
  { id: "acoustic", name: "Acoustic Guitar", description: "Trusty six-string", baseCost: 50, costMultiplier: 1.15, zpsBonus: 1, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "harmonica", name: "Harmonica", description: "Blues vibes", baseCost: 300, costMultiplier: 1.15, zpsBonus: 4, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "electric", name: "Electric Guitar", description: "Plug in", baseCost: 2500, costMultiplier: 1.15, zpsBonus: 15, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "keyboard", name: "Keyboard", description: "Ivory keys", baseCost: 15000, costMultiplier: 1.15, zpsBonus: 60, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "amp", name: "Amplifier", description: "Get loud", baseCost: 150, costMultiplier: 1.12, zpsBonus: 2, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "mic", name: "Microphone", description: "Sing out", baseCost: 800, costMultiplier: 1.12, zpsBonus: 6, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "speakers", name: "Speakers", description: "Full sound", baseCost: 5000, costMultiplier: 1.12, zpsBonus: 30, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "sign", name: "Cardboard Sign", description: "Anything helps", baseCost: 100, costMultiplier: 1.2, zpsBonus: 3, zpcBonus: 0, maxLevel: 20, category: "attraction" },
  { id: "dog", name: "Loyal Dog", description: "Best friend", baseCost: 2000, costMultiplier: 1.2, zpsBonus: 20, zpcBonus: 0, maxLevel: 20, category: "attraction" },
  { id: "story", name: "Sad Story", description: "Tug heartstrings", baseCost: 20000, costMultiplier: 1.2, zpsBonus: 120, zpcBonus: 0, maxLevel: 20, category: "attraction" },
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

const SCENE_WIDTH = 600;

// Pedestrian walking - smoother animation
function WalkingPerson({ 
  id,
  startX, 
  skinColor,
  hairColor,
  shirtColor,
  pantsColor,
  speed,
  direction,
  willTip,
  musicianX,
  onExit,
  onTip,
}: { 
  id: number;
  startX: number;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  speed: number;
  direction: "left" | "right";
  willTip: boolean;
  musicianX: number;
  onExit: (id: number) => void;
  onTip: () => void;
}) {
  const [x, setX] = useState(startX);
  const [frame, setFrame] = useState(0);
  const [hasTipped, setHasTipped] = useState(false);
  const [showCoin, setShowCoin] = useState(false);
  const exitedRef = useRef(false);
  
  // Smooth walk cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 8);
    }, 80);
    return () => clearInterval(interval);
  }, []);
  
  // Movement
  useEffect(() => {
    const interval = setInterval(() => {
      setX(prev => {
        const next = direction === "right" ? prev + speed : prev - speed;
        
        // Tip when passing musician
        if (willTip && !hasTipped) {
          const dist = Math.abs(next - musicianX);
          if (dist < 40) {
            setHasTipped(true);
            setShowCoin(true);
            onTip();
            setTimeout(() => setShowCoin(false), 500);
          }
        }
        
        // Exit check - fully off screen
        if (!exitedRef.current) {
          if ((direction === "right" && next > SCENE_WIDTH + 50) || (direction === "left" && next < -50)) {
            exitedRef.current = true;
            onExit(id);
          }
        }
        
        return next;
      });
    }, 25);
    return () => clearInterval(interval);
  }, [direction, speed, willTip, hasTipped, musicianX, onTip, onExit, id]);
  
  // Walk cycle - smooth sine-based leg movement
  const legPhase = (frame / 8) * Math.PI * 2;
  const leftLegX = Math.sin(legPhase) * 3;
  const rightLegX = Math.sin(legPhase + Math.PI) * 3;
  const leftArmSwing = Math.sin(legPhase + Math.PI) * 8;
  const rightArmSwing = Math.sin(legPhase) * 8;
  const bodyBob = Math.abs(Math.sin(legPhase * 2)) * 1;
  
  return (
    <div style={{
      position: "absolute",
      left: x,
      bottom: 15,
      zIndex: 50,
      transform: direction === "left" ? "scaleX(-1)" : "scaleX(1)",
    }}>
      <svg width="28" height="58" viewBox="0 0 28 58" style={{ overflow: "visible" }}>
        {/* Shadow */}
        <ellipse cx="14" cy="56" rx="9" ry="2" fill="rgba(0,0,0,0.25)" />
        
        {/* Left leg (back) */}
        <g transform={`translate(${leftLegX}, 0)`}>
          <path d={`M10,32 L${9 + leftLegX * 0.5},44 L${9 + leftLegX * 0.3},52`} stroke={pantsColor} strokeWidth="5" strokeLinecap="round" fill="none" />
          <ellipse cx={9 + leftLegX * 0.3} cy="54" rx="4" ry="2" fill="#1a1a1a" />
        </g>
        
        {/* Right leg (front) */}
        <g transform={`translate(${rightLegX}, 0)`}>
          <path d={`M18,32 L${19 + rightLegX * 0.5},44 L${19 + rightLegX * 0.3},52`} stroke={pantsColor} strokeWidth="5" strokeLinecap="round" fill="none" />
          <ellipse cx={19 + rightLegX * 0.3} cy="54" rx="4" ry="2" fill="#1a1a1a" />
        </g>
        
        {/* Body */}
        <g transform={`translate(0, ${-bodyBob})`}>
          {/* Torso */}
          <path d="M8,16 Q5,18 5,24 L5,34 Q5,36 10,36 L18,36 Q23,36 23,34 L23,24 Q23,18 20,16 Q16,14 14,14 Q12,14 8,16" fill={shirtColor} />
          
          {/* Left arm */}
          <g transform={`rotate(${leftArmSwing}, 8, 18)`}>
            <path d="M6,18 L4,30" stroke={shirtColor} strokeWidth="4" strokeLinecap="round" />
            <circle cx="4" cy="31" r="2.5" fill={skinColor} />
          </g>
          
          {/* Right arm */}
          <g transform={`rotate(${rightArmSwing}, 20, 18)`}>
            <path d="M22,18 L24,30" stroke={shirtColor} strokeWidth="4" strokeLinecap="round" />
            <circle cx="24" cy="31" r="2.5" fill={skinColor} />
          </g>
          
          {/* Neck */}
          <rect x="12" y="10" width="4" height="5" rx="1" fill={skinColor} />
          
          {/* Head */}
          <ellipse cx="14" cy="7" rx="7" ry="8" fill={skinColor} />
          
          {/* Hair */}
          <path d="M7,5 Q7,-1 14,-1 Q21,-1 21,5 Q21,2 17,1 Q14,0 11,1 Q7,2 7,5" fill={hairColor} />
          
          {/* Face */}
          <circle cx="11" cy="6" r="1.2" fill="#222" />
          <circle cx="17" cy="6" r="1.2" fill="#222" />
          <path d="M12,10 Q14,11.5 16,10" fill="none" stroke="#a08878" strokeWidth="0.7" />
          
          {/* Ear */}
          <ellipse cx="21" cy="7" rx="1.5" ry="2.5" fill={skinColor} />
        </g>
      </svg>
      
      {/* Coin toss */}
      {showCoin && (
        <div style={{
          position: "absolute",
          top: 10,
          left: 25,
          animation: "toss 0.5s ease-out forwards",
          fontSize: 14,
        }}>🪙</div>
      )}
    </div>
  );
}

// Homeless Musician
function HomelessMusician({ isPlaying, hasSign, hasDog }: { isPlaying: boolean; hasSign: boolean; hasDog: boolean }) {
  return (
    <div style={{ position: "relative", width: 100, height: 130, zIndex: 10 }}>
      {/* Blanket on ground */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: -5,
        width: 110,
        height: 12,
        background: "linear-gradient(90deg, #4a3a2a 0%, #6a5a4a 50%, #4a3a2a 100%)",
        borderRadius: 2,
      }} />
      
      {/* Hat for coins */}
      <div style={{
        position: "absolute",
        bottom: 5,
        right: -5,
        width: 28,
        height: 10,
        background: "#222",
        borderRadius: "0 0 50% 50%",
      }}>
        <div style={{ position: "absolute", top: 2, left: 6, width: 5, height: 3, background: "#b8860b", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: 4, left: 14, width: 4, height: 2, background: "#daa520", borderRadius: "50%" }} />
      </div>
      
      {/* Dog */}
      {hasDog && (
        <div style={{ position: "absolute", bottom: 8, left: -30 }}>
          <svg width="30" height="25" viewBox="0 0 30 25">
            <ellipse cx="18" cy="15" rx="10" ry="7" fill="#8b5a2b" />
            <ellipse cx="6" cy="10" rx="6" ry="5" fill="#8b5a2b" />
            <ellipse cx="3" cy="8" rx="2" ry="3" fill="#6b4423" />
            <circle cx="4" cy="9" r="1.5" fill="#222" />
            <ellipse cx="1" cy="12" rx="2" ry="1.5" fill="#222" />
            <rect x="10" y="20" width="3" height="5" rx="1" fill="#8b5a2b" />
            <rect x="20" y="20" width="3" height="5" rx="1" fill="#8b5a2b" />
            <path d="M26,10 Q30,5 28,12" fill="#8b5a2b" />
          </svg>
        </div>
      )}
      
      {/* Sign */}
      {hasSign && (
        <div style={{
          position: "absolute",
          bottom: 15,
          right: -25,
          width: 32,
          height: 22,
          background: "#a08060",
          border: "1px solid #705030",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotate(3deg)",
        }}>
          <span style={{ fontSize: 5, color: "#222", fontWeight: "bold", textAlign: "center", lineHeight: 1 }}>ANYTHING<br/>HELPS</span>
        </div>
      )}
      
      {/* Musician SVG */}
      <svg width="80" height="110" viewBox="0 0 80 110" style={{ position: "absolute", bottom: 8, left: 10 }}>
        {/* Crossed legs */}
        <ellipse cx="25" cy="95" rx="18" ry="7" fill="#3d3d4d" />
        <ellipse cx="55" cy="95" rx="18" ry="7" fill="#3d3d4d" />
        <ellipse cx="10" cy="97" rx="7" ry="4" fill="#222" />
        <ellipse cx="70" cy="97" rx="7" ry="4" fill="#222" />
        
        {/* Body */}
        <path d="M25,45 Q15,50 15,60 L15,88 Q15,92 25,92 L55,92 Q65,92 65,88 L65,60 Q65,50 55,45 Q45,40 40,40 Q35,40 25,45" fill="#4a4a4a" />
        <path d="M20,55 Q25,60 20,70" fill="none" stroke="#3a3a3a" strokeWidth="1" />
        
        {/* Guitar */}
        <g style={{ transform: isPlaying ? "rotate(-2deg)" : "rotate(0deg)", transformOrigin: "40px 70px", transition: "transform 0.1s" }}>
          <rect x="52" y="30" width="5" height="38" rx="1" fill="#5c4033" />
          {[0,1,2,3,4].map(i => <rect key={i} x="52" y={33 + i*7} width="5" height="1" fill="#888" />)}
          <rect x="51" y="22" width="7" height="10" rx="1" fill="#3d2817" />
          <circle cx="52" cy="26" r="1.5" fill="#666" />
          <circle cx="56" cy="26" r="1.5" fill="#666" />
          <ellipse cx="40" cy="72" rx="15" ry="18" fill="#a08060" stroke="#806040" strokeWidth="1.5" />
          <ellipse cx="40" cy="72" rx="5" ry="6" fill="#2c1810" />
          <line x1="40" y1="54" x2="54" y2="33" stroke="#bbb" strokeWidth="0.4" />
        </g>
        
        {/* Arms */}
        <path d={isPlaying ? "M25,50 Q12,60 18,75" : "M25,50 Q14,60 20,75"} fill="none" stroke="#4a4a4a" strokeWidth="8" strokeLinecap="round" />
        <path d={isPlaying ? "M55,50 Q68,58 58,72" : "M55,50 Q66,58 56,72"} fill="none" stroke="#4a4a4a" strokeWidth="8" strokeLinecap="round" />
        <circle cx={isPlaying ? 18 : 20} cy="75" r="5" fill="#c4a67c" />
        <circle cx={isPlaying ? 58 : 56} cy="72" r="5" fill="#c4a67c" />
        
        {/* Neck */}
        <rect x="36" y="30" width="8" height="12" rx="2" fill="#c4a67c" />
        
        {/* Head */}
        <ellipse cx="40" cy="20" rx="12" ry="14" fill="#c4a67c" />
        
        {/* Beanie */}
        <path d="M28,16 Q28,6 40,6 Q52,6 52,16" fill="#4a6670" />
        <rect x="28" y="14" width="24" height="4" fill="#4a6670" />
        
        {/* Face */}
        <ellipse cx="35" cy="20" rx="2" ry="1.5" fill="#222" />
        <ellipse cx="45" cy="20" rx="2" ry="1.5" fill="#222" />
        <path d="M33,22 Q35,23 37,22" fill="none" stroke="#a08878" strokeWidth="0.5" />
        <path d="M43,22 Q45,23 47,22" fill="none" stroke="#a08878" strokeWidth="0.5" />
        <path d="M40,22 L40,26 Q40,28 42,28" fill="none" stroke="#a08878" strokeWidth="1" />
        <path d={isPlaying ? "M36,31 Q40,34 44,31" : "M37,31 Q40,32 43,31"} fill="none" stroke="#8a6a5a" strokeWidth="1" />
        <ellipse cx="52" cy="20" rx="2" ry="3" fill="#c4a67c" />
        
        {/* Stubble */}
        {[0,1,2,3,4].map(i => <circle key={i} cx={35 + (i%3)*4} cy={28 + Math.floor(i/3)*2} r="0.4" fill="#8a7a6a" opacity="0.5" />)}
      </svg>
    </div>
  );
}

// Store building
function Store({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <div 
      onClick={onClick}
      style={{
        position: "absolute",
        bottom: 70,
        right: 30,
        cursor: "pointer",
        transition: "transform 0.2s",
        zIndex: 5,
      }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <svg width="90" height="100" viewBox="0 0 90 100">
        {/* Building */}
        <rect x="5" y="20" width="80" height="80" fill="#2a2a35" stroke="#1a1a25" strokeWidth="2" />
        
        {/* Roof */}
        <path d="M0,22 L45,2 L90,22" fill="#3a3a45" stroke="#2a2a35" strokeWidth="1" />
        
        {/* Window/Door */}
        <rect x="20" y="45" width="50" height="55" rx="2" fill="#1a1a25" />
        <rect x="22" y="47" width="46" height="35" fill={isOpen ? "#4a4535" : "#2a2a30"} />
        
        {/* Sign */}
        <rect x="15" y="28" width="60" height="14" rx="2" fill="#8b4513" />
        <text x="45" y="39" textAnchor="middle" fontSize="8" fill="#daa520" fontWeight="bold">UPGRADES</text>
        
        {/* Door handle */}
        <circle cx="62" cy="75" r="3" fill="#b8860b" />
        
        {/* Open sign */}
        {!isOpen && (
          <g>
            <rect x="30" y="55" width="30" height="12" rx="1" fill="#222" />
            <text x="45" y="64" textAnchor="middle" fontSize="6" fill="#4ade80">OPEN</text>
          </g>
        )}
      </svg>
    </div>
  );
}

// Store Modal
function StoreModal({ 
  isOpen, 
  onClose, 
  zc, 
  upgradeLevels, 
  onBuy 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  zc: number;
  upgradeLevels: Record<string, number>;
  onBuy: (id: string) => void;
}) {
  const [tab, setTab] = useState<"skill" | "instrument" | "gear" | "attraction">("skill");
  
  if (!isOpen) return null;
  
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: "#1a1a1a",
        borderRadius: 12,
        width: "90%",
        maxWidth: 450,
        maxHeight: "80vh",
        overflow: "hidden",
        border: "2px solid #daa520",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <div style={{ color: "#daa520", fontSize: 18, fontWeight: 700 }}>🏪 Upgrade Store</div>
            <div style={{ color: "#888", fontSize: 12 }}>Balance: {formatNumber(zc)} ZC</div>
          </div>
          <button onClick={onClose} style={{
            background: "none",
            border: "none",
            color: "#888",
            fontSize: 24,
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}>×</button>
        </div>
        
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #333" }}>
          {(["skill", "instrument", "gear", "attraction"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "10px 4px",
                background: tab === t ? "rgba(218,165,32,0.15)" : "transparent",
                border: "none",
                borderBottom: tab === t ? "2px solid #daa520" : "2px solid transparent",
                color: tab === t ? "#daa520" : "#666",
                fontSize: 11,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >{t}</button>
          ))}
        </div>
        
        {/* Items */}
        <div style={{ maxHeight: 350, overflowY: "auto", padding: 8 }}>
          {UPGRADES.filter(u => u.category === tab).map(upgrade => {
            const level = upgradeLevels[upgrade.id] || 0;
            const cost = getUpgradeCost(upgrade, level);
            const canAfford = zc >= cost && level < upgrade.maxLevel;
            const isMaxed = level >= upgrade.maxLevel;
            
            return (
              <div key={upgrade.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 6,
                marginBottom: 4,
                background: level > 0 ? "rgba(218,165,32,0.05)" : "transparent",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#ccc", fontWeight: 600, fontSize: 14 }}>
                    {upgrade.name}
                    {level > 0 && <span style={{ color: "#daa520", marginLeft: 6 }}>Lv.{level}</span>}
                  </div>
                  <div style={{ color: "#666", fontSize: 11 }}>{upgrade.description}</div>
                  {!isMaxed && (
                    <div style={{ color: "#6a9955", fontSize: 10, marginTop: 2 }}>
                      +{upgrade.zpsBonus > 0 ? `${upgrade.zpsBonus}/sec` : `${upgrade.zpcBonus}/tap`}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onBuy(upgrade.id)}
                  disabled={!canAfford}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: isMaxed ? "#4a6" : canAfford ? "#daa520" : "#333",
                    color: isMaxed || canAfford ? "#1a1a1a" : "#555",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: canAfford ? "pointer" : "default",
                    minWidth: 70,
                  }}
                >
                  {isMaxed ? "MAX" : formatNumber(cost)}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Flying coin
function FlyingCoin({ x, y, amount }: { x: number; y: number; amount: number }) {
  return (
    <div style={{
      position: "absolute",
      left: x,
      top: y,
      pointerEvents: "none",
      animation: "coinUp 0.7s ease-out forwards",
      zIndex: 200,
      color: "#daa520",
      fontWeight: 700,
      fontSize: 15,
      textShadow: "0 1px 2px rgba(0,0,0,0.8)",
    }}>+{formatNumber(amount)}</div>
  );
}

export default function MusicianBeggarPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [zc, setZc] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [zps, setZps] = useState(0);
  const [zpc, setZpc] = useState(1);
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [flyingCoins, setFlyingCoins] = useState<Array<{ id: number; x: number; y: number; amount: number }>>([]);
  const [storeOpen, setStoreOpen] = useState(false);
  const [pedestrians, setPedestrians] = useState<Array<{
    id: number;
    startX: number;
    skinColor: string;
    hairColor: string;
    shirtColor: string;
    pantsColor: string;
    speed: number;
    direction: "left" | "right";
    willTip: boolean;
  }>>([]);
  
  const coinIdRef = useRef(0);
  const pedIdRef = useRef(0);
  const supabase = createBrowserClient();
  const router = useRouter();

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

  const loadGame = useCallback(() => {
    try {
      const saved = localStorage.getItem("musician-beggar-v5");
      if (saved) {
        const data = JSON.parse(saved);
        setZc(data.zc || 0);
        setTotalEarned(data.totalEarned || 0);
        setUpgradeLevels(data.upgradeLevels || {});
        recalculateStats(data.upgradeLevels || {});
        if (data.lastSave && data.zps) {
          const offlineSec = Math.min((Date.now() - data.lastSave) / 1000, 28800);
          const offlineEarn = Math.floor(offlineSec * data.zps * 0.5);
          if (offlineEarn > 0) {
            setZc(p => p + offlineEarn);
            setTotalEarned(p => p + offlineEarn);
          }
        }
      }
    } catch (e) { console.error(e); }
  }, [recalculateStats]);

  const saveGame = useCallback(() => {
    try {
      localStorage.setItem("musician-beggar-v5", JSON.stringify({
        zc, totalEarned, upgradeLevels, zps, lastSave: Date.now(),
      }));
    } catch (e) { console.error(e); }
  }, [zc, totalEarned, upgradeLevels, zps]);

  // Spawn pedestrian - ONLY from edges
  const spawnPedestrian = useCallback(() => {
    const direction: "left" | "right" = Math.random() > 0.5 ? "right" : "left";
    const colors = [
      { skin: "#e8c4a0", hair: "#2c1810", shirt: "#3b5998", pants: "#2d3436" },
      { skin: "#d4a574", hair: "#1a1a1a", shirt: "#c0392b", pants: "#1a252f" },
      { skin: "#f5deb3", hair: "#8b4513", shirt: "#27ae60", pants: "#34495e" },
      { skin: "#deb887", hair: "#4a3728", shirt: "#8e44ad", pants: "#2c3e50" },
      { skin: "#c68642", hair: "#1a1a1a", shirt: "#2980b9", pants: "#1a1a2e" },
      { skin: "#ffe4c4", hair: "#d4a574", shirt: "#e74c3c", pants: "#2d3436" },
    ];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const attractLvl = (upgradeLevels["sign"] || 0) + (upgradeLevels["dog"] || 0) + (upgradeLevels["story"] || 0);
    const tipChance = Math.min(0.5, 0.12 + attractLvl * 0.02);
    
    setPedestrians(prev => [...prev.slice(-10), {
      id: pedIdRef.current++,
      startX: direction === "right" ? -60 : SCENE_WIDTH + 60,
      skinColor: c.skin,
      hairColor: c.hair,
      shirtColor: c.shirt,
      pantsColor: c.pants,
      speed: 1.2 + Math.random() * 0.8,
      direction,
      willTip: Math.random() < tipChance,
    }]);
  }, [upgradeLevels]);

  const removePedestrian = useCallback((id: number) => {
    setPedestrians(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleTip = useCallback(() => {
    const amt = Math.floor(zpc * (0.3 + Math.random() * 0.5));
    setZc(p => p + amt);
    setTotalEarned(p => p + amt);
  }, [zpc]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setZc(p => p + zpc);
    setTotalEarned(p => p + zpc);
    setIsPlaying(true);
    
    const cid = coinIdRef.current++;
    setFlyingCoins(prev => [...prev, { id: cid, x, y, amount: zpc }]);
    setTimeout(() => setFlyingCoins(prev => prev.filter(c => c.id !== cid)), 700);
    setTimeout(() => setIsPlaying(false), 120);
  }, [zpc]);

  const buyUpgrade = useCallback((id: string) => {
    const up = UPGRADES.find(u => u.id === id);
    if (!up) return;
    const lvl = upgradeLevels[id] || 0;
    if (lvl >= up.maxLevel) return;
    const cost = getUpgradeCost(up, lvl);
    if (zc < cost) return;
    setZc(p => p - cost);
    setUpgradeLevels(prev => {
      const n = { ...prev, [id]: lvl + 1 };
      recalculateStats(n);
      return n;
    });
  }, [zc, upgradeLevels, recalculateStats]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/login"); return; }
      setUser(session.user);
      const { data } = await supabase.from("users").select("id, username, avatar_url").eq("id", session.user.id).single();
      if (data) setUserData(data);
      loadGame();
      setLoading(false);
    }
    init();
  }, [supabase, router, loadGame]);

  // Passive income
  useEffect(() => {
    if (loading) return;
    const i = setInterval(() => {
      if (zps > 0) {
        setZc(p => p + zps / 10);
        setTotalEarned(p => p + zps / 10);
      }
    }, 100);
    return () => clearInterval(i);
  }, [loading, zps]);

  // Spawn loop
  useEffect(() => {
    if (loading) return;
    setTimeout(spawnPedestrian, 300);
    setTimeout(spawnPedestrian, 1200);
    const i = setInterval(spawnPedestrian, 2200);
    return () => clearInterval(i);
  }, [loading, spawnPedestrian]);

  // Auto-save
  useEffect(() => {
    if (loading) return;
    const i = setInterval(saveGame, 30000);
    return () => { clearInterval(i); saveGame(); };
  }, [loading, saveGame]);

  useEffect(() => {
    window.addEventListener("beforeunload", saveGame);
    return () => window.removeEventListener("beforeunload", saveGame);
  }, [saveGame]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#1a1a1a" }}>
        <div style={{ height: 60, background: "rgba(0,0,0,0.5)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #333", borderTopColor: "#daa520", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      </div>
    );
  }

  const hasSign = (upgradeLevels["sign"] || 0) > 0;
  const hasDog = (upgradeLevels["dog"] || 0) > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#1a1a1a" }}>
      <Header user={user} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px" }}>
        <Link href="/game-hub" style={{ color: "#daa520", textDecoration: "none", fontSize: 13, marginBottom: 12, display: "inline-block" }}>
          ← Game Hub
        </Link>

        {/* ZC Display */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ color: "#daa520", fontSize: 32, fontWeight: 700 }}>{formatNumber(zc)} ZC</div>
          <div style={{ color: "#666", fontSize: 12 }}>{formatNumber(zpc)}/tap • {formatNumber(zps)}/sec</div>
        </div>

        {/* Scene */}
        <div 
          onClick={handleClick}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: SCENE_WIDTH,
            height: 340,
            margin: "0 auto",
            borderRadius: 8,
            overflow: "hidden",
            cursor: "pointer",
            background: "#0f0f15",
          }}
        >
          {/* Sky */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, background: "linear-gradient(180deg, #08080f 0%, #12121a 100%)" }} />
          
          {/* Stars - static */}
          {[[15,12],[60,25],[110,8],[180,30],[250,15],[320,28],[400,10],[480,22],[550,18]].map(([x,y], i) => (
            <div key={i} style={{ position: "absolute", top: y, left: x, width: 1.5, height: 1.5, background: "#fff", borderRadius: "50%", opacity: 0.35 }} />
          ))}
          
          {/* Buildings */}
          <div style={{ position: "absolute", top: 40, left: 0, right: 0, height: 120 }}>
            <div style={{ position: "absolute", bottom: 0, left: 20, width: 55, height: 100, background: "#0a0a12" }} />
            <div style={{ position: "absolute", bottom: 0, left: 85, width: 70, height: 115, background: "#0c0c14" }}>
              {[20,45,70,92].map((t,i) => <div key={i} style={{ position: "absolute", top: t, left: 12, width: 14, height: 12, background: i===1?"#3a3525":"#1a1a22" }} />)}
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 165, width: 50, height: 85, background: "#0a0a12" }} />
            <div style={{ position: "absolute", bottom: 0, right: 130, width: 75, height: 105, background: "#0c0c14" }}>
              {[18,42,68,88].map((t,i) => <div key={i} style={{ position: "absolute", top: t, left: 14, width: 12, height: 12, background: "#1a1a22" }} />)}
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 30, width: 60, height: 80, background: "#0a0a12" }} />
          </div>
          
          {/* Street lamp */}
          <div style={{ position: "absolute", bottom: 140, left: 80, zIndex: 3 }}>
            <div style={{ width: 4, height: 70, background: "#252525" }} />
            <div style={{ position: "absolute", top: -6, left: -8, width: 20, height: 10, background: "#333", borderRadius: "2px 2px 0 0" }} />
            <div style={{ position: "absolute", top: 0, left: -5, width: 14, height: 4, background: "#c9a227", opacity: 0.6, borderRadius: 1 }} />
          </div>
          
          {/* Sidewalk - TOP (musician here) */}
          <div style={{
            position: "absolute",
            bottom: 70,
            left: 0,
            right: 0,
            height: 70,
            background: "#2a2a32",
          }}>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "#3a3a42" }} />
          </div>
          
          {/* Road - BOTTOM (pedestrians walk here, IN FRONT) */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 70,
            background: "#1e1e26",
          }}>
            <div style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 3,
              background: "repeating-linear-gradient(90deg, #c9a227 0px, #c9a227 20px, transparent 20px, transparent 45px)",
              transform: "translateY(-50%)",
              opacity: 0.5,
            }} />
          </div>
          
          {/* Musician - on sidewalk, BEHIND pedestrians */}
          <div style={{ position: "absolute", bottom: 75, left: 200, zIndex: 10 }} onClick={e => e.stopPropagation()}>
            <div onClick={handleClick} style={{ cursor: "pointer" }}>
              <HomelessMusician isPlaying={isPlaying} hasSign={hasSign} hasDog={hasDog} />
            </div>
          </div>
          
          {/* Store - on sidewalk */}
          <Store onClick={() => setStoreOpen(true)} isOpen={storeOpen} />
          
          {/* Pedestrians - on road, IN FRONT of musician */}
          {pedestrians.map(p => (
            <WalkingPerson
              key={p.id}
              id={p.id}
              startX={p.startX}
              skinColor={p.skinColor}
              hairColor={p.hairColor}
              shirtColor={p.shirtColor}
              pantsColor={p.pantsColor}
              speed={p.speed}
              direction={p.direction}
              willTip={p.willTip}
              musicianX={250}
              onExit={removePedestrian}
              onTip={handleTip}
            />
          ))}

          {/* Flying coins */}
          {flyingCoins.map(c => <FlyingCoin key={c.id} x={c.x} y={c.y} amount={c.amount} />)}

          {/* Tap hint */}
          <div style={{ position: "absolute", bottom: 75, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.2)", fontSize: 9, zIndex: 5 }}>
            tap musician
          </div>
        </div>
      </div>

      {/* Store Modal */}
      <StoreModal 
        isOpen={storeOpen} 
        onClose={() => setStoreOpen(false)} 
        zc={zc}
        upgradeLevels={upgradeLevels}
        onBuy={buyUpgrade}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes coinUp { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(-50px); } }
        @keyframes toss { 0% { opacity:1; transform:translate(0,0); } 100% { opacity:0; transform:translate(15px,35px); } }
      `}</style>
    </div>
  );
}

