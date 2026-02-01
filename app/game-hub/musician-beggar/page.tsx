"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";

// Dev-only game - redirect in production
const isDev = process.env.NODE_ENV === "development";

type UserData = { id: string; username: string; avatar_url: string | null };

type UpgradeType = {
  id: string; name: string; description: string; baseCost: number;
  costMultiplier: number; zpsBonus: number; zpcBonus: number; maxLevel: number;
  category: "skill" | "instrument" | "gear" | "attraction";
};

const UPGRADES: UpgradeType[] = [
  { id: "practice", name: "Practice", description: "Better technique", baseCost: 25, costMultiplier: 1.08, zpsBonus: 0, zpcBonus: 1, maxLevel: 100, category: "skill" },
  { id: "repertoire", name: "Repertoire", description: "More songs", baseCost: 200, costMultiplier: 1.1, zpsBonus: 0, zpcBonus: 3, maxLevel: 75, category: "skill" },
  { id: "showmanship", name: "Showmanship", description: "Work the crowd", baseCost: 1000, costMultiplier: 1.1, zpsBonus: 0, zpcBonus: 10, maxLevel: 50, category: "skill" },
  { id: "charisma", name: "Charisma", description: "Natural charm", baseCost: 10000, costMultiplier: 1.12, zpsBonus: 0, zpcBonus: 50, maxLevel: 50, category: "skill" },
  { id: "acoustic", name: "Acoustic Guitar", description: "Trusty six-string", baseCost: 50, costMultiplier: 1.15, zpsBonus: 1, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "harmonica", name: "Harmonica", description: "Blues vibes", baseCost: 300, costMultiplier: 1.15, zpsBonus: 4, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "electric", name: "Electric Guitar", description: "Plug in", baseCost: 2500, costMultiplier: 1.15, zpsBonus: 15, zpcBonus: 0, maxLevel: 30, category: "instrument" },
  { id: "amp", name: "Amplifier", description: "Get loud", baseCost: 150, costMultiplier: 1.12, zpsBonus: 2, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "mic", name: "Microphone", description: "Sing out", baseCost: 800, costMultiplier: 1.12, zpsBonus: 6, zpcBonus: 0, maxLevel: 40, category: "gear" },
  { id: "sign", name: "Cardboard Sign", description: "Anything helps", baseCost: 100, costMultiplier: 1.2, zpsBonus: 3, zpcBonus: 0, maxLevel: 20, category: "attraction" },
  { id: "dog", name: "Loyal Dog", description: "Best friend", baseCost: 2000, costMultiplier: 1.2, zpsBonus: 20, zpcBonus: 0, maxLevel: 20, category: "attraction" },
];

const LOTTERY_TICKETS = [
  { price: 1000, maxWin: 5000, winChance: 0.08 },
  { price: 2500, maxWin: 15000, winChance: 0.07 },
  { price: 4000, maxWin: 30000, winChance: 0.06 },
  { price: 5500, maxWin: 50000, winChance: 0.05 },
  { price: 7000, maxWin: 80000, winChance: 0.04 },
  { price: 8500, maxWin: 120000, winChance: 0.035 },
  { price: 10000, maxWin: 200000, winChance: 0.03 },
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

// Roblox-style blocky pedestrian
function RobloxPerson({ 
  id, startX, shirtColor, pantsColor, skinColor, speed, direction, willTip, musicianX, onExit, onTip,
}: { 
  id: number; startX: number; shirtColor: string; pantsColor: string; skinColor: string;
  speed: number; direction: "left" | "right"; willTip: boolean; musicianX: number;
  onExit: (id: number) => void; onTip: () => void;
}) {
  const [x, setX] = useState(startX);
  const [frame, setFrame] = useState(0);
  const [hasTipped, setHasTipped] = useState(false);
  const [showCoin, setShowCoin] = useState(false);
  const exitedRef = useRef(false);
  
  useEffect(() => {
    const interval = setInterval(() => setFrame(f => (f + 1) % 8), 100);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setX(prev => {
        const next = direction === "right" ? prev + speed : prev - speed;
        if (willTip && !hasTipped && Math.abs(next - musicianX) < 80) {
          setHasTipped(true); setShowCoin(true); onTip();
          setTimeout(() => setShowCoin(false), 600);
        }
        if (!exitedRef.current && ((direction === "right" && next > 1400) || (direction === "left" && next < -100))) {
          exitedRef.current = true; onExit(id);
        }
        return next;
      });
    }, 20);
    return () => clearInterval(interval);
  }, [direction, speed, willTip, hasTipped, musicianX, onTip, onExit, id]);
  
  const walkCycle = Math.sin((frame / 8) * Math.PI * 2);
  const legSwing = walkCycle * 20;
  const armSwing = walkCycle * 25;
  
  return (
    <div style={{
      position: "absolute", left: x, bottom: 20, zIndex: 50,
      transform: direction === "left" ? "scaleX(-1)" : "scaleX(1)",
    }}>
      <svg width="55" height="110" viewBox="0 0 55 110" style={{ overflow: "visible" }}>
        {/* Shadow */}
        <ellipse cx="27" cy="108" rx="18" ry="4" fill="rgba(0,0,0,0.3)" />
        
        {/* Left Leg - blocky */}
        <g transform={`rotate(${legSwing}, 20, 65)`}>
          <rect x="12" y="65" width="12" height="35" rx="2" fill={pantsColor} />
          <rect x="10" y="95" width="14" height="10" rx="2" fill="#1a1a1a" /> {/* Shoe */}
        </g>
        
        {/* Right Leg - blocky */}
        <g transform={`rotate(${-legSwing}, 35, 65)`}>
          <rect x="31" y="65" width="12" height="35" rx="2" fill={pantsColor} />
          <rect x="29" y="95" width="14" height="10" rx="2" fill="#1a1a1a" /> {/* Shoe */}
        </g>
        
        {/* Body - blocky torso */}
        <rect x="10" y="30" width="35" height="38" rx="3" fill={shirtColor} />
        {/* Shirt detail */}
        <rect x="22" y="32" width="11" height="3" rx="1" fill="rgba(255,255,255,0.15)" />
        <rect x="15" y="50" width="8" height="8" rx="1" fill="rgba(0,0,0,0.1)" /> {/* Pocket */}
        
        {/* Left Arm - blocky */}
        <g transform={`rotate(${-armSwing}, 10, 35)`}>
          <rect x="0" y="32" width="10" height="28" rx="2" fill={shirtColor} />
          <rect x="1" y="56" width="8" height="10" rx="2" fill={skinColor} /> {/* Hand */}
        </g>
        
        {/* Right Arm - blocky */}
        <g transform={`rotate(${armSwing}, 45, 35)`}>
          <rect x="45" y="32" width="10" height="28" rx="2" fill={shirtColor} />
          <rect x="46" y="56" width="8" height="10" rx="2" fill={skinColor} /> {/* Hand */}
        </g>
        
        {/* Neck */}
        <rect x="22" y="22" width="11" height="10" rx="1" fill={skinColor} />
        
        {/* Head - blocky square */}
        <rect x="12" y="0" width="31" height="25" rx="3" fill={skinColor} />
        
        {/* Hair - blocky */}
        <rect x="12" y="0" width="31" height="10" rx="2" fill="#2a2a2a" />
        
        {/* Face */}
        <rect x="18" y="12" width="5" height="5" rx="1" fill="#1a1a1a" /> {/* Left eye */}
        <rect x="32" y="12" width="5" height="5" rx="1" fill="#1a1a1a" /> {/* Right eye */}
        <rect x="25" y="18" width="5" height="3" rx="1" fill="#c4a07c" /> {/* Nose */}
        <rect x="22" y="22" width="11" height="2" rx="1" fill="#8a6a5a" /> {/* Mouth */}
      </svg>
      
      {showCoin && (
        <div style={{ position: "absolute", top: 20, left: 50, animation: "toss 0.6s ease-out forwards", fontSize: 20 }}>🪙</div>
      )}
    </div>
  );
}

// Homeless Musician holding guitar properly
function HomelessMusician({ isPlaying, hasSign, hasDog }: { isPlaying: boolean; hasSign: boolean; hasDog: boolean }) {
  return (
    <div style={{ position: "relative", width: 200, height: 200, zIndex: 10 }}>
      {/* Blanket/cardboard */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: 200, height: 20, background: "linear-gradient(90deg, #5a4a3a 0%, #7a6a5a 50%, #5a4a3a 100%)", borderRadius: 4 }} />
      
      {/* Hat for coins */}
      <div style={{ position: "absolute", bottom: 12, right: 15, width: 45, height: 16, background: "#1a1a1a", borderRadius: "0 0 50% 50%" }}>
        <div style={{ position: "absolute", top: 4, left: 10, width: 8, height: 5, background: "#b8860b", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: 6, left: 26, width: 6, height: 4, background: "#daa520", borderRadius: "50%" }} />
      </div>
      
      {/* Dog */}
      {hasDog && (
        <div style={{ position: "absolute", bottom: 15, left: -50 }}>
          <svg width="60" height="50" viewBox="0 0 30 25">
            <ellipse cx="18" cy="15" rx="10" ry="7" fill="#8b5a2b" />
            <ellipse cx="6" cy="10" rx="6" ry="5" fill="#8b5a2b" />
            <ellipse cx="3" cy="8" rx="2" ry="3" fill="#6b4423" />
            <circle cx="4" cy="9" r="1.5" fill="#222" />
            <ellipse cx="1" cy="12" rx="2" ry="1.5" fill="#222" />
            <rect x="10" y="20" width="3" height="5" rx="1" fill="#8b5a2b" />
            <rect x="20" y="20" width="3" height="5" rx="1" fill="#8b5a2b" />
          </svg>
        </div>
      )}
      
      {/* Sign */}
      {hasSign && (
        <div style={{ position: "absolute", bottom: 25, right: -40, width: 60, height: 45, background: "#a08060", border: "2px solid #705030", display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(5deg)" }}>
          <span style={{ fontSize: 9, color: "#222", fontWeight: "bold", textAlign: "center", lineHeight: 1.1 }}>ANYTHING<br/>HELPS</span>
        </div>
      )}
      
      {/* Musician SVG */}
      <svg width="180" height="180" viewBox="0 0 140 140" style={{ position: "absolute", bottom: 8, left: 5 }}>
        
        {/* === LEGS === */}
        <ellipse cx="50" cy="128" rx="25" ry="9" fill="#3d3d4d" />
        <ellipse cx="90" cy="128" rx="25" ry="9" fill="#3d3d4d" />
        <ellipse cx="28" cy="130" rx="9" ry="5" fill="#1a1a1a" />
        <ellipse cx="112" cy="130" rx="9" ry="5" fill="#1a1a1a" />
        
        {/* === TORSO === */}
        <path d="M45,55 Q30,62 30,78 L30,118 Q30,125 45,125 L95,125 Q110,125 110,118 L110,78 Q110,62 95,55 Q78,46 70,46 Q62,46 45,55" fill="#4a4a4a" />
        <path d="M52,100 L88,100 L85,115 L55,115 Z" fill="#3a3a3a" />
        
        {/* === GUITAR - HORIZONTAL across body === */}
        <g style={{ transform: isPlaying ? "translateY(-1px)" : "", transition: "transform 0.1s" }}>
          
          {/* NECK - horizontal, going LEFT, slight upward tilt */}
          {/* Neck back */}
          <polygon points="5,62 48,72 48,82 5,72" fill="#5c3d2e" />
          {/* Fretboard */}
          <polygon points="8,64 48,73 48,81 8,71" fill="#1a0f08" />
          {/* Frets */}
          <line x1="15" y1="65" x2="15" y2="71" stroke="#c0c0c0" strokeWidth="1" />
          <line x1="22" y1="66" x2="22" y2="72" stroke="#c0c0c0" strokeWidth="1" />
          <line x1="29" y1="67" x2="29" y2="74" stroke="#c0c0c0" strokeWidth="1" />
          <line x1="36" y1="69" x2="36" y2="76" stroke="#c0c0c0" strokeWidth="1" />
          <line x1="43" y1="71" x2="43" y2="78" stroke="#c0c0c0" strokeWidth="1" />
          {/* Fret markers */}
          <circle cx="18" cy="68" r="1.5" fill="#f0ead6" />
          <circle cx="32" cy="71" r="1.5" fill="#f0ead6" />
          
          {/* HEADSTOCK - at far left */}
          <polygon points="-8,58 8,62 8,74 -8,70" fill="#5c3d2e" />
          {/* Nut */}
          <line x1="6" y1="63" x2="6" y2="73" stroke="#f0ead6" strokeWidth="2" />
          {/* Tuning pegs - top */}
          <circle cx="-4" cy="60" r="3" fill="#c0c0c0" />
          <circle cx="-4" cy="65" r="3" fill="#c0c0c0" />
          <circle cx="-4" cy="70" r="3" fill="#c0c0c0" />
          {/* Tuning pegs - bottom */}
          <circle cx="2" cy="61" r="3" fill="#c0c0c0" />
          <circle cx="2" cy="66" r="3" fill="#c0c0c0" />
          <circle cx="2" cy="71" r="3" fill="#c0c0c0" />
          
          {/* GUITAR BODY - on lap */}
          {/* Lower bout */}
          <ellipse cx="80" cy="100" rx="35" ry="24" fill="#c4956a" />
          <ellipse cx="80" cy="100" rx="35" ry="24" fill="none" stroke="#8b5a2b" strokeWidth="2" />
          {/* Upper bout */}
          <ellipse cx="58" cy="82" rx="20" ry="14" fill="#c4956a" />
          <ellipse cx="58" cy="82" rx="20" ry="14" fill="none" stroke="#8b5a2b" strokeWidth="1.5" />
          {/* Waist */}
          <path d="M48,76 Q45,88 48,100 L80,108 Q95,100 95,88 L80,76 Q65,72 48,76" fill="#c4956a" />
          
          {/* Sound hole */}
          <circle cx="72" cy="92" r="12" fill="#2a1a10" />
          <circle cx="72" cy="92" r="14" fill="none" stroke="#5c3d2e" strokeWidth="2" />
          <circle cx="72" cy="92" r="16" fill="none" stroke="#8b5a2b" strokeWidth="1" />
          
          {/* Bridge */}
          <rect x="62" y="108" width="28" height="5" rx="1" fill="#3d2817" />
          <rect x="64" y="107" width="24" height="2" rx="0.5" fill="#f0ead6" />
          
          {/* Pickguard */}
          <ellipse cx="58" cy="95" rx="12" ry="16" fill="#2a1a10" opacity="0.4" />
          
          {/* Strings - from bridge to nut */}
          <line x1="66" y1="107" x2="6" y2="64" stroke="#e0e0e0" strokeWidth="0.5" />
          <line x1="70" y1="107" x2="6" y2="66" stroke="#e0e0e0" strokeWidth="0.5" />
          <line x1="74" y1="107" x2="6" y2="68" stroke="#d0d0d0" strokeWidth="0.6" />
          <line x1="78" y1="107" x2="6" y2="70" stroke="#d0d0d0" strokeWidth="0.6" />
          <line x1="82" y1="107" x2="6" y2="72" stroke="#cd853f" strokeWidth="0.7" />
          <line x1="86" y1="107" x2="6" y2="74" stroke="#cd853f" strokeWidth="0.7" />
        </g>
        
        {/* === LEFT ARM - fretting hand on neck === */}
        <path d="M42,62 Q30,60 22,65" fill="none" stroke="#4a4a4a" strokeWidth="12" strokeLinecap="round" />
        {/* Left hand wrapped around neck */}
        <ellipse cx="20" cy="68" rx="9" ry="7" fill="#c4a67c" />
        {/* Fingers curling over fretboard */}
        <ellipse cx="16" cy="62" rx="3" ry="4" fill="#c4a67c" />
        <ellipse cx="20" cy="61" rx="3" ry="4" fill="#c4a67c" />
        <ellipse cx="24" cy="62" rx="3" ry="4" fill="#c4a67c" />
        <ellipse cx="27" cy="64" rx="2.5" ry="3.5" fill="#c4a67c" />
        {/* Thumb behind neck */}
        <ellipse cx="18" cy="76" rx="3" ry="4" fill="#c4a67c" />
        
        {/* === RIGHT ARM - strumming hand over sound hole === */}
        <path d="M98,62 Q110,75 100,90" fill="none" stroke="#4a4a4a" strokeWidth="12" strokeLinecap="round" />
        {/* Right hand over strings */}
        <ellipse cx="98" cy="93" rx="9" ry="7" fill="#c4a67c" />
        {/* Strumming fingers */}
        <ellipse cx="92" cy="98" rx="2.5" ry="4" fill="#c4a67c" />
        <ellipse cx="96" cy="100" rx="2.5" ry="4" fill="#c4a67c" />
        <ellipse cx="100" cy="100" rx="2.5" ry="4" fill="#c4a67c" />
        <ellipse cx="104" cy="98" rx="2.5" ry="4" fill="#c4a67c" />
        
        {/* === HEAD === */}
        <rect x="64" y="38" width="12" height="14" rx="3" fill="#c4a67c" />
        <ellipse cx="70" cy="26" rx="16" ry="18" fill="#c4a67c" />
        
        {/* Beanie */}
        <path d="M54,22 Q54,6 70,6 Q86,6 86,22" fill="#4a6670" />
        <rect x="54" y="18" width="32" height="7" fill="#4a6670" />
        <rect x="54" y="23" width="32" height="3" fill="#3a565f" />
        
        {/* Eyes */}
        <ellipse cx="63" cy="26" rx="3" ry="2.5" fill="#222" />
        <ellipse cx="77" cy="26" rx="3" ry="2.5" fill="#222" />
        
        {/* Nose */}
        <path d="M70,29 L68,34 L72,34 Z" fill="#b8a090" />
        
        {/* Mouth */}
        <path d={isPlaying ? "M64,40 Q70,44 76,40" : "M65,40 Q70,42 75,40"} fill="none" stroke="#8a6a5a" strokeWidth="1.5" />
        
        {/* Stubble */}
        {[0,1,2,3,4,5].map(i => (
          <circle key={i} cx={64 + (i%3)*4} cy={37 + Math.floor(i/3)*2} r="0.6" fill="#7a6a5a" opacity="0.5" />
        ))}
        
        {/* Ears */}
        <ellipse cx="54" cy="28" rx="3" ry="5" fill="#c4a67c" />
        <ellipse cx="86" cy="28" rx="3" ry="5" fill="#c4a67c" />
      </svg>
    </div>
  );
}

// Upgrade Shop - on sidewalk
function UpgradeShop({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ position: "absolute", bottom: "24%", right: "12%", cursor: "pointer", zIndex: 15, transition: "transform 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
      <svg width="130" height="140" viewBox="0 0 100 110">
        <rect x="5" y="25" width="90" height="85" fill="#2a2a35" stroke="#1a1a25" strokeWidth="2" />
        <path d="M0,27 L50,5 L100,27" fill="#3a3a45" stroke="#2a2a35" strokeWidth="1" />
        <rect x="25" y="50" width="50" height="60" rx="2" fill="#1a1a25" />
        <rect x="28" y="53" width="44" height="38" fill="#2a2a30" />
        <rect x="15" y="32" width="70" height="15" rx="2" fill="#8b4513" />
        <text x="50" y="44" textAnchor="middle" fontSize="10" fill="#daa520" fontWeight="bold">UPGRADES</text>
        <circle cx="68" cy="85" r="4" fill="#b8860b" />
        <rect x="35" y="60" width="30" height="12" rx="1" fill="#1a3a1a" />
        <text x="50" y="69" textAnchor="middle" fontSize="7" fill="#4ade80">OPEN</text>
      </svg>
    </div>
  );
}

// Lottery Shop - on sidewalk
function LotteryShop({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ position: "absolute", bottom: "24%", left: "8%", cursor: "pointer", zIndex: 15, transition: "transform 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
      <svg width="130" height="140" viewBox="0 0 100 110">
        <rect x="5" y="25" width="90" height="85" fill="#2a3525" stroke="#1a2515" strokeWidth="2" />
        <path d="M0,27 L50,5 L100,27" fill="#3a4535" stroke="#2a3525" strokeWidth="1" />
        <rect x="25" y="50" width="50" height="60" rx="2" fill="#1a2515" />
        <rect x="28" y="53" width="44" height="38" fill="#2a3520" />
        {/* Lottery tickets display */}
        <rect x="32" y="58" width="15" height="10" rx="1" fill="#ffd700" transform="rotate(-5 40 63)" />
        <rect x="45" y="56" width="15" height="10" rx="1" fill="#ff6b6b" transform="rotate(3 52 61)" />
        <rect x="55" y="60" width="15" height="10" rx="1" fill="#4ecdc4" transform="rotate(-2 62 65)" />
        <rect x="15" y="32" width="70" height="15" rx="2" fill="#228b22" />
        <text x="50" y="44" textAnchor="middle" fontSize="9" fill="#ffd700" fontWeight="bold">🎟️ LOTTERY</text>
        <circle cx="68" cy="85" r="4" fill="#ffd700" />
        <rect x="35" y="75" width="30" height="12" rx="1" fill="#1a1a1a" />
        <text x="50" y="84" textAnchor="middle" fontSize="6" fill="#ffd700">SCRATCH!</text>
      </svg>
    </div>
  );
}

// Store Modal
function StoreModal({ isOpen, onClose, zc, upgradeLevels, onBuy }: { 
  isOpen: boolean; onClose: () => void; zc: number; upgradeLevels: Record<string, number>; onBuy: (id: string) => void;
}) {
  const [tab, setTab] = useState<"skill" | "instrument" | "gear" | "attraction">("skill");
  if (!isOpen) return null;
  
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "#1a1a1a", borderRadius: 12, width: "90%", maxWidth: 500, maxHeight: "80vh", overflow: "hidden", border: "2px solid #daa520" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#daa520", fontSize: 20, fontWeight: 700 }}>🏪 Upgrade Store</div>
            <div style={{ color: "#888", fontSize: 13 }}>Balance: {formatNumber(zc)} ZC</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: 28, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "flex", borderBottom: "1px solid #333" }}>
          {(["skill", "instrument", "gear", "attraction"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "12px 4px", background: tab === t ? "rgba(218,165,32,0.15)" : "transparent", border: "none", borderBottom: tab === t ? "2px solid #daa520" : "2px solid transparent", color: tab === t ? "#daa520" : "#666", fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>
          ))}
        </div>
        <div style={{ maxHeight: 400, overflowY: "auto", padding: 10 }}>
          {UPGRADES.filter(u => u.category === tab).map(upgrade => {
            const level = upgradeLevels[upgrade.id] || 0;
            const cost = getUpgradeCost(upgrade, level);
            const canAfford = zc >= cost && level < upgrade.maxLevel;
            const isMaxed = level >= upgrade.maxLevel;
            return (
              <div key={upgrade.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 8, marginBottom: 6, background: level > 0 ? "rgba(218,165,32,0.05)" : "transparent" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#ccc", fontWeight: 600, fontSize: 15 }}>{upgrade.name}{level > 0 && <span style={{ color: "#daa520", marginLeft: 8 }}>Lv.{level}</span>}</div>
                  <div style={{ color: "#666", fontSize: 12 }}>{upgrade.description}</div>
                  {!isMaxed && <div style={{ color: "#6a9955", fontSize: 11, marginTop: 2 }}>+{upgrade.zpsBonus > 0 ? `${upgrade.zpsBonus}/sec` : `${upgrade.zpcBonus}/tap`}</div>}
                </div>
                <button onClick={() => onBuy(upgrade.id)} disabled={!canAfford} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: isMaxed ? "#4a6" : canAfford ? "#daa520" : "#333", color: isMaxed || canAfford ? "#1a1a1a" : "#555", fontWeight: 600, fontSize: 13, cursor: canAfford ? "pointer" : "default", minWidth: 80 }}>{isMaxed ? "MAX" : formatNumber(cost)}</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Scratch Ticket Component
function ScratchTicket({ ticket, onScratch, isScratching }: { ticket: { price: number; result: number | null; scratched: number[] }; onScratch: (idx: number) => void; isScratching: boolean }) {
  const spots = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const isWin = ticket.result !== null && ticket.result > 0;
  const allScratched = ticket.scratched.length >= 6;
  
  return (
    <div style={{ background: "linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)", borderRadius: 8, padding: 12, width: 200, border: "3px solid #cc8800" }}>
      <div style={{ textAlign: "center", marginBottom: 8, color: "#1a1a1a", fontWeight: 700, fontSize: 14 }}>🎟️ {formatNumber(ticket.price)} ZC TICKET</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
        {spots.map(i => {
          const isRevealed = ticket.scratched.includes(i);
          return (
            <div
              key={i}
              onClick={() => !isRevealed && !isScratching && onScratch(i)}
              style={{
                width: 50, height: 40, borderRadius: 4,
                background: isRevealed ? (isWin && ticket.result ? "#22c55e" : "#666") : "linear-gradient(135deg, #888 0%, #666 100%)",
                cursor: isRevealed ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 12,
                border: "2px solid #555",
                transition: "transform 0.1s",
              }}
              onMouseEnter={e => !isRevealed && (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              {isRevealed ? (ticket.result && ticket.result > 0 ? "💰" : "❌") : "?"}
            </div>
          );
        })}
      </div>
      {allScratched && (
        <div style={{ textAlign: "center", padding: 8, borderRadius: 4, background: isWin ? "#22c55e" : "#dc2626", color: "#fff", fontWeight: 700 }}>
          {isWin ? `🎉 WON ${formatNumber(ticket.result!)} ZC!` : "No luck this time!"}
        </div>
      )}
      {!allScratched && <div style={{ textAlign: "center", color: "#1a1a1a", fontSize: 11 }}>Scratch 6 spots to reveal!</div>}
    </div>
  );
}

// Lottery Modal
function LotteryModal({ isOpen, onClose, zc, onBuyTicket }: { 
  isOpen: boolean; onClose: () => void; zc: number; onBuyTicket: (price: number) => void;
}) {
  const [activeTicket, setActiveTicket] = useState<{ price: number; result: number | null; scratched: number[] } | null>(null);
  const [isScratching, setIsScratching] = useState(false);
  
  const buyTicket = (price: number, maxWin: number, winChance: number) => {
    if (zc < price) return;
    onBuyTicket(price);
    
    // Determine if win (very low chance)
    const won = Math.random() < winChance;
    const result = won ? Math.floor(Math.random() * maxWin * 0.8) + Math.floor(maxWin * 0.2) : 0;
    
    setActiveTicket({ price, result, scratched: [] });
  };
  
  const scratchSpot = (idx: number) => {
    if (!activeTicket || isScratching) return;
    setIsScratching(true);
    
    setTimeout(() => {
      setActiveTicket(prev => prev ? { ...prev, scratched: [...prev.scratched, idx] } : null);
      setIsScratching(false);
    }, 150);
  };
  
  const collectWinnings = () => {
    if (activeTicket?.result && activeTicket.result > 0) {
      onBuyTicket(-activeTicket.result); // Negative = add money
    }
    setActiveTicket(null);
  };
  
  if (!isOpen) return null;
  
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "#1a2a1a", borderRadius: 12, width: "90%", maxWidth: 550, maxHeight: "85vh", overflow: "hidden", border: "2px solid #228b22" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a3a2a", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(90deg, #1a3a1a 0%, #2a4a2a 100%)" }}>
          <div>
            <div style={{ color: "#ffd700", fontSize: 22, fontWeight: 700 }}>🎟️ Lucky Lottery</div>
            <div style={{ color: "#888", fontSize: 13 }}>Balance: {formatNumber(zc)} ZC</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: 28, cursor: "pointer" }}>×</button>
        </div>
        
        <div style={{ padding: 20, maxHeight: 500, overflowY: "auto" }}>
          {activeTicket ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <ScratchTicket ticket={activeTicket} onScratch={scratchSpot} isScratching={isScratching} />
              {activeTicket.scratched.length >= 6 && (
                <button onClick={collectWinnings} style={{
                  padding: "12px 30px", borderRadius: 8, border: "none",
                  background: activeTicket.result && activeTicket.result > 0 ? "#22c55e" : "#666",
                  color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}>
                  {activeTicket.result && activeTicket.result > 0 ? "Collect Winnings!" : "Try Again"}
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ color: "#aaa", textAlign: "center", marginBottom: 16, fontSize: 13 }}>Choose a ticket to scratch!</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                {LOTTERY_TICKETS.map((t, i) => {
                  const canAfford = zc >= t.price;
                  return (
                    <div
                      key={i}
                      onClick={() => canAfford && buyTicket(t.price, t.maxWin, t.winChance)}
                      style={{
                        padding: 16, borderRadius: 8, cursor: canAfford ? "pointer" : "not-allowed",
                        background: canAfford ? "linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)" : "#333",
                        border: `2px solid ${canAfford ? "#cc8800" : "#444"}`,
                        textAlign: "center", transition: "transform 0.2s",
                        opacity: canAfford ? 1 : 0.5,
                      }}
                      onMouseEnter={e => canAfford && (e.currentTarget.style.transform = "scale(1.03)")}
                      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                    >
                      <div style={{ fontSize: 28, marginBottom: 4 }}>🎟️</div>
                      <div style={{ color: "#1a1a1a", fontWeight: 700, fontSize: 16 }}>{formatNumber(t.price)} ZC</div>
                      <div style={{ color: "#4a4a4a", fontSize: 11, marginTop: 4 }}>Win up to {formatNumber(t.maxWin)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FlyingCoin({ x, y, amount }: { x: number; y: number; amount: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none", animation: "coinUp 0.7s ease-out forwards", zIndex: 200, color: "#daa520", fontWeight: 700, fontSize: 18, textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>+{formatNumber(amount)}</div>
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
  const [lotteryOpen, setLotteryOpen] = useState(false);
  const [pedestrians, setPedestrians] = useState<Array<{
    id: number; startX: number; shirtColor: string; pantsColor: string; skinColor: string;
    speed: number; direction: "left" | "right"; willTip: boolean;
  }>>([]);
  
  const coinIdRef = useRef(0);
  const pedIdRef = useRef(0);
  const supabase = createBrowserClient();
  const router = useRouter();

  const recalculateStats = useCallback((levels: Record<string, number>) => {
    let newZps = 0, newZpc = 1;
    for (const u of UPGRADES) { const l = levels[u.id] || 0; newZps += u.zpsBonus * l; newZpc += u.zpcBonus * l; }
    setZps(newZps); setZpc(newZpc);
  }, []);

  const loadGame = useCallback(() => {
    try {
      const saved = localStorage.getItem("musician-beggar-v6");
      if (saved) {
        const data = JSON.parse(saved);
        setZc(data.zc || 0); setTotalEarned(data.totalEarned || 0);
        setUpgradeLevels(data.upgradeLevels || {}); recalculateStats(data.upgradeLevels || {});
        if (data.lastSave && data.zps) {
          const offlineEarn = Math.floor(Math.min((Date.now() - data.lastSave) / 1000, 28800) * data.zps * 0.5);
          if (offlineEarn > 0) { setZc(p => p + offlineEarn); setTotalEarned(p => p + offlineEarn); }
        }
      }
    } catch (e) { console.error(e); }
  }, [recalculateStats]);

  const saveGame = useCallback(() => {
    try { localStorage.setItem("musician-beggar-v6", JSON.stringify({ zc, totalEarned, upgradeLevels, zps, lastSave: Date.now() })); }
    catch (e) { console.error(e); }
  }, [zc, totalEarned, upgradeLevels, zps]);

  const spawnPedestrian = useCallback(() => {
    const direction: "left" | "right" = Math.random() > 0.5 ? "right" : "left";
    const shirts = ["#3b5998", "#c0392b", "#27ae60", "#8e44ad", "#2980b9", "#e74c3c", "#1abc9c", "#f39c12"];
    const pants = ["#2d3436", "#1a252f", "#34495e", "#2c3e50", "#1a1a2e"];
    const skins = ["#e8c4a0", "#d4a574", "#f5deb3", "#deb887", "#c68642", "#ffe4c4"];
    const attractLvl = (upgradeLevels["sign"] || 0) + (upgradeLevels["dog"] || 0);
    setPedestrians(prev => [...prev.slice(-10), {
      id: pedIdRef.current++, startX: direction === "right" ? -100 : 1300,
      shirtColor: shirts[Math.floor(Math.random() * shirts.length)],
      pantsColor: pants[Math.floor(Math.random() * pants.length)],
      skinColor: skins[Math.floor(Math.random() * skins.length)],
      speed: 2.2 + Math.random() * 1.5, direction, willTip: Math.random() < Math.min(0.45, 0.1 + attractLvl * 0.025),
    }]);
  }, [upgradeLevels]);

  const removePedestrian = useCallback((id: number) => setPedestrians(prev => prev.filter(p => p.id !== id)), []);
  
  const handleTip = useCallback(() => {
    const amt = Math.floor(zpc * (0.3 + Math.random() * 0.5));
    setZc(p => p + amt); setTotalEarned(p => p + amt);
  }, [zpc]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setZc(p => p + zpc); setTotalEarned(p => p + zpc); setIsPlaying(true);
    const cid = coinIdRef.current++;
    setFlyingCoins(prev => [...prev, { id: cid, x: e.clientX - rect.left, y: e.clientY - rect.top, amount: zpc }]);
    setTimeout(() => setFlyingCoins(prev => prev.filter(c => c.id !== cid)), 700);
    setTimeout(() => setIsPlaying(false), 120);
  }, [zpc]);

  const buyUpgrade = useCallback((id: string) => {
    const up = UPGRADES.find(u => u.id === id);
    if (!up) return;
    const lvl = upgradeLevels[id] || 0;
    if (lvl >= up.maxLevel || zc < getUpgradeCost(up, lvl)) return;
    setZc(p => p - getUpgradeCost(up, lvl));
    setUpgradeLevels(prev => { const n = { ...prev, [id]: lvl + 1 }; recalculateStats(n); return n; });
  }, [zc, upgradeLevels, recalculateStats]);

  const handleLotteryTransaction = useCallback((amount: number) => {
    if (amount > 0) {
      setZc(p => p - amount); // Buying ticket
    } else {
      setZc(p => p - amount); // Collecting winnings (negative amount = add)
      setTotalEarned(p => p - amount);
    }
  }, []);

  useEffect(() => {
    async function init() {
      // Redirect to home in production - this game is dev-only
      if (!isDev) { router.push("/"); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/login"); return; }
      setUser(session.user);
      const { data } = await supabase.from("users").select("id, username, avatar_url").eq("id", session.user.id).single();
      if (data) setUserData(data);
      loadGame(); setLoading(false);
    }
    init();
  }, [supabase, router, loadGame]);

  useEffect(() => {
    if (loading) return;
    const i = setInterval(() => { if (zps > 0) { setZc(p => p + zps / 10); setTotalEarned(p => p + zps / 10); } }, 100);
    return () => clearInterval(i);
  }, [loading, zps]);

  useEffect(() => {
    if (loading) return;
    setTimeout(spawnPedestrian, 200);
    setTimeout(spawnPedestrian, 700);
    setTimeout(spawnPedestrian, 1300);
    const i = setInterval(spawnPedestrian, 1600);
    return () => clearInterval(i);
  }, [loading, spawnPedestrian]);

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
      <div style={{ minHeight: "100vh", background: "#0f0f12" }}>
        <div style={{ height: 60, background: "rgba(0,0,0,0.5)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
          <div style={{ width: 50, height: 50, border: "3px solid #333", borderTopColor: "#daa520", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      </div>
    );
  }

  const hasSign = (upgradeLevels["sign"] || 0) > 0;
  const hasDog = (upgradeLevels["dog"] || 0) > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f12" }}>
      <Header user={user} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />

      <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", textAlign: "center", zIndex: 100, pointerEvents: "none" }}>
        <div style={{ color: "#daa520", fontSize: 44, fontWeight: 800, textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>{formatNumber(zc)} ZC</div>
        <div style={{ color: "#888", fontSize: 14 }}>{formatNumber(zpc)}/tap • {formatNumber(zps)}/sec</div>
      </div>

      <Link href="/game-hub" style={{ position: "absolute", top: 70, left: 20, color: "#daa520", textDecoration: "none", fontSize: 14, zIndex: 100 }}>← Game Hub</Link>

      <div onClick={handleClick} style={{ position: "fixed", top: 60, left: 0, right: 0, bottom: 0, cursor: "pointer", overflow: "hidden", background: "#0a0a0f" }}>
        {/* Sky */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(180deg, #05050a 0%, #0a0a12 50%, #0f0f18 100%)" }} />
        
        {/* Stars */}
        {[[50,25],[150,50],[280,20],[400,45],[550,30],[700,50],[850,18],[1000,40],[1150,28],[1300,55]].map(([x,y], i) => (
          <div key={i} style={{ position: "absolute", top: y, left: x, width: 2, height: 2, background: "#fff", borderRadius: "50%", opacity: 0.35 }} />
        ))}
        
        {/* Moon */}
        <div style={{ position: "absolute", top: 35, right: 80, width: 55, height: 55, background: "radial-gradient(circle at 35% 35%, #fffacd, #f0e68c 60%, #daa520 100%)", borderRadius: "50%", boxShadow: "0 0 50px rgba(255,250,205,0.3)" }} />
        
        {/* Buildings */}
        <div style={{ position: "absolute", top: "18%", left: 0, right: 0, height: "30%" }}>
          <div style={{ position: "absolute", bottom: 0, left: "2%", width: "8%", height: "65%", background: "#0c0c14" }} />
          <div style={{ position: "absolute", bottom: 0, left: "12%", width: "10%", height: "85%", background: "#08080e" }}>
            {[18,35,52,70].map((t,i) => <div key={i} style={{ position: "absolute", top: `${t}%`, left: "15%", width: "30%", height: "10%", background: i===1?"#3a3525":"#14141c" }} />)}
          </div>
          <div style={{ position: "absolute", bottom: 0, left: "25%", width: "7%", height: "50%", background: "#0a0a12" }} />
          <div style={{ position: "absolute", bottom: 0, right: "25%", width: "9%", height: "70%", background: "#0c0c14" }} />
          <div style={{ position: "absolute", bottom: 0, right: "10%", width: "10%", height: "80%", background: "#08080e" }} />
        </div>
        
        {/* Street lamp */}
        <div style={{ position: "absolute", bottom: "42%", left: "8%", zIndex: 3 }}>
          <div style={{ width: 6, height: 100, background: "#1a1a1a" }} />
          <div style={{ position: "absolute", top: -8, left: -12, width: 30, height: 14, background: "#252525", borderRadius: "3px 3px 0 0" }} />
          <div style={{ position: "absolute", top: 2, left: -8, width: 22, height: 5, background: "#6b8cae", opacity: 0.7, borderRadius: 2, boxShadow: "0 0 25px #6b8cae" }} />
        </div>
        
        {/* Sidewalk - smaller */}
        <div style={{ position: "absolute", bottom: "22%", left: 0, right: 0, height: "12%", background: "linear-gradient(180deg, #22222a 0%, #1a1a22 100%)" }}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: "#2a2a32" }} />
        </div>
        
        {/* Road - bigger */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "22%", background: "#131316" }}>
          <div style={{ position: "absolute", top: "40%", left: 0, right: 0, height: 5, background: "repeating-linear-gradient(90deg, #6b8cae 0px, #6b8cae 45px, transparent 45px, transparent 90px)", opacity: 0.5 }} />
          <div style={{ position: "absolute", top: "70%", left: 0, right: 0, height: 3, background: "repeating-linear-gradient(90deg, #6b8cae 0px, #6b8cae 45px, transparent 45px, transparent 90px)", opacity: 0.3 }} />
        </div>
        
        {/* Lottery Shop - on sidewalk */}
        <LotteryShop onClick={() => setLotteryOpen(true)} />
        
        {/* Musician - on sidewalk */}
        <div style={{ position: "absolute", bottom: "23%", left: "42%", zIndex: 10 }} onClick={e => e.stopPropagation()}>
          <div onClick={handleClick} style={{ cursor: "pointer" }}>
            <HomelessMusician isPlaying={isPlaying} hasSign={hasSign} hasDog={hasDog} />
          </div>
        </div>
        
        {/* Upgrade Shop - on sidewalk */}
        <UpgradeShop onClick={() => setStoreOpen(true)} />
        
        {/* Pedestrians - on road */}
        {pedestrians.map(p => (
          <RobloxPerson key={p.id} id={p.id} startX={p.startX} shirtColor={p.shirtColor} pantsColor={p.pantsColor}
            skinColor={p.skinColor} speed={p.speed} direction={p.direction} willTip={p.willTip} musicianX={550}
            onExit={removePedestrian} onTip={handleTip} />
        ))}

        {flyingCoins.map(c => <FlyingCoin key={c.id} x={c.x} y={c.y} amount={c.amount} />)}
      </div>

      <StoreModal isOpen={storeOpen} onClose={() => setStoreOpen(false)} zc={zc} upgradeLevels={upgradeLevels} onBuy={buyUpgrade} />
      <LotteryModal isOpen={lotteryOpen} onClose={() => setLotteryOpen(false)} zc={zc} onBuyTicket={handleLotteryTransaction} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes coinUp { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(-60px); } }
        @keyframes toss { 0% { opacity:1; transform:translate(0,0); } 100% { opacity:0; transform:translate(25px,45px); } }
      `}</style>
    </div>
  );
}
