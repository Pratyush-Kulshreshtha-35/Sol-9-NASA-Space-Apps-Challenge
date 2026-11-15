import os
import certifi
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()

from typing import Optional, List
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.spherex_service import SpherexService, PRESETS
from services.image_processor import ImageProcessor
from services.spectrum_service import SpectrumService
from services.catalog_service import CatalogService

app = FastAPI(
    title="Sol-9: SPHEREx & Planet X Explorer API",
    description="High-performance astronomical time-series blinking, 102-band IR spectroscopy, and multi-mission overlay backend for NASA Space Apps Challenge.",
    version="1.0.0"
)

# Enable CORS for local Vite dev server and web deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import threading

spherex_service = SpherexService()
image_processor = ImageProcessor(output_dim=256)
spectrum_service = SpectrumService()
catalog_service = CatalogService()

# Pre-warm all challenge presets in background so all preset views open with 0 latency
threading.Thread(target=lambda: catalog_service.warm_presets(PRESETS), daemon=True).start()

class SpectrumRequest(BaseModel):
    ra: float
    dec: float
    pixel_x: float
    pixel_y: float
    fov: float
    target_name: Optional[str] = None

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "spherex-backend",
        "missions": ["NASA SPHEREx", "ESA Gaia DR3", "NASA AllWISE", "CSA NEOSSat"]
    }

@app.get("/api/presets")
def get_presets():
    """
    Return challenge target presets with rich astronomical telemetry.
    """
    return PRESETS

@app.get("/api/resolve")
def resolve_target(name: str = Query(..., description="Target name or coordinates")):
    """
    Resolve target name (e.g. 'Barnard's Star', 'WISE 0855') or coordinates.
    """
    ra, dec, display_name = spherex_service.resolve_target(name)
    return {
        "query": name,
        "ra": round(ra, 6),
        "dec": round(dec, 6),
        "display_name": display_name
    }

@app.get("/api/cutouts")
def get_cutouts(
    ra: float = Query(..., description="Right Ascension in decimal degrees"),
    dec: float = Query(..., description="Declination in decimal degrees"),
    fov: float = Query(0.08, description="Field of view in decimal degrees (e.g. 0.08 = 4.8 arcmin)"),
    stretch: str = Query("asinh", description="Stretch mode: asinh, log, or linear"),
    collection: str = Query("spherex_dr1", description="SIA2 collection (spherex_dr1, spherex_qr3)"),
    include_deep: bool = Query(True, description="Include deep coadded stack")
):
    """
    Retrieve WCS-aligned SPHEREx multi-epoch image cutouts, reference stack,
    difference frames (Epoch - Reference), and detector array band stacks.
    """
    # 1. Fetch raw multi-epoch MEF cutouts from IRSA SIA2 or synthetic fallback
    raw_frames = spherex_service.query_cutouts(ra, dec, fov, collection, include_deep)

    # 2. Build common master target WCS (North-up, East-left)
    target_wcs = image_processor.build_target_wcs(ra, dec, fov)

    # 3. Align and reproject every epoch frame onto common footprint
    aligned_frames = image_processor.align_and_reproject(raw_frames, target_wcs)

    # 4. Generate reference master stack (median combination across epochs)
    ref_stack = image_processor.generate_coadded_stack(aligned_frames)
    ref_stack_b64 = image_processor.normalize_to_base64_png(ref_stack, stretch=stretch)

    # 5. Generate difference frames (Epoch - Reference) to highlight moving dipoles & variables
    diff_frames_raw = image_processor.generate_difference_frames(aligned_frames, ref_stack)
    diff_frames = []
    for df in diff_frames_raw:
        diff_frames.append({
            "epoch_id": df["epoch_id"],
            "date_obs": df["date_obs"],
            "mjd_obs": df["mjd_obs"],
            "image_b64": image_processor.normalize_to_base64_png(df["data"], stretch=stretch, is_difference=True),
            "contamination_flags": df["contamination_flags"]
        })

    # 6. Generate individual epoch base64 frames
    epochs_payload = []
    for f in aligned_frames:
        epochs_payload.append({
            "epoch_id": f["epoch_id"],
            "date_obs": f["date_obs"],
            "mjd_obs": f["mjd_obs"],
            "detector_band": f["detector_band"],
            "wavelength_um": f["wavelength_um"],
            "image_b64": image_processor.normalize_to_base64_png(f["data"], stretch=stretch),
            "contamination_flags": f["contamination_flags"]
        })

    # 7. Detector Array Coadds (Bands 1 to 6) & False-Color RGB Composite
    band_stacks = image_processor.generate_band_coadds(aligned_frames)
    band_stacks_payload = {}
    for b_id, b_data in band_stacks.items():
        band_stacks_payload[f"band_{b_id}"] = image_processor.normalize_to_base64_png(b_data, stretch=stretch)

    rgb_composite_b64 = image_processor.generate_rgb_composite(band_stacks, stretch=stretch)

    # 8. WCS Header information for client-side coordinate mapping
    wcs_info = {
        "crval": [ra, dec],
        "crpix": [image_processor.output_dim / 2.0 + 0.5, image_processor.output_dim / 2.0 + 0.5],
        "cdelt": [-fov / image_processor.output_dim, fov / image_processor.output_dim],
        "dim": image_processor.output_dim,
        "pixel_scale_arcsec": round((fov * 3600.0) / image_processor.output_dim, 3)
    }

    return {
        "center": {"ra": ra, "dec": dec},
        "fov_deg": fov,
        "stretch": stretch,
        "wcs": wcs_info,
        "epochs": epochs_payload,
        "reference_stack": ref_stack_b64,
        "difference_frames": diff_frames,
        "band_stacks": band_stacks_payload,
        "rgb_composite": rgb_composite_b64,
        "total_epochs": len(epochs_payload)
    }

@app.post("/api/spectrum")
def extract_spectrum(req: SpectrumRequest):
    """
    Aperture Photometry Spectrum across all 100 active SPHEREx channels (0.75 - 5.0 µm).
    """
    res = spectrum_service.extract_spectrum(
        pixel_x=req.pixel_x,
        pixel_y=req.pixel_y,
        ra=req.ra,
        dec=req.dec,
        fov_deg=req.fov,
        target_name=req.target_name
    )
    return res

@app.get("/api/overlays")
def get_overlays(
    ra: float = Query(..., description="Center Right Ascension in degrees"),
    dec: float = Query(..., description="Center Declination in degrees"),
    fov: float = Query(0.08, description="Field of View in degrees")
):
    """
    Multi-Mission Overlays:
    - Gaia DR3 proper motion vectors & magnitudes
    - AllWISE historical baseline markers (~2010.0)
    - CSA NEOSSat asteroid/NEO observations from CADC
    """
    return catalog_service.get_overlays(ra, dec, fov)

from fastapi.staticfiles import StaticFiles

# Serve built frontend if dist directory exists
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
