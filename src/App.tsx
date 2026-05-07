/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  RefreshCw,
  FileImage,
  FileText,
  X,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [densityTheme, setDensityTheme] = useState<'high' | 'comfortable'>('high');
  const previewRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Logo Pre-fetch Cache ---
  // Converts any external URL → base64 so html2canvas can render it
  const logoCache = useRef<Record<string, string>>({});

  const toBase64 = (url: string): Promise<string> =>
    new Promise((resolve) => {
      if (url.startsWith('data:')) { resolve(url); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 64;
          c.height = img.naturalHeight || 64;
          c.getContext('2d')!.drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch { resolve(url); }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });

  // Pre-cache logos whenever teams change
  useEffect(() => {
    teams.forEach(team => {
      if (!logoCache.current[team.logo]) {
        toBase64(team.logo).then(b64 => {
          logoCache.current[team.logo] = b64;
        });
      }
    });
  }, [teams]);
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

  const handleDownload = useCallback(async (format: 'png' | 'jpg' | 'jpeg' | 'pdf') => {
    if (!previewRef.current) return;
    setIsExporting(true);
    setShowDropdown(false);

    try {
      const el = previewRef.current;
      const fileName = `ff-points-${tournament.title.toLowerCase().replace(/\s+/g, '-')}`;
      const SCALE = 3; // 3x → ~3240px wide, ultra-crisp

      // Ensure all logos are pre-cached as base64 before capture
      await Promise.all(
        teams.map(async (team) => {
          if (!logoCache.current[team.logo]) {
            logoCache.current[team.logo] = await toBase64(team.logo);
          }
        })
      );

      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(el, {
        scale: SCALE,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#020617',
        logging: false,
        imageTimeout: 20000,
        onclone: (_doc, clonedEl) => {
          // 1. Freeze all animations
          const style = _doc.createElement('style');
          style.textContent = `
            *, *::before, *::after {
              animation: none !important;
              transition: none !important;
            }
            /* Replace backdrop-blur with solid bg so it renders */
            .\\!backdrop-blur-sm, [class*="backdrop"] {
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
          `;
          _doc.head.appendChild(style);

          // 2. Patch backdrop-blur elements inline
          clonedEl.querySelectorAll<HTMLElement>('*').forEach(el => {
            const computed = window.getComputedStyle(el);
            if (computed.backdropFilter && computed.backdropFilter !== 'none') {
              el.style.backdropFilter = 'none';
              el.style.webkitBackdropFilter = 'none';
              // Darken the bg slightly to compensate for lost blur
              if (!el.style.backgroundColor || el.style.backgroundColor === 'transparent') {
                el.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
              }
            }
          });

          // 3. Swap all external img src → cached base64
          clonedEl.querySelectorAll<HTMLImageElement>('img').forEach(img => {
            const src = img.getAttribute('src') || '';
            if (logoCache.current[src]) {
              img.src = logoCache.current[src];
            }
          });
        }
      });

      if (format === 'png') {
        triggerDownload(canvas.toDataURL('image/png', 1.0), `${fileName}.png`);
      } else if (format === 'jpg' || format === 'jpeg') {
        triggerDownload(canvas.toDataURL('image/jpeg', 0.95), `${fileName}.jpg`);
      } else if (format === 'pdf') {
        const imgData = canvas.toDataURL('image/png', 1.0);
        const mmW = (canvas.width / SCALE) * 0.2646;
        const mmH = (canvas.height / SCALE) * 0.2646;
        const pdf = new jsPDF({
          orientation: mmW > mmH ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [mmW, mmH],
          compress: true,
        });
        pdf.addImage(imgData, 'PNG', 0, 0, mmW, mmH);
        pdf.save(`${fileName}.pdf`);
      }

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2500);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Download failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [tournament.title, teams]);

  const triggerDownload = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        <header className="h-16 flex items-center justify-between px-8 bg-[#1e293b] border-b border-slate-700 shadow-lg shrink-0 relative z-40">
          <div className="flex items-center gap-3">
             <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">TABLE VIEW</span>
              <h2 className="text-sm font-black text-amber-500 italic uppercase">POINTS PREVIEW</h2>
            </div>
          </div>
          <div className="flex gap-2" ref={dropdownRef}>
              {/* Success Toast */}
              <AnimatePresence>
                {exportSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded text-green-400 text-xs font-black uppercase"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Downloaded!
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Download Button */}
              <div className="flex rounded overflow-hidden shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                <button 
                  disabled={isExporting}
                  onClick={() => handleDownload('png')}
                  className="px-5 py-2 bg-amber-500 text-slate-900 font-black text-xs uppercase hover:bg-amber-400 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      EXPORTING...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      PNG
                    </>
                  )}
                </button>

                {/* Format Picker Toggle */}
                <button
                  disabled={isExporting}
                  onClick={() => setShowDropdown(v => !v)}
                  className="px-2 bg-amber-600 text-slate-900 hover:bg-amber-500 border-l border-amber-700 transition-all disabled:opacity-60"
                >
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showDropdown && "rotate-180")} />
                </button>
              </div>

              {/* Dropdown Panel */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-8 top-14 w-56 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="px-4 py-2.5 border-b border-slate-700 bg-black/30">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Select Export Format</span>
                    </div>

                    {[
                      { format: 'png' as const, label: 'PNG Image', desc: 'Best quality, transparent bg', icon: '🖼️' },
                      { format: 'jpg' as const, label: 'JPG / JPEG', desc: 'Smaller file size', icon: '📷' },
                      { format: 'jpeg' as const, label: 'JPEG (Alt)', desc: 'Same as JPG', icon: '📸' },
                      { format: 'pdf' as const, label: 'PDF Document', desc: 'Print-ready, scalable', icon: '📄' },
                    ].map(({ format, label, desc, icon }) => (
                      <button
                        key={format}
                        onClick={() => handleDownload(format)}
                        disabled={isExporting}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/10 border-b border-slate-800/80 last:border-0 transition-all group disabled:opacity-50"
                      >
                        <span className="text-lg">{icon}</span>
                        <div className="text-left flex-1">
                          <div className="text-xs font-black text-white group-hover:text-amber-400 transition-colors uppercase tracking-wide">{label}</div>
                          <div className="text-[10px] text-slate-500">{desc}</div>
                        </div>
                        <Download className="w-3 h-3 text-slate-600 group-hover:text-amber-500 transition-colors" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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
            <div className="absolute inset-0 bg-[#020617]" />
            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-amber-500/5 to-transparent skew-x-12 translate-x-20" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-500/10 blur-[120px] rounded-full" />
            
            {/* Tech HUD Corner Accents */}
            <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-amber-500/30" />
            <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-amber-500/30" />
            <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-amber-500/30" />
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-amber-500/30" />

            {/* Broadcast Style Header */}
            <div className="relative z-10 h-44 flex items-center justify-between px-16 border-b-2 border-amber-500/20 bg-black/40 backdrop-blur-sm">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-6 w-1 bg-amber-500 rounded-full" />
                  <span className="text-amber-500 font-black tracking-[0.4em] text-sm italic uppercase">{tournament.subtitle}</span>
                </div>
                <h1 className="text-7xl font-black text-white italic tracking-tighter leading-none uppercase drop-shadow-2xl">
                  {tournament.title}
                </h1>
              </div>
              
              <div className="flex items-center gap-10">
                <div className="flex flex-col items-end">
                  <span className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1 italic">OFFICIAL RECORD</span>
                  <div className="flex items-center gap-2 text-white font-black text-xl italic underline decoration-amber-500 decoration-2 underline-offset-4">
                    {tournament.date}
                  </div>
                </div>
                <div className="w-12 h-12 bg-amber-500 rounded-lg rotate-45 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                  <Trophy className="w-8 h-8 text-black -rotate-45" />
                </div>
              </div>
            </div>

            {/* Table Content */}
            <div className="relative z-10 p-12 pt-8">
              <div className="grid grid-cols-[100px_1fr_100px_100px_120px_120px_160px] bg-amber-500 text-black text-xs font-black tracking-[0.2em] p-4 px-10 uppercase mb-4 skew-x-[-12deg] mr-8 ml-4 shadow-[10px_10px_0_rgba(245,158,11,0.2)]">
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
                          isTop3 ? "bg-white/5 border-l-4 border-amber-500" : "bg-slate-900/40 border-l-4 border-slate-700/50"
                        )}
                      >
                      {/* Rank Column */}
                      <div className="flex justify-center relative">
                        {isTop3 && (
                           <div className="absolute inset-0 bg-amber-500/10 blur-xl opacity-50" />
                        )}
                        <span className={cn(
                          "flex items-center justify-center font-black italic font-display",
                          isExtremeDensity ? "text-xl w-8 h-8" : isHighDensity ? "text-2xl w-10 h-10" : "text-4xl w-14 h-14",
                          idx === 0 && "text-white scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]",
                          idx === 1 && "text-slate-300",
                          idx === 2 && "text-amber-700",
                          idx > 2 && "text-slate-600"
                        )}>
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
                              "rounded-md object-cover bg-slate-800 border-2 border-slate-700 shadow-xl",
                              isExtremeDensity ? "w-10 h-10" : isHighDensity ? "w-12 h-12" : "w-16 h-16"
                            )} 
                            alt="" 
                          />
                          {team.wwcd > 0 && (
                            <div className={cn(
                              "absolute -top-2 -right-2 bg-white text-black font-black border border-black shadow-lg",
                              isExtremeDensity ? "text-[8px] px-1" : "text-[10px] px-1.5 py-0.5"
                            )}>
                              BYH x{team.wwcd}
                            </div>
                          )}
                        </div>
                        <span className={cn(
                          fontStyles,
                          "tracking-tight drop-shadow-sm",
                          isTop3 ? "text-white" : "text-slate-400"
                        )}>
                          {team.name}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className={cn("text-center font-black text-slate-500 tabular-nums", isExtremeDensity ? "text-lg" : "text-2xl")}>{team.matches}</div>
                      <div className={cn("text-center font-black text-amber-500 tabular-nums", isExtremeDensity ? "text-lg" : "text-2xl")}>{team.wwcd}</div>
                      <div className={cn("text-center font-black text-slate-400 tabular-nums", isExtremeDensity ? "text-lg" : "text-2xl")}>{team.placementPoints}</div>
                      <div className={cn("text-center font-black text-slate-400 tabular-nums", isExtremeDensity ? "text-lg" : "text-2xl")}>{team.killPoints}</div>
                      
                      {/* Total Pts (Highlighted Column) */}
                      <div className="flex justify-center">
                         <div className={cn(
                           "rounded-sm text-center font-black font-display italic transition-all tabular-nums",
                           isExtremeDensity ? "min-w-20 px-3 py-1 text-2xl" : isHighDensity ? "min-w-24 px-4 py-1.5 text-3xl" : "min-w-28 px-5 py-2 text-5xl",
                           idx === 0 ? "bg-amber-500 text-black shadow-[0_0_25px_rgba(245,158,11,0.4)]" : "bg-white/5 text-white"
                         )}>
                            {total}
                         </div>
                      </div>

                      {/* Accent lines for rows */}
                      <div className="absolute bottom-0 right-0 w-1/4 h-px bg-gradient-to-l from-amber-500/20 to-transparent" />
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer Graphics */}
            <div className="h-20 bg-black/80 flex items-center justify-between px-16 border-t border-slate-800/50">
              <div className="flex items-center gap-6 opacity-40">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 animate-pulse" />
                  <span className="text-[10px] font-black tracking-[0.5em] text-white uppercase italic">Broadcast System Active</span>
                </div>
                <div className="w-24 h-px bg-slate-800" />
                <span className="text-[10px] font-black tracking-[0.3em] text-slate-600 uppercase">SERVER: {tournament.location}</span>
              </div>
              
              <div className="text-right">
                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase block mb-1">DESIGNED BY</span>
                <span className="text-sm font-black text-white italic tracking-tighter uppercase px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded">
                  FF <span className="text-amber-500">PRO TABLE</span> MAKER
                </span>
              </div>
            </div>

            {/* Scanning Line Effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50" style={{ backgroundSize: '100% 2px, 3px 100%' }} />
          </div>
        </div>
      </main>
    </div>
  );
}
