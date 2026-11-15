import React from 'react';
import { ExternalLink, X, BookOpen, Database, Sparkles, Orbit, Telescope, Award } from 'lucide-react';

interface DataAttributionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataAttributionModal: React.FC<DataAttributionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-space-dark border border-space-border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl p-6 space-y-5 text-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-space-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white">
              <Orbit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Mission Telemetry & Data Attributions</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                  NASA Space Apps 2024
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Official Challenge: "Planet X and SPHEREx"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-space-panel transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mission Briefing */}
        <div className="space-y-2 text-xs leading-relaxed text-slate-300 bg-space-darkest/70 p-3.5 rounded-xl border border-space-border">
          <p className="font-semibold text-cyan-300 flex items-center gap-1.5">
            <Telescope className="w-4 h-4" />
            NASA SPHEREx Mission & Planet X Search Overview
          </p>
          <p>
            NASA’s Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx) is an all-sky survey satellite equipped with 6 linear variable filter detector arrays capturing 102 spectral channels between 0.75 and 5.0 µm.
          </p>
          <p>
            Sol-9 enables astronomers and citizen scientists to align multi-epoch SPHEREx Simple Image Access v2 (SIA2) cutouts, blink time-series imagery (inspired by WiseView), execute on-the-fly circular aperture photometry, and cross-match candidates against ESA Gaia DR3 proper motions, NASA AllWISE baselines, and CSA NEOSSat asteroid detections.
          </p>
        </div>

        {/* Official Resources & Endpoints */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-amber-400" />
            Official Mission Portals & Datasets
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            <a
              href="https://irsa.ipac.caltech.edu/Missions/spherex.html"
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-lg bg-space-panel hover:bg-space-darkest border border-space-border hover:border-cyan-500 transition-all flex items-start justify-between group"
            >
              <div>
                <p className="font-semibold text-slate-100 group-hover:text-cyan-400">NASA/IPAC IRSA SPHEREx</p>
                <p className="text-[11px] text-slate-400">Mission portal, SIA2 cutouts & calibration</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 shrink-0" />
            </a>

            <a
              href="https://caltech-ipac.github.io/irsa-tutorials/spherex/"
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-lg bg-space-panel hover:bg-space-darkest border border-space-border hover:border-cyan-500 transition-all flex items-start justify-between group"
            >
              <div>
                <p className="font-semibold text-slate-100 group-hover:text-cyan-400">SPHEREx Python Tutorials</p>
                <p className="text-[11px] text-slate-400">Official IRSA tutorial notebooks & SIA2 APIs</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 shrink-0" />
            </a>

            <a
              href="http://byw.tools/wiseview"
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-lg bg-space-panel hover:bg-space-darkest border border-space-border hover:border-amber-500 transition-all flex items-start justify-between group"
            >
              <div>
                <p className="font-semibold text-slate-100 group-hover:text-amber-400">WiseView Tool (Dan Caselden)</p>
                <p className="text-[11px] text-slate-400">Backyard Worlds blinking UX inspiration</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-amber-400 shrink-0" />
            </a>

            <a
              href="https://archive.stsci.edu/missions-and-data/gaia"
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-lg bg-space-panel hover:bg-space-darkest border border-space-border hover:border-cyan-500 transition-all flex items-start justify-between group"
            >
              <div>
                <p className="font-semibold text-slate-100 group-hover:text-cyan-400">ESA Gaia DR3 (MAST/STScI)</p>
                <p className="text-[11px] text-slate-400">Proper motions, parallax & G-band photometry</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 shrink-0" />
            </a>

            <a
              href="https://www.asc-csa.gc.ca/eng/satellites/neossat/"
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-lg bg-space-panel hover:bg-space-darkest border border-space-border hover:border-emerald-500 transition-all flex items-start justify-between group"
            >
              <div>
                <p className="font-semibold text-slate-100 group-hover:text-emerald-400">CSA NEOSSat Satellite</p>
                <p className="text-[11px] text-slate-400">Near-Earth Asteroid Surveillance Mission</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0" />
            </a>

            <a
              href="https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/"
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-lg bg-space-panel hover:bg-space-darkest border border-space-border hover:border-emerald-500 transition-all flex items-start justify-between group"
            >
              <div>
                <p className="font-semibold text-slate-100 group-hover:text-emerald-400">CADC Astronomy Centre</p>
                <p className="text-[11px] text-slate-400">Canadian Astronomy Data Centre TAP archive</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0" />
            </a>

            <a
              href="https://github.com/asc-csa/NEOSSAT_Tutorial"
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-lg bg-space-panel hover:bg-space-darkest border border-space-border hover:border-emerald-500 transition-all flex items-start justify-between group"
            >
              <div>
                <p className="font-semibold text-slate-100 group-hover:text-emerald-400">CSA NEOSSat Python Tutorial</p>
                <p className="text-[11px] text-slate-400">Official CADC search and image analysis code</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0" />
            </a>

            <a
              href="https://data.asc-csa.gc.ca/dataset/neossat"
              target="_blank"
              rel="noreferrer"
              className="p-3 rounded-lg bg-space-panel hover:bg-space-darkest border border-space-border hover:border-emerald-500 transition-all flex items-start justify-between group"
            >
              <div>
                <p className="font-semibold text-slate-100 group-hover:text-emerald-400">CSA NEOSSat Open Dataset</p>
                <p className="text-[11px] text-slate-400">Government of Canada Open Science Data</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0" />
            </a>
          </div>
        </div>

        {/* Challenge Footer Note */}
        <div className="pt-2 border-t border-space-border flex items-center justify-between text-xs text-slate-400">
          <span>Developed for NASA Space Apps Challenge</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
