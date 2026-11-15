import React, { useEffect, useRef, useState } from 'react';
import { Globe, Layers, Maximize2, Minimize2, ExternalLink } from 'lucide-react';

interface AladinContextViewProps {
  ra: number;
  dec: number;
  fovDeg: number;
}

declare global {
  interface Window {
    A?: any;
  }
}

export const AladinContextView: React.FC<AladinContextViewProps> = ({ ra, dec, fovDeg }) => {
  const aladinContainerRef = useRef<HTMLDivElement | null>(null);
  const aladinInstanceRef = useRef<any>(null);
  const [survey, setSurvey] = useState<string>('P/DSS2/color');
  const [isReady, setIsReady] = useState<boolean>(false);

  // Initialize Aladin Lite v3 WebAssembly
  useEffect(() => {
    let isMounted = true;

    const initAladin = async () => {
      if (!window.A || !aladinContainerRef.current) return;

      try {
        if (window.A.init) {
          await window.A.init;
        }

        if (!aladinInstanceRef.current && aladinContainerRef.current) {
          // Initialize instance
          aladinInstanceRef.current = window.A.aladin(aladinContainerRef.current, {
            survey: 'P/DSS2/color',
            fov: Math.max(0.05, fovDeg * 3.5), // show slightly wider field for context
            target: `${ra} ${dec}`,
            cooFrame: 'ICRS',
            showReticle: true,
            showZoomControl: true,
            showFullscreenControl: false,
            showLayersControl: true,
            showGotoControl: false,
          });

          if (isMounted) setIsReady(true);
        }
      } catch (e) {
        console.warn('Aladin Lite init notice:', e);
      }
    };

    initAladin();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update Aladin view when (ra, dec, fovDeg) change
  useEffect(() => {
    if (!aladinInstanceRef.current) return;
    try {
      aladinInstanceRef.current.gotoRaDec(ra, dec);
      aladinInstanceRef.current.setFov(Math.max(0.05, fovDeg * 3.5));
    } catch (e) {
      console.warn('Aladin goto error:', e);
    }
  }, [ra, dec, fovDeg]);

  // Handle survey change
  const handleSurveyChange = (newSurvey: string) => {
    setSurvey(newSurvey);
    if (aladinInstanceRef.current) {
      try {
        aladinInstanceRef.current.setImageSurvey(newSurvey);
      } catch (e) {
        console.warn('Survey change error:', e);
      }
    }
  };

  return (
    <div className="bg-space-panel border border-space-border rounded-xl shadow-2xl overflow-hidden flex flex-col h-full">
      {/* Header Bar */}
      <div className="bg-space-dark px-3 py-2 border-b border-space-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-200">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>Aladin Lite v3 Sky Context</span>
        </div>

        {/* Survey Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 hidden sm:inline">Survey:</span>
          <select
            value={survey}
            onChange={(e) => handleSurveyChange(e.target.value)}
            className="bg-space-darkest border border-space-border rounded px-2 py-0.5 text-slate-300 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
          >
            <option value="P/DSS2/color">DSS2 Color (Optical)</option>
            <option value="P/2MASS/color">2MASS Color (Near-IR JHK)</option>
            <option value="P/allWISE/color">AllWISE Color (Mid-IR)</option>
            <option value="P/PanSTARRS/DR1/color-z-zg-g">Pan-STARRS DR1</option>
          </select>
        </div>
      </div>

      {/* Aladin Div Container */}
      <div className="relative flex-1 min-h-[300px] w-full bg-space-darkest">
        <div
          ref={aladinContainerRef}
          className="w-full h-full min-h-[300px]"
          id="aladin-lite-div"
        />

        {/* Top-Right Info Badge */}
        <div className="absolute top-2 right-2 bg-space-darkest/90 border border-space-border/80 rounded px-2 py-1 text-[10px] font-mono text-slate-300 shadow pointer-events-none">
          RA: {ra.toFixed(4)}° • Dec: {dec.toFixed(4)}°
        </div>
      </div>
    </div>
  );
};
