import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Crosshair, Layers, Eye, ShieldAlert, Sparkles } from 'lucide-react';
import { CutoutsResponse, OverlayResponse, GaiaStar, AllWiseSource } from '../types/astronomy';

interface SkyBlinkerCanvasProps {
  cutouts: CutoutsResponse | null;
  overlays: OverlayResponse | null;
  fps: number;
  onFpsChange: (fps: number) => void;
  displayMode: 'sequence' | 'coadded' | 'difference' | 'rgb' | 'band';
  onDisplayModeChange: (mode: 'sequence' | 'coadded' | 'difference' | 'rgb' | 'band') => void;
  selectedBand: number;
  onSelectedBandChange: (b: number) => void;
  onSelectCoordinateForSpectrum: (pixelX: number, pixelY: number, ra: number, dec: number) => void;
  activeTargetName?: string;
}

export const SkyBlinkerCanvas: React.FC<SkyBlinkerCanvasProps> = ({
  cutouts,
  overlays,
  fps,
  onFpsChange,
  displayMode,
  onDisplayModeChange,
  selectedBand,
  onSelectedBandChange,
  onSelectCoordinateForSpectrum,
  activeTargetName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animation state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentEpochIdx, setCurrentEpochIdx] = useState<number>(0);

  // Canvas View Transform (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reticle / Cursor Telemetry
  const [hoverCoords, setHoverCoords] = useState<{
    pixelX: number;
    pixelY: number;
    ra: number;
    dec: number;
  } | null>(null);

  // Overlay Toggles
  const [showGaia, setShowGaia] = useState<boolean>(true);
  const [showAllWise, setShowAllWise] = useState<boolean>(true);
  const [showNeossat, setShowNeossat] = useState<boolean>(true);
  const [showReticle, setShowReticle] = useState<boolean>(true);

  // Preloaded HTML Image objects for high-fps canvas blinking
  const epochImagesRef = useRef<HTMLImageElement[]>([]);
  const diffImagesRef = useRef<HTMLImageElement[]>([]);
  const refStackImageRef = useRef<HTMLImageElement | null>(null);
  const rgbImageRef = useRef<HTMLImageElement | null>(null);
  const bandImagesRef = useRef<Record<string, HTMLImageElement>>({});

  // Preload base64 images into Image objects
  useEffect(() => {
    if (!cutouts) return;

    epochImagesRef.current = cutouts.epochs.map((ep) => {
      const img = new Image();
      img.src = ep.image_b64;
      return img;
    });

    diffImagesRef.current = cutouts.difference_frames.map((df) => {
      const img = new Image();
      img.src = df.image_b64;
      return img;
    });

    if (cutouts.reference_stack) {
      const img = new Image();
      img.src = cutouts.reference_stack;
      refStackImageRef.current = img;
    }

    if (cutouts.rgb_composite) {
      const img = new Image();
      img.src = cutouts.rgb_composite;
      rgbImageRef.current = img;
    }

    bandImagesRef.current = {};
    if (cutouts.band_stacks) {
      Object.entries(cutouts.band_stacks).forEach(([k, b64]) => {
        const img = new Image();
        img.src = b64;
        bandImagesRef.current[k] = img;
      });
    }

    setCurrentEpochIdx(0);
  }, [cutouts]);

  // Animation Loop for Time-Series Blinking
  useEffect(() => {
    if (!isPlaying || !cutouts || cutouts.epochs.length <= 1) return;
    if (displayMode === 'coadded' || displayMode === 'rgb') return;

    const intervalMs = 1000 / Math.max(1, fps);
    const timer = setInterval(() => {
      setCurrentEpochIdx((prev) => (prev + 1) % cutouts.epochs.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, fps, cutouts, displayMode]);

  // Coordinate Conversion: (pixelX, pixelY) on canvas image -> Sky (RA, Dec)
  const pixelToSky = useCallback(
    (px: number, py: number) => {
      if (!cutouts || !cutouts.wcs) return { ra: 0, dec: 0 };
      const { crval, crpix, cdelt } = cutouts.wcs;
      const dX = px - crpix[0];
      const dY = py - crpix[1];
      const ra = crval[0] + dX * cdelt[0];
      const dec = crval[1] + dY * cdelt[1];
      return { ra, dec };
    },
    [cutouts]
  );

  // Sky (RA, Dec) -> Image Pixel Coordinates
  const skyToPixel = useCallback(
    (ra: number, dec: number) => {
      if (!cutouts || !cutouts.wcs) return { x: 0, y: 0 };
      const { crval, crpix, cdelt } = cutouts.wcs;
      const dRa = ra - crval[0];
      const dDec = dec - crval[1];
      const px = crpix[0] + dRa / cdelt[0];
      const py = crpix[1] + dDec / cdelt[1];
      return { x: px, y: py };
    },
    [cutouts]
  );

  // Render Canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    // Determine current image to draw
    let activeImg: HTMLImageElement | null = null;
    if (displayMode === 'sequence') {
      activeImg = epochImagesRef.current[currentEpochIdx] || null;
    } else if (displayMode === 'difference') {
      activeImg = diffImagesRef.current[currentEpochIdx] || null;
    } else if (displayMode === 'coadded') {
      activeImg = refStackImageRef.current;
    } else if (displayMode === 'rgb') {
      activeImg = rgbImageRef.current;
    } else if (displayMode === 'band') {
      activeImg = bandImagesRef.current[`band_${selectedBand}`] || refStackImageRef.current;
    }

    if (!activeImg || !cutouts) {
      // Loading placeholder
      ctx.fillStyle = '#475569';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Retrieving & Reprojecting SPHEREx Cutouts...', width / 2, height / 2);
      return;
    }

    ctx.save();

    // Apply Pan & Zoom relative to center
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

    // Disable smoothing for sharp astronomical pixel view
    ctx.imageSmoothingEnabled = false;

    // Draw main celestial frame
    ctx.drawImage(activeImg, 0, 0, width, height);

    const imageDim = cutouts.wcs ? cutouts.wcs.dim : 256;
    const scaleFactor = width / imageDim;

    // 1. Draw Gaia DR3 Proper Motion Overlays
    if (showGaia && overlays && overlays.gaia_dr3) {
      overlays.gaia_dr3.forEach((star) => {
        const p = skyToPixel(star.ra, star.dec);
        const sx = p.x * scaleFactor;
        const sy = p.y * scaleFactor;

        if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) return;

        // Proper motion velocity vector (mas/yr -> pixels)
        // Draw arrow showing where the star will move in 20 years
        const dtYears = 20.0;
        const cosDec = Math.max(0.1, Math.cos((star.dec * Math.PI) / 180));
        const dRaDeg = ((star.pmra * 1e-3) / 3600.0) / cosDec * dtYears;
        const dDecDeg = ((star.pmdec * 1e-3) / 3600.0) * dtYears;
        const pFuture = skyToPixel(star.ra + dRaDeg, star.dec + dDecDeg);
        const fx = pFuture.x * scaleFactor;
        const fy = pFuture.y * scaleFactor;

        // Target circle
        const radius = Math.max(3, Math.min(8, 20.0 - star.phot_g_mean_mag));
        ctx.strokeStyle = '#06B6D4'; // Cyan
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // Velocity arrow if high proper motion (> 50 mas/yr)
        const pmTotal = Math.sqrt(star.pmra * star.pmra + star.pmdec * star.pmdec);
        if (pmTotal > 30) {
          ctx.strokeStyle = '#F59E0B'; // Amber arrow
          ctx.fillStyle = '#F59E0B';
          ctx.lineWidth = 1.5 / zoom;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(fx, fy);
          ctx.stroke();

          // Arrowhead
          const angle = Math.atan2(fy - sy, fx - sx);
          const arrowLen = 5 / zoom;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(
            fx - arrowLen * Math.cos(angle - Math.PI / 6),
            fy - arrowLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            fx - arrowLen * Math.cos(angle + Math.PI / 6),
            fy - arrowLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
      });
    }

    // 2. Draw AllWISE Historical Baseline Overlays (~2010.5)
    if (showAllWise && overlays && overlays.allwise) {
      overlays.allwise.forEach((w) => {
        const p = skyToPixel(w.ra, w.dec);
        const sx = p.x * scaleFactor;
        const sy = p.y * scaleFactor;

        ctx.strokeStyle = '#A855F7'; // Purple diamond
        ctx.lineWidth = 1.0 / zoom;
        const dSize = 4 / zoom;
        ctx.beginPath();
        ctx.moveTo(sx, sy - dSize);
        ctx.lineTo(sx + dSize, sy);
        ctx.lineTo(sx, sy + dSize);
        ctx.lineTo(sx - dSize, sy);
        ctx.closePath();
        ctx.stroke();
      });
    }

    // 3. Draw CSA NEOSSat Observation Footprint
    if (showNeossat && overlays && overlays.neossat && overlays.neossat.length > 0) {
      // Draw NEOSSat search cone box
      ctx.strokeStyle = '#10B981'; // Green
      ctx.lineWidth = 1.0 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.strokeRect(width * 0.15, height * 0.15, width * 0.7, height * 0.7);
      ctx.setLineDash([]);
    }

    // 4. Crosshair Reticle on Hover
    if (showReticle && hoverCoords) {
      const rx = hoverCoords.pixelX * scaleFactor;
      const ry = hoverCoords.pixelY * scaleFactor;

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)';
      ctx.lineWidth = 1 / zoom;

      // Reticle circle with gap
      ctx.beginPath();
      ctx.arc(rx, ry, 12 / zoom, 0, 2 * Math.PI);
      ctx.stroke();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(rx - 20 / zoom, ry);
      ctx.lineTo(rx - 5 / zoom, ry);
      ctx.moveTo(rx + 5 / zoom, ry);
      ctx.lineTo(rx + 20 / zoom, ry);
      ctx.moveTo(rx, ry - 20 / zoom);
      ctx.lineTo(rx, ry - 5 / zoom);
      ctx.moveTo(rx, ry + 5 / zoom);
      ctx.lineTo(rx, ry + 20 / zoom);
      ctx.stroke();
    }

    ctx.restore();

    // 5. Compass Orientation Widget (North Up, East Left)
    const compassX = width - 40;
    const compassY = 40;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    // North arrow (Up)
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX, compassY - 24);
    ctx.stroke();
    ctx.fillText('N', compassX, compassY - 28);

    // East arrow (Left)
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(compassX - 24, compassY);
    ctx.stroke();
    ctx.fillText('E', compassX - 30, compassY + 3);

    // 6. Angular Scale Bar (1 arcminute)
    if (cutouts.wcs) {
      const pixScaleArcsec = cutouts.wcs.pixel_scale_arcsec;
      // 1 arcminute = 60 arcseconds
      const oneArcminPixels = (60.0 / pixScaleArcsec) * (width / cutouts.wcs.dim) * zoom;
      const barX = 20;
      const barY = height - 20;

      ctx.strokeStyle = '#FFFFFF';
      ctx.fillStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(barX, barY);
      ctx.lineTo(barX + oneArcminPixels, barY);
      ctx.moveTo(barX, barY - 4);
      ctx.lineTo(barX, barY + 4);
      ctx.moveTo(barX + oneArcminPixels, barY - 4);
      ctx.lineTo(barX + oneArcminPixels, barY + 4);
      ctx.stroke();

      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText("1.0' (60\")", barX, barY - 8);
    }
  }, [
    cutouts,
    overlays,
    displayMode,
    currentEpochIdx,
    selectedBand,
    zoom,
    pan,
    hoverCoords,
    showGaia,
    showAllWise,
    showNeossat,
    showReticle,
    skyToPixel,
  ]);

  // Request Animation Frame loop for buttery smooth drawing
  useEffect(() => {
    let animId: number;
    const render = () => {
      drawCanvas();
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [drawCanvas]);

  // Pan and Zoom Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !cutouts) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDraggingRef.current) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    }

    // Convert screen coordinates back to image pixel coordinates
    const imageDim = cutouts.wcs ? cutouts.wcs.dim : 256;
    const scaleFactor = canvas.width / imageDim;

    // Inverse transform
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const transX = (mouseX - (centerX + pan.x)) / zoom + centerX;
    const transY = (mouseY - (centerY + pan.y)) / zoom + centerY;

    const imgPixelX = transX / scaleFactor;
    const imgPixelY = transY / scaleFactor;

    if (imgPixelX >= 0 && imgPixelX <= imageDim && imgPixelY >= 0 && imgPixelY <= imageDim) {
      const sky = pixelToSky(imgPixelX, imgPixelY);
      setHoverCoords({
        pixelX: imgPixelX,
        pixelY: imgPixelY,
        ra: sky.ra,
        dec: sky.dec,
      });
    } else {
      setHoverCoords(null);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((prev) => Math.min(8.0, Math.max(0.5, prev * zoomFactor)));
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only trigger if not a drag action
    if (!hoverCoords) return;
    onSelectCoordinateForSpectrum(
      hoverCoords.pixelX,
      hoverCoords.pixelY,
      hoverCoords.ra,
      hoverCoords.dec
    );
  };

  const activeEpoch = cutouts?.epochs[currentEpochIdx];
  const activeDiff = cutouts?.difference_frames[currentEpochIdx];
  const contamination = activeEpoch?.contamination_flags;

  return (
    <div className="bg-space-panel border border-space-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
      {/* Canvas Header / Mode Bar */}
      <div className="bg-space-dark px-4 py-2.5 border-b border-space-border flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Display Modes */}
        <div className="flex items-center gap-1.5 bg-space-darkest/80 p-1 rounded-lg border border-space-border/80">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-1.5 flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" /> Mode:
          </span>
          <button
            onClick={() => onDisplayModeChange('sequence')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              displayMode === 'sequence'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Epoch Sequence
          </button>
          <button
            onClick={() => onDisplayModeChange('difference')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              displayMode === 'difference'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Epoch - Reference difference frame highlighting dipoles & transients"
          >
            Difference Mode
          </button>
          <button
            onClick={() => onDisplayModeChange('coadded')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              displayMode === 'coadded'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Coadded Stack
          </button>
          <button
            onClick={() => onDisplayModeChange('rgb')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              displayMode === 'rgb'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Short (B1/2), Mid (B3/4), and Long (B5/6) near-IR false color"
          >
            Detector RGB
          </button>
          <button
            onClick={() => onDisplayModeChange('band')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              displayMode === 'band'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Band 1–6
          </button>
        </div>

        {/* Detector Band Selector (when mode === 'band') */}
        {displayMode === 'band' && (
          <div className="flex items-center gap-1 bg-space-darkest/90 px-2 py-1 rounded-lg border border-space-border text-xs">
            <span className="text-slate-400">Detector Array:</span>
            {[1, 2, 3, 4, 5, 6].map((b) => (
              <button
                key={b}
                onClick={() => onSelectedBandChange(b)}
                className={`w-6 h-6 rounded font-mono font-bold text-xs ${
                  selectedBand === b
                    ? 'bg-emerald-600 text-white'
                    : 'bg-space-panel text-slate-400 hover:text-white'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}

        {/* Multi-Mission Overlay Toggles */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 hidden sm:inline">Overlays:</span>
          <button
            onClick={() => setShowGaia(!showGaia)}
            className={`px-2 py-1 rounded border text-[11px] font-mono flex items-center gap-1 transition-all ${
              showGaia
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                : 'bg-space-darkest border-space-border text-slate-400 hover:text-white'
            }`}
            title="Gaia DR3 proper motion velocity vectors & magnitudes"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Gaia DR3</span>
          </button>

          <button
            onClick={() => setShowAllWise(!showAllWise)}
            className={`px-2 py-1 rounded border text-[11px] font-mono flex items-center gap-1 transition-all ${
              showAllWise
                ? 'bg-purple-950/80 border-purple-500 text-purple-300'
                : 'bg-space-darkest border-space-border text-slate-400 hover:text-white'
            }`}
            title="AllWISE baseline positions (2010.5)"
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>AllWISE</span>
          </button>

          <button
            onClick={() => setShowNeossat(!showNeossat)}
            className={`px-2 py-1 rounded border text-[11px] font-mono flex items-center gap-1 transition-all ${
              showNeossat
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                : 'bg-space-darkest border-space-border text-slate-400 hover:text-white'
            }`}
            title="CSA NEOSSat Near-Earth Asteroid / NEO footprints"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>NEOSSat</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="relative w-full aspect-square md:aspect-[4/3] bg-space-darkest flex items-center justify-center overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleClick}
          className="w-full h-full object-contain"
        />

        {/* Top-Left Telemetry Badge: Active Epoch & Timestamp */}
        {activeEpoch && (
          <div className="absolute top-3 left-3 bg-space-darkest/90 border border-space-border/90 backdrop-blur-md rounded-lg p-2.5 text-xs font-mono space-y-1 shadow-lg pointer-events-none select-none">
            <div className="flex items-center gap-2">
              <span className="font-bold text-cyan-400">
                Epoch {activeEpoch.epoch_id} / {cutouts?.epochs.length}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-space-panel text-slate-300">
                {activeEpoch.date_obs.replace('T', ' ')}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-3">
              <span>MJD: {activeEpoch.mjd_obs.toFixed(2)}</span>
              <span>Band: {activeEpoch.detector_band} ({activeEpoch.wavelength_um} µm)</span>
            </div>

            {/* Contamination Flags Badge */}
            {contamination && (
              <div className="flex items-center gap-2 text-[10px] pt-1 border-t border-space-border/60">
                <span className={`flex items-center gap-1 ${contamination.cosmic_ray_hits > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  CR Hits: {contamination.cosmic_ray_hits}
                </span>
                {contamination.stray_light_warning && (
                  <span className="text-red-400 font-bold flex items-center gap-0.5">
                    <ShieldAlert className="w-3 h-3" /> Stray Light
                  </span>
                )}
                {contamination.saturation_warning && (
                  <span className="text-red-400 font-bold">SAT</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Top-Right Quick Instruction Pill & Spectrum Trigger */}
        <button
          onClick={() => onSelectCoordinateForSpectrum(128, 128, cutouts?.center.ra || 0, cutouts?.center.dec || 0)}
          className="absolute top-3 right-14 bg-space-darkest/90 hover:bg-cyan-950/90 border border-cyan-500/60 hover:border-cyan-400 rounded-full px-3 py-1 text-[10px] text-cyan-200 font-medium flex items-center gap-1.5 shadow-lg transition-all cursor-pointer z-20 group"
          title="Click to view 102-band infrared spectrum for target"
        >
          <Sparkles className="w-3 h-3 text-amber-300 group-hover:animate-spin" />
          <span>Click any star (or click here) for 102-Band Spectrum</span>
        </button>

        {/* Bottom Floating Reticle Telemetry Widget */}
        {hoverCoords && (
          <div className="absolute bottom-3 left-3 bg-space-darkest/90 border border-cyan-500/40 rounded-lg px-3 py-1.5 text-[11px] font-mono text-cyan-300 shadow-xl pointer-events-none flex items-center gap-3">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>RA: {hoverCoords.ra.toFixed(5)}°</span>
            <span>Dec: {hoverCoords.dec.toFixed(5)}°</span>
            <span className="text-slate-400 text-[10px]">
              (Pixel: {Math.round(hoverCoords.pixelX)}, {Math.round(hoverCoords.pixelY)})
            </span>
          </div>
        )}

        {/* Right Floating Canvas Pan/Zoom Controls */}
        <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 bg-space-darkest/90 p-1.5 rounded-lg border border-space-border shadow-xl">
          <button
            onClick={() => setZoom((z) => Math.min(8.0, z * 1.25))}
            className="p-1.5 rounded bg-space-panel text-slate-300 hover:text-white hover:bg-space-border transition-all"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z * 0.8))}
            className="p-1.5 rounded bg-space-panel text-slate-300 hover:text-white hover:bg-space-border transition-all"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1.0);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 rounded bg-space-panel text-slate-300 hover:text-white hover:bg-space-border transition-all"
            title="Reset Pan & Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Playback & Blinker Timeline Controls */}
      <div className="bg-space-dark px-4 py-3 border-t border-space-border space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Stepper Buttons & Play/Pause */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (!cutouts) return;
                setIsPlaying(false);
                setCurrentEpochIdx((prev) => (prev - 1 + cutouts.epochs.length) % cutouts.epochs.length);
              }}
              className="p-1.5 rounded-md bg-space-panel border border-space-border text-slate-300 hover:text-white hover:border-slate-500 transition-all"
              title="Previous Epoch Frame"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5 transition-all shadow-md"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Blink</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                if (!cutouts) return;
                setIsPlaying(false);
                setCurrentEpochIdx((prev) => (prev + 1) % cutouts.epochs.length);
              }}
              className="p-1.5 rounded-md bg-space-panel border border-space-border text-slate-300 hover:text-white hover:border-slate-500 transition-all"
              title="Next Epoch Frame"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline Scrubber */}
          <div className="flex-1 max-w-md flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono">Epoch:</span>
            <input
              type="range"
              min="0"
              max={cutouts ? Math.max(0, cutouts.epochs.length - 1) : 0}
              value={currentEpochIdx}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentEpochIdx(parseInt(e.target.value, 10));
              }}
              className="w-full accent-cyan-400 bg-space-panel cursor-pointer"
            />
            <span className="font-mono text-cyan-300 font-bold text-xs min-w-[28px]">
              {currentEpochIdx + 1}/{cutouts?.epochs.length || 1}
            </span>
          </div>

          {/* FPS Speed Slider */}
          <div className="flex items-center gap-2 bg-space-panel px-3 py-1 rounded-lg border border-space-border">
            <span className="text-slate-400 font-mono text-[11px]">Speed:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={fps}
              onChange={(e) => onFpsChange(parseInt(e.target.value, 10))}
              className="w-20 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono text-cyan-300 font-bold text-xs min-w-[36px]">
              {fps} FPS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
