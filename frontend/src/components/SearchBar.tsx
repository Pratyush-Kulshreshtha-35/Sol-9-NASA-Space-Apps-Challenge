import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Compass, Sliders, Sparkles, Orbit, Radio, Zap, Info } from 'lucide-react';
import { PresetTarget } from '../types/astronomy';

interface SearchBarProps {
  presets: PresetTarget[];
  onSelectPreset: (preset: PresetTarget) => void;
  onSearch: (query: string) => void;
  loading: boolean;
  fovDeg: number;
  onFovChange: (fov: number) => void;
  stretch: string;
  onStretchChange: (stretch: string) => void;
  collection: string;
  onCollectionChange: (col: string) => void;
  includeDeep: boolean;
  onIncludeDeepChange: (deep: boolean) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  presets,
  onSelectPreset,
  onSearch,
  loading,
  fovDeg,
  onFovChange,
  stretch,
  onStretchChange,
  collection,
  onCollectionChange,
  includeDeep,
  onIncludeDeepChange,
}) => {
  const [searchParams] = useSearchParams();
  const [inputVal, setInputVal] = useState<string>(searchParams.get('target') || 'Barnard\'s Star');
  const [showConfig, setShowConfig] = useState(false);

  const fovArcmin = (fovDeg * 60).toFixed(1);
  const estSizeKb = Math.round(120 * (fovDeg / 0.08));
  const estLatencyMs = Math.round(15 + fovDeg * 40);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSearch(inputVal.trim());
    }
  };

  const currentTargetId = searchParams.get('targetId') || 'barnards_star';

  return (
    <div className="bg-space-dark/95 border-b border-space-border/80 backdrop-blur-md px-4 py-3 sticky top-0 z-30 shadow-xl">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Main Bar: Logo, Search, Presets & Config Toggle */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Mission Branding */}
          <div className="flex items-center gap-2.5 shrink-0 pr-2">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              <img src="/favicon-128.png" alt="Sol-9 Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-widest uppercase bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                  Sol-9
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-400 font-mono font-semibold">
                  SPHEREx & PLANET X
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">NASA Space Apps Challenge</p>
            </div>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSubmit} className="flex-1 w-full flex items-center relative">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Target name (e.g. Barnard's Star, WISE 0855) or sexagesimal / decimal RA, Dec..."
              className="w-full bg-space-darkest/90 border border-space-border rounded-lg pl-10 pr-24 py-2 text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-all flex items-center gap-1 shadow-sm"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-3 h-3" />
                  <span>Query</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Config Toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              showConfig
                ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300'
                : 'bg-space-panel border-space-border text-slate-300 hover:border-slate-600'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>FOV & Stretch</span>
          </button>
        </div>

        {/* Challenge Target Presets Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Challenge Presets:</span>
          </div>

          {presets.map((preset) => {
            const isSelected = currentTargetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  setInputVal(preset.name);
                  onSelectPreset(preset);
                }}
                className={`group px-2.5 py-1 rounded-md border shrink-0 transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-900/30 ring-1 ring-cyan-500/50'
                    : 'bg-space-darkest/70 border-space-border text-slate-300 hover:border-cyan-700/60 hover:text-white'
                }`}
                title={`${preset.type} • ${preset.description}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600 group-hover:bg-cyan-400'}`} />
                <span className="font-semibold text-[11px]">{preset.name}</span>
                <span className="text-[10px] text-slate-400 hidden lg:inline font-mono">({preset.type.split(' ')[0]})</span>
              </button>
            );
          })}
        </div>

        {/* Collapsible FOV, Stretch & SIA2 Settings Panel */}
        {showConfig && (
          <div className="bg-space-darkest/95 border border-space-border rounded-xl p-3.5 mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs animate-fadeIn">
            {/* Field of View Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-medium flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  Field of View (FOV)
                </span>
                <span className="font-mono text-cyan-300 font-bold">{fovArcmin}' ({fovDeg.toFixed(3)}°)</span>
              </div>
              <input
                type="range"
                min="0.016"
                max="0.25"
                step="0.005"
                value={fovDeg}
                onChange={(e) => onFovChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-space-panel cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>1.0' (High-res)</span>
                <span className="text-amber-400 font-sans">
                  ~{estSizeKb} KB • {estLatencyMs}ms
                </span>
                <span>15.0' (Wide-field)</span>
              </div>
            </div>

            {/* Astronomical Stretch Mode */}
            <div className="space-y-1.5">
              <span className="font-medium text-slate-300 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Pixel Intensity Stretch
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(['asinh', 'log', 'linear'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onStretchChange(mode)}
                    className={`py-1.5 px-2 rounded font-mono text-[11px] capitalize border transition-all ${
                      stretch === mode
                        ? 'bg-amber-950/70 border-amber-500 text-amber-200 font-semibold'
                        : 'bg-space-panel border-space-border text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                {stretch === 'asinh' ? 'Lupton Asinh: High dynamic range without saturating core' :
                 stretch === 'log' ? 'Logarithmic: Amplifies faint diffuse background features' :
                 'Linear: 1% to 99.5% percentile standard contrast'}
              </p>
            </div>

            {/* IRSA SIA2 Collection & Deep Stacking */}
            <div className="space-y-1.5">
              <span className="font-medium text-slate-300 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                IRSA SIA2 Collection
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={collection}
                  onChange={(e) => onCollectionChange(e.target.value)}
                  className="bg-space-panel border border-space-border rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500 flex-1"
                >
                  <option value="spherex_dr1">SPHEREx DR1 (Full Survey)</option>
                  <option value="spherex_qr3">SPHEREx QR3 (Quick Release)</option>
                  <option value="spherex_deep">SPHEREx Deep Polar Fields</option>
                </select>
                <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeDeep}
                    onChange={(e) => onIncludeDeepChange(e.target.checked)}
                    className="accent-cyan-400 rounded"
                  />
                  <span>Coadd</span>
                </label>
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info className="w-3 h-3 text-cyan-400 shrink-0" />
                Queries Caltech-IPAC SIA2 endpoints with MEF cutout parsing.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
