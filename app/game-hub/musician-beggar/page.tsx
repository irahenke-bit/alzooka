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
  // Skills
  { id: "practice", name: "Practice", description: "Better technique", baseCost: 25, costMultiplier: 1.08, zpsBonus: 0, zpcBonus: 1, maxLevel: 100, category: "skill" },
  { id: "repertoire", name: "Song Repertoire", description: "More songs", baseCost: 200, costMultiplier: 1.1, zpsBonus: 0, zpcBonus: 3, maxLevel: 75, category: "skill" },
  { id: "showmanship", name: "Showmanship", description: "Work the crowd", baseCost: 1000, costMultiplier: 1.1, zpsBonus: 0, zpcBonus: 10, maxLevel: 50, category: "skill" },
  { id: "charisma", name: "Charisma", description: "Natural charm", baseCost: 10000, costMultiplier: 1.12, zpsBonus: 0, zpcBonus: 50, maxLevel: 50, category: "skill" },
  { id: "viral", name: "Go Viral", description: "Internet fame", baseCost: 250000, costMultiplier: 1.15, zpsBonus: 0, zpcBonus: 500, maxLevel: 25, category: "skill" },
  
  // Instruments
  { id: "acoustic", name: "Acoustic Guitar", description: "Trusty six-string", baseCost: 50, costMultiplier: 1.15, zpsBonus: 1, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "harmonica", name: "Harmonica", description: "Blues vibes", baseCost: 300, costMultiplier: 1.15, zpsBonus: 4, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "electric", name: "Electric Guitar", description: "Plug in", baseCost: 2500, costMultiplier: 1.15, zpsBonus: 15, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "keyboard", name: "Keyboard", description: "Ivory keys", baseCost: 15000, costMultiplier: 1.15, zpsBonus: 60, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "drums", name: "Drum Kit", description: "Keep the beat", baseCost: 100000, costMultiplier: 1.15, zpsBonus: 250, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  
  // Gear
  { id: "amp", name: "Amplifier", description: "Get loud", baseCost: 150, costMultiplier: 1.12, zpsBonus: 2, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "mic", name: "Microphone", description: "Sing it out", baseCost: 800, costMultiplier: 1.12, zpsBonus: 6, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "speakers", name: "Speakers", description: "Full sound", baseCost: 5000, costMultiplier: 1.12, zpsBonus: 30, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "lights", name: "String Lights", description: "Ambiance", baseCost: 25000, costMultiplier: 1.12, zpsBonus: 100, zpcBonus: 0, maxLevel: 40, category: "gear" },
  
  // Attraction
  { id: "sign", name: "Cardboard Sign", description: "Anything helps", baseCost: 100, costMultiplier: 1.2, zpsBonus: 3, zpcBonus: 0, maxLevel: 20, category: "attraction" },
  { id: "dog", name: "Loyal Dog", description: "Man's best friend", baseCost: 2000, costMultiplier: 1.2, zpsBonus: 20, zpcBonus: 0, maxLevel: 20, category: "attraction" },
  { id: "story", name: "Sad Story Sign", description: "Tug heartstrings", baseCost: 20000, costMultiplier: 1.2, zpsBonus: 120, zpcBonus: 0, maxLevel: 20, category: "attraction" },
  { id: "talent", name: "Show Talent", description: "Impress passersby", baseCost: 150000, costMultiplier: 1.2, zpsBonus: 600, zpcBonus: 0, maxLevel: 20, category: "attraction" },
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

// Pedestrian styles - more realistic urban people
const PEDESTRIAN_STYLES = [
  { hair: "#1a1a1a", skin: "#d4a574", shirt: "#2c3e50", pants: "#1a252f", speed: 1.2 },
  { hair: "#4a3728", skin: "#e8c4a0", shirt: "#7f8c8d", pants: "#2c3e50", speed: 1.5 },
  { hair: "#1a1a1a", skin: "#8d5524", shirt: "#c0392b", pants: "#1a1a2e", speed: 1.3 },
  { hair: "#8b4513", skin: "#f5deb3", shirt: "#27ae60", pants: "#34495e", speed: 1.6 },
  { hair: "#2c1810", skin: "#deb887", shirt: "#8e44ad", pants: "#2d3436", speed: 1.4 },
  { hair: "#696969", skin: "#d4a574", shirt: "#34495e", pants: "#1a1a1a", speed: 1.0 },
  { hair: "#1a1a1a", skin: "#c68642", shirt: "#2980b9", pants: "#2c3e50", speed: 1.7 },
  { hair: "#d4a574", skin: "#ffe4c4", shirt: "#e74c3c", pants: "#1a252f", speed: 1.4 },
];

// Homeless Musician - gritty, realistic
function HomelessMusician({ isPlaying, hasSign, hasDog }: { isPlaying: boolean; hasSign: boolean; hasDog: boolean }) {
  return (
    <div style={{ position: "relative", width: 100, height: 140 }}>
      {/* Cardboard/blanket on ground */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: -10,
        width: 120,
        height: 15,
        background: "linear-gradient(90deg, #5c4033 0%, #8b7355 50%, #5c4033 100%)",
        borderRadius: 2,
        opacity: 0.8,
      }} />
      
      {/* Coins on ground */}
      <div style={{ position: "absolute", bottom: 8, left: 70 }}>
        <div style={{ width: 6, height: 3, background: "#b8860b", borderRadius: "50%", position: "absolute", top: 0, left: 0 }} />
        <div style={{ width: 5, height: 2, background: "#cd853f", borderRadius: "50%", position: "absolute", top: 4, left: 8 }} />
        <div style={{ width: 6, height: 3, background: "#daa520", borderRadius: "50%", position: "absolute", top: 2, left: 15 }} />
      </div>
      
      {/* Hat for coins */}
      <div style={{
        position: "absolute",
        bottom: 5,
        left: 65,
        width: 30,
        height: 12,
        background: "#2c2c2c",
        borderRadius: "0 0 50% 50%",
        border: "1px solid #1a1a1a",
      }} />
      
      {/* Loyal dog (if owned) */}
      {hasDog && (
        <div style={{ position: "absolute", bottom: 10, left: -25 }}>
          {/* Dog body */}
          <div style={{
            width: 25,
            height: 15,
            background: "#8b4513",
            borderRadius: "8px 12px 8px 8px",
            position: "relative",
          }}>
            {/* Head */}
            <div style={{
              position: "absolute",
              left: -8,
              top: -5,
              width: 14,
              height: 12,
              background: "#8b4513",
              borderRadius: "50% 50% 40% 40%",
            }}>
              {/* Ear */}
              <div style={{ position: "absolute", top: -3, left: 2, width: 5, height: 8, background: "#6b3510", borderRadius: "50% 50% 30% 30%", transform: "rotate(-20deg)" }} />
              {/* Eye */}
              <div style={{ position: "absolute", top: 4, left: 3, width: 3, height: 3, background: "#1a1a1a", borderRadius: "50%" }} />
              {/* Nose */}
              <div style={{ position: "absolute", top: 7, left: 0, width: 4, height: 3, background: "#1a1a1a", borderRadius: "50%" }} />
            </div>
            {/* Tail */}
            <div style={{ position: "absolute", right: -6, top: 0, width: 8, height: 4, background: "#8b4513", borderRadius: "0 50% 50% 0", transform: "rotate(-20deg)" }} />
            {/* Legs */}
            <div style={{ position: "absolute", bottom: -6, left: 3, width: 4, height: 8, background: "#8b4513", borderRadius: 2 }} />
            <div style={{ position: "absolute", bottom: -6, right: 3, width: 4, height: 8, background: "#8b4513", borderRadius: 2 }} />
          </div>
        </div>
      )}
      
      {/* Sign (if owned) */}
      {hasSign && (
        <div style={{
          position: "absolute",
          bottom: 15,
          right: -15,
          width: 35,
          height: 25,
          background: "#a08060",
          border: "1px solid #806040",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotate(5deg)",
        }}>
          <span style={{ fontSize: 6, color: "#2c2c2c", fontWeight: "bold", textAlign: "center", lineHeight: 1.1 }}>
            ANYTHING<br/>HELPS
          </span>
        </div>
      )}
      
      {/* The musician - sitting cross-legged */}
      <svg width="80" height="120" viewBox="0 0 80 120" style={{ position: "absolute", bottom: 10, left: 10 }}>
        {/* Legs - crossed */}
        <ellipse cx="25" cy="105" rx="20" ry="8" fill="#3d3d4d" />
        <ellipse cx="55" cy="105" rx="20" ry="8" fill="#3d3d4d" />
        {/* Worn shoes */}
        <ellipse cx="10" cy="108" rx="8" ry="5" fill="#2a2a2a" />
        <ellipse cx="70" cy="108" rx="8" ry="5" fill="#2a2a2a" />
        
        {/* Body - hunched, worn hoodie */}
        <path 
          d="M25,50 Q15,55 15,70 L15,95 Q15,100 25,100 L55,100 Q65,100 65,95 L65,70 Q65,55 55,50 Q45,45 40,45 Q35,45 25,50"
          fill="#4a4a4a"
        />
        {/* Hoodie texture/wear */}
        <path d="M20,60 Q25,65 20,75" fill="none" stroke="#3a3a3a" strokeWidth="1" />
        <path d="M60,60 Q55,65 60,75" fill="none" stroke="#3a3a3a" strokeWidth="1" />
        {/* Hood */}
        <path d="M30,48 Q40,42 50,48 L50,52 Q40,48 30,52 Z" fill="#3d3d3d" />
        
        {/* Guitar - worn acoustic */}
        <g style={{ transform: isPlaying ? "rotate(-2deg)" : "rotate(0deg)", transformOrigin: "40px 75px", transition: "transform 0.1s" }}>
          {/* Neck */}
          <rect x="55" y="35" width="5" height="40" rx="1" fill="#5c4033" />
          {/* Frets */}
          {[0,1,2,3,4].map(i => (
            <rect key={i} x="55" y={38 + i*8} width="5" height="1" fill="#888" />
          ))}
          {/* Headstock */}
          <rect x="54" y="28" width="7" height="9" rx="1" fill="#3d2817" />
          {/* Tuning pegs */}
          <circle cx="55" cy="31" r="1.5" fill="#666" />
          <circle cx="59" cy="31" r="1.5" fill="#666" />
          
          {/* Body - worn */}
          <ellipse cx="42" cy="80" rx="16" ry="20" fill="#a08060" stroke="#806040" strokeWidth="1.5" />
          {/* Sound hole */}
          <ellipse cx="42" cy="80" rx="5" ry="6" fill="#2c1810" />
          {/* Scratch marks / wear */}
          <path d="M35,72 L38,76" stroke="#8a7050" strokeWidth="0.5" />
          <path d="M46,85 L50,82" stroke="#8a7050" strokeWidth="0.5" />
          {/* Strings */}
          <line x1="42" y1="60" x2="57" y2="38" stroke="#ccc" strokeWidth="0.3" />
          <line x1="44" y1="60" x2="58" y2="38" stroke="#ccc" strokeWidth="0.3" />
        </g>
        
        {/* Arms */}
        <path 
          d={isPlaying ? "M25,55 Q15,65 20,80 Q22,85 28,82" : "M25,55 Q15,65 22,80 Q24,84 28,82"}
          fill="#4a4a4a"
          style={{ transition: "d 0.1s" }}
        />
        <path 
          d={isPlaying ? "M55,55 Q68,65 60,78 Q58,82 52,80" : "M55,55 Q65,65 58,78 Q56,82 52,80"}
          fill="#4a4a4a"
          style={{ transition: "d 0.1s" }}
        />
        {/* Hands */}
        <ellipse cx="28" cy="82" rx="4" ry="5" fill="#c4a67c" />
        <ellipse cx="52" cy="80" rx="4" ry="5" fill="#c4a67c" />
        
        {/* Neck */}
        <rect x="36" y="35" width="8" height="12" rx="2" fill="#c4a67c" />
        
        {/* Head */}
        <ellipse cx="40" cy="25" rx="12" ry="14" fill="#c4a67c" />
        
        {/* Messy hair / beanie */}
        <path 
          d="M28,20 Q28,8 40,8 Q52,8 52,20 Q52,15 48,13 Q40,10 32,13 Q28,15 28,20"
          fill="#2a2a2a"
        />
        {/* Beanie */}
        <path d="M28,18 Q28,10 40,10 Q52,10 52,18" fill="#4a6670" stroke="#3a5660" strokeWidth="1" />
        <rect x="28" y="16" width="24" height="4" fill="#4a6670" />
        
        {/* Face - tired, scruffy */}
        {/* Eyes - tired */}
        <ellipse cx="35" cy="24" rx="2" ry="1.5" fill="#2c2c2c" />
        <ellipse cx="45" cy="24" rx="2" ry="1.5" fill="#2c2c2c" />
        {/* Eye bags */}
        <path d="M33,26 Q35,27 37,26" fill="none" stroke="#a08878" strokeWidth="0.5" />
        <path d="M43,26 Q45,27 47,26" fill="none" stroke="#a08878" strokeWidth="0.5" />
        
        {/* Stubble */}
        <g fill="#8a7a6a" opacity="0.5">
          {[0,1,2,3,4,5].map(i => (
            <circle key={i} cx={35 + (i % 3) * 4} cy={32 + Math.floor(i / 3) * 3} r="0.5" />
          ))}
        </g>
        
        {/* Nose */}
        <path d="M40,26 L40,30 Q40,32 42,32" fill="none" stroke="#a08878" strokeWidth="1" />
        
        {/* Mouth */}
        <path 
          d={isPlaying ? "M36,35 Q40,38 44,35" : "M37,35 Q40,36 43,35"} 
          fill="none" 
          stroke="#8a6a5a" 
          strokeWidth="1"
        />
        
        {/* Ear */}
        <ellipse cx="52" cy="25" rx="2" ry="3" fill="#c4a67c" />
      </svg>
    </div>
  );
}

// Walking Pedestrian with proper walk cycle
function WalkingPedestrian({ 
  id,
  startX, 
  style, 
  direction,
  onExit,
  onTip,
  willTip,
  musicianX,
}: { 
  id: number;
  startX: number;
  style: typeof PEDESTRIAN_STYLES[0];
  direction: "left" | "right";
  onExit: (id: number) => void;
  onTip: () => void;
  willTip: boolean;
  musicianX: number;
}) {
  const [x, setX] = useState(startX);
  const [walkFrame, setWalkFrame] = useState(0);
  const [hasTipped, setHasTipped] = useState(false);
  const [showCoin, setShowCoin] = useState(false);
  
  // Walk animation frame
  useEffect(() => {
    const frameInterval = setInterval(() => {
      setWalkFrame(f => (f + 1) % 4);
    }, 150);
    return () => clearInterval(frameInterval);
  }, []);
  
  // Movement
  useEffect(() => {
    const moveInterval = setInterval(() => {
      setX(prev => {
        const next = direction === "right" ? prev + style.speed : prev - style.speed;
        
        // Check if passing musician and should tip
        if (willTip && !hasTipped) {
          const distToMusician = Math.abs(next - musicianX);
          if (distToMusician < 30) {
            setHasTipped(true);
            setShowCoin(true);
            onTip();
            setTimeout(() => setShowCoin(false), 600);
          }
        }
        
        // Check if exited screen
        if ((direction === "right" && next > 520) || (direction === "left" && next < -40)) {
          onExit(id);
        }
        
        return next;
      });
    }, 30);
    return () => clearInterval(moveInterval);
  }, [direction, style.speed, willTip, hasTipped, musicianX, onTip, onExit, id]);
  
  // Walk cycle leg positions
  const legOffset = walkFrame === 0 ? 0 : walkFrame === 1 ? 4 : walkFrame === 2 ? 0 : -4;
  const armOffset = walkFrame === 0 ? 0 : walkFrame === 1 ? -3 : walkFrame === 2 ? 0 : 3;
  
  return (
    <div style={{
      position: "absolute",
      left: x,
      bottom: 25,
      transform: direction === "left" ? "scaleX(-1)" : "scaleX(1)",
    }}>
      <svg width="24" height="55" viewBox="0 0 24 55">
        {/* Shadow */}
        <ellipse cx="12" cy="53" rx="8" ry="2" fill="rgba(0,0,0,0.2)" />
        
        {/* Back leg */}
        <path 
          d={`M10,30 L${10 - legOffset},42 L${10 - legOffset},50 L${12 - legOffset},50 L${12 - legOffset},42 L12,30`}
          fill={style.pants}
        />
        {/* Back shoe */}
        <ellipse cx={11 - legOffset} cy="51" rx="3" ry="1.5" fill="#1a1a1a" />
        
        {/* Front leg */}
        <path 
          d={`M14,30 L${14 + legOffset},42 L${14 + legOffset},50 L${16 + legOffset},50 L${16 + legOffset},42 L16,30`}
          fill={style.pants}
        />
        {/* Front shoe */}
        <ellipse cx={15 + legOffset} cy="51" rx="3" ry="1.5" fill="#1a1a1a" />
        
        {/* Body */}
        <path 
          d="M8,15 Q6,17 6,22 L6,32 Q6,34 10,34 L18,34 Q22,34 22,32 L22,22 Q22,17 20,15 Q16,13 14,13 Q12,13 8,15"
          fill={style.shirt}
        />
        
        {/* Back arm */}
        <path 
          d={`M8,17 Q${5 + armOffset},22 ${6 + armOffset},30`}
          fill="none"
          stroke={style.shirt}
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Front arm */}
        <path 
          d={`M20,17 Q${23 - armOffset},22 ${22 - armOffset},30`}
          fill="none"
          stroke={style.shirt}
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Hands */}
        <circle cx={6 + armOffset} cy="30" r="2" fill={style.skin} />
        <circle cx={22 - armOffset} cy="30" r="2" fill={style.skin} />
        
        {/* Neck */}
        <rect x="11" y="10" width="4" height="4" fill={style.skin} />
        
        {/* Head */}
        <ellipse cx="13" cy="7" rx="6" ry="7" fill={style.skin} />
        
        {/* Hair */}
        <path 
          d="M7,5 Q7,0 13,0 Q19,0 19,5 Q19,3 16,2 Q13,1 10,2 Q7,3 7,5"
          fill={style.hair}
        />
        
        {/* Face */}
        <circle cx="10" cy="6" r="1" fill="#2a2a2a" />
        <circle cx="16" cy="6" r="1" fill="#2a2a2a" />
        <path d="M11,10 Q13,11 15,10" fill="none" stroke="#a08878" strokeWidth="0.5" />
      </svg>
      
      {/* Coin toss animation */}
      {showCoin && (
        <div style={{
          position: "absolute",
          top: 15,
          left: direction === "right" ? 20 : -10,
          fontSize: 12,
          animation: "tossCoin 0.6s ease-out forwards",
        }}>
          🪙
        </div>
      )}
    </div>
  );
}

// Flying coin from click
function FlyingCoin({ x, y, amount }: { x: number; y: number; amount: number }) {
  return (
    <div style={{
      position: "absolute",
      left: x,
      top: y,
      pointerEvents: "none",
      animation: "coinFly 0.8s ease-out forwards",
      zIndex: 100,
      color: "#daa520",
      fontWeight: 700,
      fontSize: 16,
      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
    }}>
      +{formatNumber(amount)}
    </div>
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
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"skill" | "instrument" | "gear" | "attraction">("skill");
  const [pedestrians, setPedestrians] = useState<Array<{
    id: number;
    startX: number;
    style: typeof PEDESTRIAN_STYLES[0];
    direction: "left" | "right";
    willTip: boolean;
  }>>([]);
  
  const coinIdRef = useRef(0);
  const pedestrianIdRef = useRef(0);
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
      const saved = localStorage.getItem("musician-beggar-v4");
      if (saved) {
        const data = JSON.parse(saved);
        setZc(data.zc || 0);
        setTotalEarned(data.totalEarned || 0);
        setUpgradeLevels(data.upgradeLevels || {});
        recalculateStats(data.upgradeLevels || {});
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

  const saveGame = useCallback(() => {
    try {
      localStorage.setItem("musician-beggar-v4", JSON.stringify({
        zc, totalEarned, upgradeLevels, zps, lastSave: Date.now(),
      }));
    } catch (e) {
      console.error("Failed to save:", e);
    }
  }, [zc, totalEarned, upgradeLevels, zps]);

  // Spawn pedestrian from edges
  const spawnPedestrian = useCallback(() => {
    const direction: "left" | "right" = Math.random() > 0.5 ? "right" : "left";
    const attractionLevel = (upgradeLevels["sign"] || 0) + (upgradeLevels["dog"] || 0) + (upgradeLevels["story"] || 0) + (upgradeLevels["talent"] || 0);
    const tipChance = Math.min(0.5, 0.15 + attractionLevel * 0.025);
    
    const newPed = {
      id: pedestrianIdRef.current++,
      startX: direction === "right" ? -40 : 500,
      style: PEDESTRIAN_STYLES[Math.floor(Math.random() * PEDESTRIAN_STYLES.length)],
      direction,
      willTip: Math.random() < tipChance,
    };
    
    setPedestrians(prev => [...prev.slice(-12), newPed]);
  }, [upgradeLevels]);

  const removePedestrian = useCallback((id: number) => {
    setPedestrians(prev => prev.filter(p => p.id !== id));
  }, []);

  const handlePedestrianTip = useCallback(() => {
    const tipAmount = Math.floor(zpc * (0.3 + Math.random() * 0.7));
    setZc(prev => prev + tipAmount);
    setTotalEarned(prev => prev + tipAmount);
  }, [zpc]);

  const handleMusicianClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setZc(prev => prev + zpc);
    setTotalEarned(prev => prev + zpc);
    setIsPlaying(true);
    
    const coinId = coinIdRef.current++;
    setFlyingCoins(prev => [...prev, { id: coinId, x, y, amount: zpc }]);
    setTimeout(() => setFlyingCoins(prev => prev.filter(c => c.id !== coinId)), 800);
    setTimeout(() => setIsPlaying(false), 150);
  }, [zpc]);

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
      if (!currentUser) { router.push("/login"); return; }
      setUser(currentUser);
      const { data: userInfo } = await supabase.from("users").select("id, username, avatar_url").eq("id", currentUser.id).single();
      if (userInfo) setUserData(userInfo);
      loadGame();
      setLoading(false);
    }
    init();
  }, [supabase, router, loadGame]);

  // Passive income loop
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      if (zps > 0) {
        const earned = zps / 10;
        setZc(prev => prev + earned);
        setTotalEarned(prev => prev + earned);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [loading, zps]);

  // Pedestrian spawn loop
  useEffect(() => {
    if (loading) return;
    // Initial pedestrians
    setTimeout(() => spawnPedestrian(), 500);
    setTimeout(() => spawnPedestrian(), 1500);
    
    const interval = setInterval(spawnPedestrian, 2500 + Math.random() * 1500);
    return () => clearInterval(interval);
  }, [loading, spawnPedestrian]);

  // Auto-save
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(saveGame, 30000);
    return () => { clearInterval(interval); saveGame(); };
  }, [loading, saveGame]);

  useEffect(() => {
    window.addEventListener("beforeunload", saveGame);
    return () => window.removeEventListener("beforeunload", saveGame);
  }, [saveGame]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#1a1a1a" }}>
        <div style={{ height: 60, background: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(255,255,255,0.1)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ width: 48, height: 48, border: "3px solid rgba(218, 165, 32, 0.2)", borderTopColor: "#daa520", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      </div>
    );
  }

  const hasSign = (upgradeLevels["sign"] || 0) > 0;
  const hasDog = (upgradeLevels["dog"] || 0) > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#1a1a1a" }}>
      <Header user={user} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px" }}>
        <Link href="/game-hub" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#daa520", textDecoration: "none", fontSize: 14, marginBottom: 16 }}>
          ← Back to Game Hub
        </Link>

        {/* ZC Display */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ color: "#daa520", fontSize: 36, fontWeight: 700 }}>
            {formatNumber(zc)} ZC
          </div>
          <div style={{ color: "#666", fontSize: 13 }}>
            {formatNumber(zpc)}/tap • {formatNumber(zps)}/sec
          </div>
        </div>

        {/* Street Scene */}
        <div 
          onClick={handleMusicianClick}
          style={{
            position: "relative",
            height: 320,
            borderRadius: 8,
            overflow: "hidden",
            cursor: "pointer",
            border: "1px solid #333",
            marginBottom: 16,
            background: "#1a1a1a",
          }}
        >
          {/* Night sky - static */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 140,
            background: "linear-gradient(180deg, #0a0a12 0%, #151520 60%, #1a1a25 100%)",
          }} />
          
          {/* Static stars */}
          {[
            { x: 10, y: 15, s: 1 }, { x: 45, y: 25, s: 1.5 }, { x: 80, y: 10, s: 1 },
            { x: 120, y: 35, s: 1 }, { x: 180, y: 18, s: 1.5 }, { x: 220, y: 40, s: 1 },
            { x: 280, y: 12, s: 1 }, { x: 320, y: 30, s: 1.5 }, { x: 380, y: 20, s: 1 },
            { x: 420, y: 38, s: 1 }, { x: 460, y: 15, s: 1.5 },
          ].map((star, i) => (
            <div key={i} style={{
              position: "absolute",
              top: star.y,
              left: star.x,
              width: star.s,
              height: star.s,
              background: "#fff",
              borderRadius: "50%",
              opacity: 0.4,
            }} />
          ))}
          
          {/* Buildings - static, dark silhouettes */}
          <div style={{ position: "absolute", bottom: 100, left: 0, right: 0, height: 160 }}>
            <div style={{ position: "absolute", bottom: 0, left: 10, width: 50, height: 120, background: "#12121a" }} />
            <div style={{ position: "absolute", bottom: 0, left: 70, width: 70, height: 150, background: "#0f0f15" }}>
              {[25, 55, 85, 115].map((t, i) => (
                <div key={i} style={{ position: "absolute", top: t, left: 12, width: 12, height: 16, background: "#2a2a35" }} />
              ))}
              {[25, 55, 85, 115].map((t, i) => (
                <div key={i} style={{ position: "absolute", top: t, right: 12, width: 12, height: 16, background: i === 1 ? "#4a4535" : "#2a2a35" }} />
              ))}
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 150, width: 60, height: 100, background: "#12121a" }}>
              {[20, 50, 75].map((t, i) => (
                <div key={i} style={{ position: "absolute", top: t, left: 10, width: 15, height: 14, background: i === 2 ? "#4a4535" : "#2a2a35" }} />
              ))}
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 80, width: 80, height: 130, background: "#0f0f15" }}>
              {[20, 50, 80, 105].map((t, i) => (
                <div key={i} style={{ position: "absolute", top: t, left: 15, width: 14, height: 15, background: "#2a2a35" }} />
              ))}
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 10, width: 55, height: 90, background: "#12121a" }} />
          </div>
          
          {/* Street lamp - static glow */}
          <div style={{ position: "absolute", bottom: 100, left: 60 }}>
            <div style={{ width: 4, height: 90, background: "#2a2a2a" }} />
            <div style={{ position: "absolute", top: -8, left: -10, width: 24, height: 12, background: "#3a3a3a", borderRadius: "2px 2px 0 0" }} />
            <div style={{ position: "absolute", top: 0, left: -6, width: 16, height: 5, background: "#c9a227", opacity: 0.7, borderRadius: 1 }} />
            {/* Light cone */}
            <div style={{
              position: "absolute",
              top: 5,
              left: -20,
              width: 44,
              height: 80,
              background: "linear-gradient(180deg, rgba(201, 162, 39, 0.15) 0%, transparent 100%)",
              clipPath: "polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)",
            }} />
          </div>
          
          {/* Street lamp 2 */}
          <div style={{ position: "absolute", bottom: 100, right: 100 }}>
            <div style={{ width: 4, height: 80, background: "#2a2a2a" }} />
            <div style={{ position: "absolute", top: -8, left: -10, width: 24, height: 12, background: "#3a3a3a", borderRadius: "2px 2px 0 0" }} />
            <div style={{ position: "absolute", top: 0, left: -6, width: 16, height: 5, background: "#c9a227", opacity: 0.7, borderRadius: 1 }} />
            <div style={{
              position: "absolute",
              top: 5,
              left: -18,
              width: 40,
              height: 70,
              background: "linear-gradient(180deg, rgba(201, 162, 39, 0.12) 0%, transparent 100%)",
              clipPath: "polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)",
            }} />
          </div>
          
          {/* Road */}
          <div style={{
            position: "absolute",
            bottom: 50,
            left: 0,
            right: 0,
            height: 50,
            background: "#252530",
          }}>
            {/* Center line */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 3,
              background: "repeating-linear-gradient(90deg, #c9a227 0px, #c9a227 25px, transparent 25px, transparent 50px)",
              transform: "translateY(-50%)",
              opacity: 0.6,
            }} />
          </div>
          
          {/* Sidewalk */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 50,
            background: "#3a3a40",
          }}>
            {/* Curb */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "#4a4a50" }} />
            {/* Sidewalk lines */}
            <div style={{
              position: "absolute",
              top: 4,
              left: 0,
              right: 0,
              bottom: 0,
              background: "repeating-linear-gradient(90deg, transparent 0px, transparent 48px, #333338 48px, #333338 50px)",
            }} />
          </div>
          
          {/* Pedestrians */}
          {pedestrians.map(ped => (
            <WalkingPedestrian
              key={ped.id}
              id={ped.id}
              startX={ped.startX}
              style={ped.style}
              direction={ped.direction}
              onExit={removePedestrian}
              onTip={handlePedestrianTip}
              willTip={ped.willTip}
              musicianX={230}
            />
          ))}
          
          {/* Homeless Musician */}
          <div style={{ position: "absolute", bottom: 45, left: "50%", transform: "translateX(-50%)" }}>
            <HomelessMusician isPlaying={isPlaying} hasSign={hasSign} hasDog={hasDog} />
          </div>

          {/* Flying coins */}
          {flyingCoins.map(coin => (
            <FlyingCoin key={coin.id} x={coin.x} y={coin.y} amount={coin.amount} />
          ))}

          {/* Tap hint */}
          <div style={{
            position: "absolute",
            bottom: 55,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.25)",
            fontSize: 10,
          }}>
            tap to play
          </div>
        </div>

        {/* Upgrades Toggle */}
        <button
          onClick={() => setShowUpgrades(!showUpgrades)}
          style={{
            width: "100%",
            padding: "14px",
            background: showUpgrades ? "#daa520" : "rgba(218, 165, 32, 0.15)",
            border: "1px solid #daa520",
            borderRadius: 8,
            color: showUpgrades ? "#1a1a1a" : "#daa520",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          {showUpgrades ? "▼ Hide Upgrades" : "▲ Upgrades"}
        </button>

        {/* Upgrades Panel */}
        {showUpgrades && (
          <div style={{
            background: "rgba(0,0,0,0.5)",
            borderRadius: 8,
            border: "1px solid #333",
            overflow: "hidden",
          }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #333" }}>
              {(["skill", "instrument", "gear", "attraction"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  style={{
                    flex: 1,
                    padding: "10px 6px",
                    background: selectedTab === tab ? "rgba(218, 165, 32, 0.15)" : "transparent",
                    border: "none",
                    borderBottom: selectedTab === tab ? "2px solid #daa520" : "2px solid transparent",
                    color: selectedTab === tab ? "#daa520" : "#666",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ maxHeight: 280, overflowY: "auto", padding: 6 }}>
              {UPGRADES.filter(u => u.category === selectedTab).map(upgrade => {
                const level = upgradeLevels[upgrade.id] || 0;
                const cost = getUpgradeCost(upgrade, level);
                const canAfford = zc >= cost && level < upgrade.maxLevel;
                const isMaxed = level >= upgrade.maxLevel;

                return (
                  <div key={upgrade.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 10,
                    borderRadius: 6,
                    marginBottom: 4,
                    background: level > 0 ? "rgba(218, 165, 32, 0.05)" : "transparent",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#ccc", fontWeight: 600, fontSize: 13 }}>
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
                      onClick={(e) => { e.stopPropagation(); buyUpgrade(upgrade.id); }}
                      disabled={!canAfford}
                      style={{
                        padding: "8px 12px",
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
                      {isMaxed ? "MAX" : `${formatNumber(cost)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes coinFly {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-60px); }
        }
        @keyframes tossCoin {
          0% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          100% { opacity: 0; transform: translate(20px, 40px) rotate(180deg); }
        }
      `}</style>
    </div>
  );
}
