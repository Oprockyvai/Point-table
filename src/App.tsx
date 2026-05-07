/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Trophy, 
  Users, 
  MapPin, 
  Calendar,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Team {
  id: string;
  name: string;
  logo: string; // Data URL or URL
  matches: number;
  wwcd: number;
  placementPoints: number;
  killPoints: number;
}

interface Tournament {
  title: string;
  subtitle: string;
  date: string;
  location: string;
}

const DEFAULT_TOURNAMENT: Tournament = {
  title: "FREE FIRE CHAMPIONSHIP",
  subtitle: "GRAND FINALS • DAY 01",
  date: "OCTOBER 24, 2026",
  location: "DHAKA, BANGLADESH"
};

const INITIAL_TEAM: Team = {
  id: "1",
  name: "GALAXY GAMING",
  logo: "https://api.dicebear.com/7.x/shapes/svg?seed=1",
  matches: 0,
  wwcd: 0,
  placementPoints: 0,
  killPoints: 0
};

const COLORS = {
  amber: "#f59e0b",
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },
  white: "#ffffff",
  black: "#000000",
};

export default function App() {
  const [tournament, setTournament] = useState<Tournament>(DEFAULT_TOURNAMENT);
  const [teams, setTeams] = useState<Team[]>(
    Array.from({ length: 12 }, (_, i) => ({
      ...INITIAL_TEAM,
      id: crypto.randomUUID(),
      name: i < 3 ? ["TEAM ELITE", "GOD-LIKE", "NINJA ESPORTS"][i] : `SQUAD ${i + 1}`,
      logo: `https://api.dicebear.com/7.x/identicon/svg?seed=ff-team-${i}`
    }))
  );
  
  const [isExporting, setIsExporting] = useState(false);
  const [densityTheme, setDensityTheme] = useState<'high' | 'comfortable'>('high');
  const previewRef = useRef<HTMLDivElement>(null);

  // --- Dynamic Density Logic ---
  const teamCount = teams.length;
  const isHighDensity = teamCount > 15 || densityTheme === 'high';
  const isExtremeDensity = teamCount > 30;

  const rowStyles = cn(
    "grid grid-cols-[100px_1fr_100px_100px_120px_120px_160px] items-center px-10 relative transition-all group overflow-hidden",
    densityTheme === 'comfortable' && !isHighDensity ? "p-6" : 
    isExtremeDensity ? "p-1.5" : 
    isHighDensity ? "p-2.5" : "p-4"
  );

  const fontStyles = cn(
    "font-black font-display uppercase italic",
    densityTheme === 'comfortable' && !isHighDensity ? "text-4xl" :
    isExtremeDensity ? "text-lg" : isHighDensity ? "text-2xl" : "text-3xl"
  );

  // --- Handlers ---
  const addTeam = () => {
    const newTeam: Team = {
      ...INITIAL_TEAM,
      id: crypto.randomUUID(),
      name: `NEW TEAM ${teams.length + 1}`,
      logo: `https://api.dicebear.com/7.x/identicon/svg?seed=${Date.now()}`
    };
    setTeams([...teams, newTeam]);
  };

  const updateTeam = (id: string, updates: Partial<Team>) => {
    setTeams(teams.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const removeTeam = (id: string) => {
    setTeams(teams.filter(t => t.id !== id));
  };

  const handleLogoUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateTeam(id, { logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = useCallback(async (format: 'png' | 'jpg' | 'pdf') => {
    if (!previewRef.current) return;
    setIsExporting(true);
    
    try {
      // Small delay to ensure any layout transitions or images are fully ready
      await new Promise(resolve => setTimeout(resolve, 800));

      const element = previewRef.current;
      const fileName = `ff-points-${tournament.title.toLowerCase().replace(/\s+/g, '-')}`;
      
      const options = {
        quality: 1.0,
        pixelRatio: 3, // Very high resolution for crisp lines
        backgroundColor: COLORS.slate[950],
        style: {
          transform: 'none',
          boxShadow: 'none',
          margin: '0',
        },
        // Force the capture library to respect the exact dimensions
        width: element.offsetWidth,
        height: element.offsetHeight,
      };

      let dataUrl = '';
      if (format === 'png') {
        dataUrl = await htmlToImage.toPng(element, options);
      } else if (format === 'jpg') {
        dataUrl = await htmlToImage.toJpeg(element, options);
      } else if (format === 'pdf') {
        dataUrl = await htmlToImage.toPng(element, options);
      }

      if (format === 'pdf') {
        const pdf = new jsPDF({
          orientation: element.offsetWidth > element.offsetHeight ? 'landscape' : 'portrait',
          unit: 'px',
          format: [element.offsetWidth, element.offsetHeight]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, element.offsetWidth, element.offsetHeight);
        pdf.save(`${fileName}.pdf`);
      } else {
        const link = document.createElement('a');
        link.download = `${fileName}.${format}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. This might be due to a browser restriction or complex styles. Please try taking a manual screenshot if the problem persists.");
    } finally {
      setIsExporting(false);
    }
  }, [tournament.title, tournament.subtitle]);

  const sortedTeams = [...teams].sort((a, b) => {
    const totalA = a.placementPoints + a.killPoints;
    const totalB = b.placementPoints + b.killPoints;
    if (totalB !== totalA) return totalB - totalA;
    if (b.wwcd !== a.wwcd) return b.wwcd - a.wwcd;
    return b.killPoints - a.killPoints;
  });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#020617] text-slate-200 font-sans">
      
      {/* --- Sidebar (Editor) --- */}
      <aside className="w-full lg:w-80 shrink-0 border-r border-slate-700 bg-[#1e293b] p-6 overflow-y-auto no-scrollbar flex flex-col gap-8 shadow-2xl">
        <header>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-amber-500 p-2 rounded-md shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <Trophy className="w-5 h-5 text-slate-900" />
            </div>
            <h1 className="text-xl font-black italic uppercase tracking-tight">FF <span className="text-amber-500">Maker</span></h1>
          </div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">High Density Esports Edition</p>
        </header>

        {/* Theme Switcher */}
        <section>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Layout Style</h3>
          <div className="flex p-1 bg-[#0f172a] rounded-lg border border-slate-700">
            <button 
              onClick={() => setDensityTheme('high')}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-black uppercase rounded transition-all",
                densityTheme === 'high' ? "bg-amber-500 text-slate-900 shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              High Density
            </button>
            <button 
              onClick={() => setDensityTheme('comfortable')}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-black uppercase rounded transition-all",
                densityTheme === 'comfortable' ? "bg-amber-500 text-slate-900 shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Comfortable
            </button>
          </div>
        </section>

        {/* Tournament Info Section */}
        <section>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Tournament Info</h3>
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Title</span>
              <input 
                className="high-density-input w-full"
                value={tournament.title}
                onChange={e => setTournament({ ...tournament, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Subtitle</span>
              <input 
                className="high-density-input w-full"
                value={tournament.subtitle}
                onChange={e => setTournament({ ...tournament, subtitle: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Date</span>
                <input 
                  className="high-density-input w-full"
                  value={tournament.date}
                  onChange={e => setTournament({ ...tournament, date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
                <input 
                  className="high-density-input w-full"
                  value={tournament.location}
                  onChange={e => setTournament({ ...tournament, location: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Squad Data Section */}
        <section className="flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Squad Data ({teams.length})</h3>
            <button 
              onClick={addTeam}
              className="text-amber-500 text-[10px] font-black uppercase hover:text-amber-400"
            >
              + Add Team
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 no-scrollbar flex flex-col gap-3">
            {teams.map((team, idx) => (
              <motion.div 
                layout
                key={team.id}
                className="high-density-card p-3 flex flex-col gap-3"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-amber-500 tracking-tighter uppercase italic">SQUAD #{String(idx + 1).padStart(2, '0')}</span>
                  <button onClick={() => removeTeam(team.id)} className="text-slate-600 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="flex gap-2">
                   <div className="relative group shrink-0">
                    <img src={team.logo} alt="" className="w-8 h-8 rounded bg-slate-800 object-cover border border-slate-700" />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 cursor-pointer rounded transition-opacity">
                      <ImageIcon className="w-3 h-3 text-white" />
                      <input type="file" className="hidden" accept="image/*" onChange={e => handleLogoUpload(team.id, e)} />
                    </label>
                  </div>
                  <input 
                    className="flex-1 bg-transparent border-b border-slate-700 focus:border-amber-500 text-xs font-black uppercase tracking-tight focus:outline-none"
                    value={team.name}
                    onChange={e => updateTeam(team.id, { name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-4 gap-1">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] text-slate-500 font-black uppercase">MTCH</label>
                    <input 
                      type="number"
                      className="bg-slate-800 text-[10px] py-0.5 text-center rounded border border-slate-700 focus:outline-none focus:border-amber-500"
                      value={team.matches}
                      onChange={e => updateTeam(team.id, { matches: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] text-slate-500 font-black uppercase">BOOYAH</label>
                    <input 
                      type="number"
                      className="bg-slate-800 text-[10px] py-0.5 text-center rounded border border-slate-700 focus:outline-none focus:border-amber-500"
                      value={team.wwcd}
                      onChange={e => updateTeam(team.id, { wwcd: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                   <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] text-slate-500 font-black uppercase text-amber-500/70">PLACE</label>
                    <input 
                      type="number"
                      className="bg-slate-800 text-[10px] py-0.5 text-center rounded border border-slate-700 focus:outline-none focus:border-amber-500"
                      value={team.placementPoints}
                      onChange={e => updateTeam(team.id, { placementPoints: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] text-slate-500 font-black uppercase">KILLS</label>
                    <input 
                      type="number"
                      className="bg-slate-800 text-[10px] py-0.5 text-center rounded border border-slate-700 focus:outline-none focus:border-amber-500"
                      value={team.killPoints}
                      onChange={e => updateTeam(team.id, { killPoints: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </aside>

      {/* --- Preview & Action Area --- */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 bg-[#1e293b] border-b border-slate-700 shadow-lg shrink-0">
          <div className="flex items-center gap-3">
             <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">TABLE VIEW</span>
              <h2 className="text-sm font-black text-amber-500 italic uppercase">POINTS PREVIEW</h2>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex p-0.5 bg-slate-800 rounded-lg border border-slate-700 shadow-inner">
               <button 
                  disabled={isExporting}
                  onClick={() => handleDownload('png')}
                  className="px-4 py-2 hover:bg-slate-700 text-slate-200 rounded font-black text-[10px] uppercase transition-all flex items-center gap-1.5"
               >
                 <Download className="w-3 h-3 text-amber-500" />
                 PNG
               </button>
               <div className="w-px h-4 self-center bg-slate-700" />
               <button 
                  disabled={isExporting}
                  onClick={() => handleDownload('jpg')}
                  className="px-4 py-2 hover:bg-slate-700 text-slate-200 rounded font-black text-[10px] uppercase transition-all flex items-center gap-1.5"
               >
                 JPG
               </button>
               <div className="w-px h-4 self-center bg-slate-700" />
               <button 
                  disabled={isExporting}
                  onClick={() => handleDownload('pdf')}
                  className="px-4 py-2 hover:bg-slate-700 text-slate-200 rounded font-black text-[10px] uppercase transition-all flex items-center gap-1.5"
               >
                 PDF
               </button>
            </div>
            
            {isExporting && (
              <div className="flex items-center gap-2 px-3 animate-pulse">
                <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
                <span className="text-[10px] font-black text-amber-500 uppercase italic">Exporting...</span>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 bg-[#020617] p-8 flex items-center justify-center overflow-auto no-scrollbar">
          {/* --- THE ACTUAL TABLE (To capture) --- */}
          <div 
            ref={previewRef} 
            id="point-table-capture"
            className="w-[1080px] bg-black p-0 shrink-0 select-none shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden"
          >
            
            {/* Professional Background Layers */}
            <div className="absolute inset-0" style={{ backgroundColor: COLORS.slate[950] }} />
            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
            <div className="absolute top-0 right-0 w-1/2 h-full skew-x-12 translate-x-20" style={{ background: `linear-gradient(to left, ${COLORS.amber}1a, transparent)` }} />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 blur-[120px] rounded-full" style={{ backgroundColor: `${COLORS.amber}1a` }} />
            
            {/* Tech HUD Corner Accents */}
            <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2" style={{ borderColor: `${COLORS.amber}4d` }} />
            <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2" style={{ borderColor: `${COLORS.amber}4d` }} />
            <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2" style={{ borderColor: `${COLORS.amber}4d` }} />
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2" style={{ borderColor: `${COLORS.amber}4d` }} />

            {/* Broadcast Style Header */}
            <div className="relative z-10 h-44 flex items-center justify-between px-16 border-b-2" style={{ borderColor: `${COLORS.amber}33`, backgroundColor: COLORS.slate[950] }}>
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-6 w-1 rounded-full" style={{ backgroundColor: COLORS.amber }} />
                  <span className="font-black tracking-[0.4em] text-sm italic uppercase" style={{ color: COLORS.amber }}>{tournament.subtitle}</span>
                </div>
                <h1 className="text-7xl font-black italic tracking-tighter leading-none uppercase drop-shadow-2xl" style={{ color: COLORS.white }}>
                  {tournament.title}
                </h1>
              </div>
              
              <div className="flex items-center gap-10">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-black tracking-widest mb-1 italic" style={{ color: COLORS.slate[500] }}>OFFICIAL RECORD</span>
                  <div className="flex items-center gap-2 font-black text-xl italic underline decoration-2 underline-offset-4" style={{ color: COLORS.white, textDecorationColor: COLORS.amber }}>
                    {tournament.date}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-lg rotate-45 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.5)]" style={{ backgroundColor: COLORS.amber }}>
                  <Trophy className="w-8 h-8 text-black -rotate-45" />
                </div>
              </div>
            </div>

            {/* Table Content */}
            <div className="relative z-10 p-12 pt-8">
              <div className="grid grid-cols-[100px_1fr_100px_100px_120px_120px_160px] text-xs font-black tracking-[0.2em] p-4 px-10 uppercase mb-4 skew-x-[-12deg] mr-8 ml-4 shadow-[10px_10px_0_rgba(245,158,11,0.2)]" style={{ backgroundColor: COLORS.amber, color: COLORS.black }}>
                <div className="text-center skew-x-[12deg]">RANK</div>
                <div className="pl-4 skew-x-[12deg]">SQUAD NAME</div>
                <div className="text-center skew-x-[12deg]">MATCH</div>
                <div className="text-center skew-x-[12deg]">BYH</div>
                <div className="text-center skew-x-[12deg]">PLACE</div>
                <div className="text-center skew-x-[12deg]">KILLS</div>
                <div className="text-center skew-x-[12deg]">TOTAL PTS</div>
              </div>

              <div className="space-y-1.5 min-h-[400px]">
                <AnimatePresence mode="popLayout">
                  {sortedTeams.map((team, idx) => {
                    const total = team.placementPoints + team.killPoints;
                    const isTop3 = idx < 3;
                    
                    return (
                      <motion.div 
                        layout
                        key={team.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 400, 
                          damping: 30,
                          layout: { duration: 0.4 } 
                        }}
                        className={cn(
                          rowStyles,
                          "border-l-4"
                        )}
                        style={{
                           backgroundColor: isTop3 ? `${COLORS.white}0d` : `${COLORS.slate[900]}66`,
                           borderLeftColor: isTop3 ? COLORS.amber : `${COLORS.slate[700]}80`
                        }}
                      >
                      {/* Rank Column */}
                      <div className="flex justify-center relative">
                        {isTop3 && (
                           <div className="absolute inset-0 blur-xl opacity-50" style={{ backgroundColor: `${COLORS.amber}1a` }} />
                        )}
                        <span className={cn(
                          "flex items-center justify-center font-black italic font-display",
                          isExtremeDensity ? "text-xl w-8 h-8" : isHighDensity ? "text-2xl w-10 h-10" : "text-4xl w-14 h-14",
                          idx === 0 && "scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                        )}
                        style={{
                           color: idx === 0 ? COLORS.white : idx === 1 ? COLORS.slate[300] : idx === 2 ? "#b45309" : COLORS.slate[600]
                        }}>
                          #{idx + 1}
                        </span>
                      </div>

                      {/* Team Logo & Name */}
                      <div className="flex items-center gap-6">
                        <div className="relative shrink-0">
                          <img 
                            src={team.logo} 
                            crossOrigin="anonymous"
                            className={cn(
                              "rounded-md object-cover border-2 shadow-xl",
                              isExtremeDensity ? "w-10 h-10" : isHighDensity ? "w-12 h-12" : "w-16 h-16"
                            )} 
                            style={{ 
                               backgroundColor: COLORS.slate[800],
                               borderColor: COLORS.slate[700]
                            }}
                            alt="" 
                          />
                          {team.wwcd > 0 && (
                            <div className={cn(
                              "absolute -top-2 -right-2 font-black border shadow-lg",
                              isExtremeDensity ? "text-[8px] px-1" : "text-[10px] px-1.5 py-0.5"
                            )}
                            style={{ backgroundColor: COLORS.white, color: COLORS.black, borderColor: COLORS.black }}
                            >
                              BYH x{team.wwcd}
                            </div>
                          )}
                        </div>
                        <span className={cn(
                          fontStyles,
                          "tracking-tight drop-shadow-sm",
                        )}
                        style={{
                           color: isTop3 ? COLORS.white : COLORS.slate[400]
                        }}>
                          {team.name}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className={cn("text-center font-black tabular-nums", isExtremeDensity ? "text-lg" : "text-2xl")} style={{ color: COLORS.slate[500] }}>{team.matches}</div>
                      <div className={cn("text-center font-black tabular-nums", isExtremeDensity ? "text-lg" : "text-2xl")} style={{ color: COLORS.amber }}>{team.wwcd}</div>
                      <div className={cn("text-center font-black tabular-nums", isExtremeDensity ? "text-lg" : "text-2xl")} style={{ color: COLORS.slate[400] }}>{team.placementPoints}</div>
                      <div className={cn("text-center font-black tabular-nums", isExtremeDensity ? "text-lg" : "text-2xl")} style={{ color: COLORS.slate[400] }}>{team.killPoints}</div>
                      
                      {/* Total Pts (Highlighted Column) */}
                      <div className="flex justify-center">
                         <div className={cn(
                           "rounded-sm text-center font-black font-display italic transition-all tabular-nums",
                           isExtremeDensity ? "min-w-20 px-3 py-1 text-2xl" : isHighDensity ? "min-w-24 px-4 py-1.5 text-3xl" : "min-w-28 px-5 py-2 text-5xl",
                         )}
                         style={{
                            backgroundColor: idx === 0 ? COLORS.amber : `${COLORS.white}0d`,
                            color: idx === 0 ? COLORS.black : COLORS.white,
                            boxShadow: idx === 0 ? `0 0 25px ${COLORS.amber}66` : 'none'
                         }}>
                            {total}
                         </div>
                      </div>

                      {/* Accent lines for rows */}
                      <div className="absolute bottom-0 right-0 w-1/4 h-px" style={{ background: `linear-gradient(to left, ${COLORS.amber}33, transparent)` }} />
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer Graphics */}
            <div className="h-20 flex items-center justify-between px-16 border-t" style={{ backgroundColor: COLORS.slate[950], borderColor: `${COLORS.slate[800]}80` }}>
              <div className="flex items-center gap-6 opacity-40">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 animate-pulse" style={{ backgroundColor: COLORS.amber }} />
                  <span className="text-[10px] font-black tracking-[0.5em] uppercase italic" style={{ color: COLORS.white }}>Broadcast System Active</span>
                </div>
                <div className="w-24 h-px" style={{ backgroundColor: COLORS.slate[800] }} />
                <span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: COLORS.slate[600] }}>SERVER: {tournament.location}</span>
              </div>
              
              <div className="text-right">
                <span className="text-[10px] font-black tracking-widest uppercase block mb-1" style={{ color: COLORS.slate[500] }}>DESIGNED BY</span>
                <span className="text-sm font-black italic tracking-tighter uppercase px-3 py-1 border rounded" style={{ color: COLORS.white, backgroundColor: `${COLORS.amber}1a`, borderColor: `${COLORS.amber}33` }}>
                  FF <span style={{ color: COLORS.amber }}>PRO TABLE</span> MAKER
                </span>
              </div>
            </div>

            {/* Scanning Line Effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-50" style={{ backgroundImage: 'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.25) 50%), linear-gradient(90deg, rgba(255,0,0,0.06), rgba(0,255,0,0.02), rgba(0,0,255,0.06))', backgroundSize: '100% 2px, 3px 100%' }} />
          </div>
        </div>
      </main>
    </div>
  );
}
