import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchBar } from './components/SearchBar';
import { SkyBlinkerCanvas } from './components/SkyBlinkerCanvas';
import { AladinContextView } from './components/AladinContextView';
import { SpectrumPlot } from './components/SpectrumPlot';
import { DataAttributionModal } from './components/DataAttributionModal';
import { CutoutsResponse, OverlayResponse, SpectrumResponse, PresetTarget } from './types/astronomy';
import { Info, Orbit, PanelRightClose, PanelRightOpen, ExternalLink, HelpCircle, AlertCircle, RefreshCw } from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.port === '5173' ? 'http://127.0.0.1:8000' : '';

export const App: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Query Parameters State Sync
  const raParam = parseFloat(searchParams.get('ra') || '269.45208');
  const decParam = parseFloat(searchParams.get('dec') || '4.69339');
  const fovParam = parseFloat(searchParams.get('fov') || '0.08');
  const stretchParam = searchParams.get('stretch') || 'asinh';
  const modeParam = (searchParams.get('mode') as any) || 'sequence';
  const fpsParam = parseInt(searchParams.get('fps') || '4', 10);
  const targetIdParam = searchParams.get('targetId') || 'barnards_star';
  const targetNameParam = searchParams.get('targetName') || "Barnard's Star";

  // Data State
  const [presets, setPresets] = useState<PresetTarget[]>([]);
  const [cutouts, setCutouts] = useState<CutoutsResponse | null>(null);
  const [overlays, setOverlays] = useState<OverlayResponse | null>(null);
  const [spectrum, setSpectrum] = useState<SpectrumResponse | null>(null);

  // UI State
  const [loadingCutouts, setLoadingCutouts] = useState<boolean>(false);
  const [loadingSpectrum, setLoadingSpectrum] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [collection, setCollection] = useState<string>('spherex_dr1');
  const [includeDeep, setIncludeDeep] = useState<boolean>(true);
  const [selectedBand, setSelectedBand] = useState<number>(1);
  const [showAladinSplit, setShowAladinSplit] = useState<boolean>(true);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // Helper to update search params
  const updateUrlParams = useCallback(
    (params: Record<string, string | number>) => {
      const nextParams = new URLSearchParams(searchParams);
      Object.entries(params).forEach(([k, v]) => {
        nextParams.set(k, String(v));
      });
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // 1. Fetch Presets on Mount
  useEffect(() => {
    fetch(`${API_BASE}/api/presets`)
      .then((res) => res.json())
      .then((data: PresetTarget[]) => setPresets(data))
      .catch((err) => console.warn('Could not load presets:', err));
  }, []);

  // 2. Fetch Cutouts and Overlays when (ra, dec, fov, stretch, collection) change
  const fetchData = useCallback(
    async (ra: number, dec: number, fov: number, stretch: string, col: string) => {
      setLoadingCutouts(true);
      setErrorMsg(null);
      try {
        // Parallel fetch cutouts & multi-mission overlays
        const [cutoutRes, overlayRes] = await Promise.all([
          fetch(
            `${API_BASE}/api/cutouts?ra=${ra}&dec=${dec}&fov=${fov}&stretch=${stretch}&collection=${col}&include_deep=${includeDeep}`
          ),
          fetch(`${API_BASE}/api/overlays?ra=${ra}&dec=${dec}&fov=${fov}`),
        ]);

        if (!cutoutRes.ok) throw new Error(`Cutouts server error: ${cutoutRes.statusText}`);
        const cutoutData = await cutoutRes.json();
        setCutouts(cutoutData);

        if (overlayRes.ok) {
          const overlayData = await overlayRes.json();
          setOverlays(overlayData);
        }
      } catch (err: any) {
        console.error('Error fetching cutouts:', err);
        setErrorMsg(err.message || 'Error communicating with SPHEREx backend');
      } finally {
        setLoadingCutouts(false);
      }
    },
    [includeDeep]
  );

  useEffect(() => {
    fetchData(raParam, decParam, fovParam, stretchParam, collection);
    fetchSpectrum(128, 128, raParam, decParam, targetNameParam);
  }, [raParam, decParam, fovParam, stretchParam, collection, fetchData]);

  // Handle Preset Selection
  const handleSelectPreset = (preset: PresetTarget) => {
    updateUrlParams({
      ra: preset.ra,
      dec: preset.dec,
      fov: preset.fov_deg,
      targetId: preset.id,
      targetName: preset.name,
      target: preset.name,
    });
    // Trigger initial central spectrum for the selected target
    fetchSpectrum(128, 128, preset.ra, preset.dec, preset.name);
  };

  // Handle Free-Form Search (Object Name or Coordinates)
  const handleSearch = async (query: string) => {
    try {
      setLoadingCutouts(true);
      const res = await fetch(`${API_BASE}/api/resolve?name=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Could not resolve coordinate');
      const resolved = await res.json();

      updateUrlParams({
        ra: resolved.ra,
        dec: resolved.dec,
        targetName: resolved.display_name,
        targetId: 'custom',
        target: query,
      });

      // Clear previous spectrum
      setSpectrum(null);
    } catch (err: any) {
      setErrorMsg(`Failed to resolve target "${query}": ${err.message}`);
      setLoadingCutouts(false);
    }
  };

  // Click-to-Spectrum Photometry
  const fetchSpectrum = async (pixelX: number, pixelY: number, ra: number, dec: number, customTargetName?: string) => {
    setLoadingSpectrum(true);
    try {
      const res = await fetch(`${API_BASE}/api/spectrum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ra,
          dec,
          pixel_x: pixelX,
          pixel_y: pixelY,
          fov: fovParam,
          target_name: customTargetName || targetNameParam,
        }),
      });

      if (!res.ok) throw new Error('Aperture Photometry failed');
      const data = await res.json();
      setSpectrum(data);
    } catch (err) {
      console.warn('Spectrum extraction error:', err);
    } finally {
      setLoadingSpectrum(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-space-darkest text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Search & Preset Navigation Bar */}
      <SearchBar
        presets={presets}
        onSelectPreset={handleSelectPreset}
        onSearch={handleSearch}
        loading={loadingCutouts}
        fovDeg={fovParam}
        onFovChange={(newFov) => updateUrlParams({ fov: newFov })}
        stretch={stretchParam}
        onStretchChange={(newStretch) => updateUrlParams({ stretch: newStretch })}
        collection={collection}
        onCollectionChange={(col) => setCollection(col)}
        includeDeep={includeDeep}
        onIncludeDeepChange={(deep) => setIncludeDeep(deep)}
      />

      {/* Main Observatory Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-5 space-y-4">
        {/* Error Alert if any */}
        {errorMsg && (
          <div className="bg-red-950/80 border border-red-500/80 text-red-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => fetchData(raParam, decParam, fovParam, stretchParam, collection)}
              className="px-2.5 py-1 bg-red-800 hover:bg-red-700 rounded text-white flex items-center gap-1 font-mono text-[11px]"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Viewport Split Grid: Canvas Blinker (Left) + Aladin Context (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* WiseView Time-Series Blinker Canvas */}
          <div className={`${showAladinSplit ? 'lg:col-span-8' : 'lg:col-span-12'} transition-all`}>
            <SkyBlinkerCanvas
              cutouts={cutouts}
              overlays={overlays}
              fps={fpsParam}
              onFpsChange={(newFps) => updateUrlParams({ fps: newFps })}
              displayMode={modeParam}
              onDisplayModeChange={(newMode) => updateUrlParams({ mode: newMode })}
              selectedBand={selectedBand}
              onSelectedBandChange={(b) => setSelectedBand(b)}
              onSelectCoordinateForSpectrum={(px, py, ra, dec) => fetchSpectrum(px, py, ra, dec)}
              activeTargetName={targetNameParam}
            />
          </div>

          {/* Aladin Lite v3 Context Split Panel */}
          {showAladinSplit && (
            <div className="lg:col-span-4 h-full flex flex-col space-y-3">
              <div className="flex-1 min-h-[360px]">
                <AladinContextView ra={raParam} dec={decParam} fovDeg={fovParam} />
              </div>

              {/* Target Quick Info Card */}
              <div className="bg-space-panel border border-space-border rounded-xl p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Orbit className="w-3.5 h-3.5 text-cyan-400" />
                    Target Telemetry
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-space-darkest text-cyan-300 border border-cyan-900">
                    {targetIdParam.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 bg-space-darkest/70 p-2 rounded-lg border border-space-border/60">
                  <div>RA: {raParam.toFixed(5)}°</div>
                  <div>Dec: {decParam.toFixed(5)}°</div>
                  <div>FOV: {(fovParam * 60).toFixed(1)} arcmin</div>
                  <div>Epochs: {cutouts?.epochs.length || 0} Frames</div>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {presets.find((p) => p.id === targetIdParam)?.description ||
                    'SPHEREx 102-band linear variable filter survey coverage.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Aladin Toggle Pill */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowAladinSplit(!showAladinSplit)}
            className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors font-mono"
          >
            {showAladinSplit ? (
              <>
                <PanelRightClose className="w-3.5 h-3.5" />
                <span>Hide Aladin Lite Context View</span>
              </>
            ) : (
              <>
                <PanelRightOpen className="w-3.5 h-3.5" />
                <span>Show Aladin Lite Context View</span>
              </>
            )}
          </button>
        </div>

        {/* 102-Band SPHEREx Interactive Spectrum Drawer */}
        {(spectrum || loadingSpectrum) && (
          <div className="animate-fadeIn">
            <SpectrumPlot
              spectrum={spectrum}
              loading={loadingSpectrum}
              onClose={() => setSpectrum(null)}
            />
          </div>
        )}
      </main>

      {/* Public-Facing Scientific Footer */}
      <footer className="mt-auto bg-space-panel/90 border-t border-space-border/80 px-4 py-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-slate-300">NASA SPHEREx SIA2 Online</span>
            </div>
            <span>•</span>
            <span>ESA Gaia DR3</span>
            <span>•</span>
            <span>NASA AllWISE</span>
            <span>•</span>
            <span>CSA NEOSSat / CADC</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInfoModal(true)}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Data Sources & Mission Attributions</span>
            </button>
            <span>•</span>
            <span className="text-slate-500 font-medium">Sol-9 • NASA Space Apps Challenge</span>
          </div>
        </div>
      </footer>

      {/* Attribution & Mission Modal */}
      <DataAttributionModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />
    </div>
  );
};

export default App;
