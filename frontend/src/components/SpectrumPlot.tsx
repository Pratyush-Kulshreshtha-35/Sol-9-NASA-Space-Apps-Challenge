import React, { useEffect, useRef } from 'react';
import { Download, Sparkles, X, Activity, Atom, Info } from 'lucide-react';
import { SpectrumResponse } from '../types/astronomy';

interface SpectrumPlotProps {
  spectrum: SpectrumResponse | null;
  loading: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    Plotly?: any;
  }
}

export const SpectrumPlot: React.FC<SpectrumPlotProps> = ({ spectrum, loading, onClose }) => {
  const plotContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!spectrum || !plotContainerRef.current || !window.Plotly) return;

    // Build Plotly data traces
    const trace = {
      x: spectrum.wavelengths_um,
      y: spectrum.fluxes_mjy,
      error_y: {
        type: 'data',
        array: spectrum.flux_errors,
        visible: true,
        color: 'rgba(6, 182, 212, 0.4)',
        thickness: 1.0,
      },
      mode: 'lines+markers',
      type: 'scatter',
      name: 'SPHEREx Flux (mJy)',
      line: {
        color: '#06B6D4', // Cyan
        width: 2.0,
        shape: 'spline',
      },
      marker: {
        color: '#F59E0B', // Amber markers
        size: 5,
      },
      hovertemplate: '<b>%{x:.3f} µm</b><br>Flux: %{y:.4f} mJy<br>Band: Channel %{text}<extra></extra>',
      text: spectrum.band_ids,
    };

    // Build shaded molecular absorption bands
    const shapes = (spectrum.molecular_features || []).map((feat) => {
      let fillColor = 'rgba(59, 130, 246, 0.12)'; // default blue
      if (feat.molecule.includes('CH4')) fillColor = 'rgba(234, 179, 8, 0.14)'; // Amber for Methane
      if (feat.molecule.includes('CO2')) fillColor = 'rgba(239, 68, 68, 0.14)'; // Red for CO2
      if (feat.molecule.includes('CO (')) fillColor = 'rgba(168, 85, 247, 0.14)'; // Purple for CO

      return {
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: feat.range[0],
        x1: feat.range[1],
        y0: 0,
        y1: 1,
        fillcolor: fillColor,
        line: { width: 0 },
        layer: 'below',
      };
    });

    // Annotations for key molecular lines
    const annotations = (spectrum.molecular_features || []).map((feat) => ({
      x: feat.wavelength_um,
      y: 0.95,
      yref: 'paper',
      text: feat.molecule.split(' ')[0], // short molecule label
      showarrow: false,
      font: {
        family: 'monospace',
        size: 9,
        color: '#94A3B8',
      },
      textangle: -90,
    }));

    const layout = {
      paper_bgcolor: '#0D1322',
      plot_bgcolor: '#090D16',
      margin: { l: 55, r: 25, t: 30, b: 45 },
      font: {
        family: 'monospace',
        color: '#94A3B8',
        size: 11,
      },
      xaxis: {
        title: { text: 'Wavelength (µm)', font: { size: 12, color: '#E2E8F0' } },
        range: [0.70, 5.05],
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
        tickmode: 'linear',
        dtick: 0.5,
      },
      yaxis: {
        title: { text: 'Flux Density (mJy)', font: { size: 12, color: '#E2E8F0' } },
        gridcolor: '#1E293B',
        zerolinecolor: '#334155',
        autorange: true,
      },
      shapes,
      annotations,
      hovermode: 'closest',
      showlegend: false,
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    };

    window.Plotly.newPlot(plotContainerRef.current, [trace], layout, config);
  }, [spectrum]);

  const handleExportCSV = () => {
    if (!spectrum) return;
    const headers = 'Wavelength_um,Flux_mJy,Flux_Error_mJy,Channel_ID,Detector_Band\n';
    const rows = spectrum.wavelengths_um
      .map(
        (w, i) =>
          `${w},${spectrum.fluxes_mjy[i]},${spectrum.flux_errors[i]},${spectrum.band_ids[i]},${spectrum.detector_bands[i]}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPHEREx_spectrum_${spectrum.target.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!spectrum) return;
    const blob = new Blob([JSON.stringify(spectrum, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPHEREx_spectrum_${spectrum.target.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    if (!spectrum || !plotContainerRef.current || !window.Plotly) return;
    const safeTarget = (spectrum.target || 'target').replace(/[^a-zA-Z0-9]/g, '_');
    window.Plotly.downloadImage(plotContainerRef.current, {
      format: 'png',
      width: 1200,
      height: 600,
      filename: `SPHEREx_spectrum_${safeTarget}`,
    });
  };

  if (!spectrum && !loading) return null;

  return (
    <div className="bg-space-dark border border-space-border rounded-xl shadow-2xl p-4 space-y-3">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-space-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <span>102-Band SPHEREx Near-IR Spectrum (0.75–5.0 µm)</span>
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
                100 Active Channels
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Target: {spectrum?.target || 'Calculating Aperture Photometry...'} • RA: {spectrum?.sky_coords.ra.toFixed(5)}°, Dec: {spectrum?.sky_coords.dec.toFixed(5)}°
            </p>
          </div>
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={!spectrum}
            className="px-2.5 py-1 rounded bg-space-panel border border-space-border text-slate-300 hover:text-white hover:border-slate-500 text-xs font-mono flex items-center gap-1 transition-all"
            title="Export Spectrum as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            disabled={!spectrum}
            className="px-2.5 py-1 rounded bg-space-panel border border-space-border text-slate-300 hover:text-white hover:border-slate-500 text-xs font-mono flex items-center gap-1 transition-all"
            title="Export Spectrum as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            onClick={handleExportPNG}
            disabled={!spectrum}
            className="px-2.5 py-1 rounded bg-space-panel border border-space-border text-slate-300 hover:text-white hover:border-slate-500 text-xs font-mono flex items-center gap-1 transition-all"
            title="Export Spectrum Chart as High-Res PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white transition-all ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Classification & Physical Interpretation Banner */}
      {spectrum && (
        <div className="bg-space-darkest/90 border border-cyan-800/40 rounded-lg p-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-300 flex items-center gap-1">
              <Atom className="w-3.5 h-3.5" />
              Classification:
            </span>
            <span className="font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
              {spectrum.classification}
            </span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {spectrum.classification_notes}
          </p>
        </div>
      )}

      {/* Molecular Features Key Legend */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400 px-1">
        <span className="text-slate-500 font-sans">Molecular Diagnostics:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-blue-500/30 border border-blue-500" />
          H₂O (1.15, 1.40, 1.88, 2.7 µm)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-amber-500/30 border border-amber-500" />
          CH₄ Methane (1.66, 2.20, 3.31 µm)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-purple-500/30 border border-purple-500" />
          CO (2.32, 4.67 µm)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-red-500/30 border border-red-500" />
          CO₂ (4.26 µm)
        </span>
      </div>

      {/* Plotly Container */}
      <div className="relative w-full h-72 md:h-80 bg-space-darkest rounded-lg overflow-hidden border border-space-border/60">
        {loading && (
          <div className="absolute inset-0 bg-space-darkest/80 flex flex-col items-center justify-center gap-2 z-10">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-cyan-300">
              Running Circular Aperture Photometry across 102 channels...
            </span>
          </div>
        )}
        <div ref={plotContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
