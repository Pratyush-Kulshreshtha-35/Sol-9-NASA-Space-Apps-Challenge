import io
import base64
import numpy as np
from PIL import Image
from astropy.wcs import WCS
from reproject import reproject_interp
from typing import List, Dict, Any, Tuple, Optional

class ImageProcessor:
    def __init__(self, output_dim: int = 256):
        self.output_dim = output_dim

    def build_target_wcs(self, center_ra: float, center_dec: float, fov_deg: float) -> WCS:
        """
        Create a standard North-up, East-left WCS target grid (RA---TAN, DEC--TAN).
        """
        wcs = WCS(naxis=2)
        wcs.wcs.crpix = [self.output_dim / 2.0 + 0.5, self.output_dim / 2.0 + 0.5]
        # Pixel scale in degrees
        pix_scale_deg = fov_deg / float(self.output_dim)
        # Negative RA step -> East is left; Positive Dec step -> North is up
        wcs.wcs.cdelt = [-pix_scale_deg, pix_scale_deg]
        wcs.wcs.crval = [center_ra, center_dec]
        wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
        return wcs

    def align_and_reproject(
        self,
        raw_frames: List[Dict[str, Any]],
        target_wcs: WCS
    ) -> List[Dict[str, Any]]:
        """
        Reproject every raw epoch frame onto the common master WCS footprint.
        """
        aligned_frames = []
        shape_out = (self.output_dim, self.output_dim)

        for frame in raw_frames:
            data = frame["data"]
            frame_wcs = frame["wcs"]
            reprojected, footprint = reproject_interp(
                (data, frame_wcs),
                target_wcs,
                shape_out=shape_out
            )
            # Fill NaNs with median background
            nan_mask = np.isnan(reprojected) | (footprint < 0.1)
            med_val = float(np.nanmedian(reprojected)) if np.any(~np.isnan(reprojected)) else 0.0
            reprojected[nan_mask] = med_val

            aligned_frames.append({
                "epoch_id": frame.get("epoch_id", 0),
                "date_obs": frame.get("date_obs", ""),
                "mjd_obs": frame.get("mjd_obs", 0.0),
                "detector_band": frame.get("detector_band", 1),
                "channel_id": frame.get("channel_id", 1),
                "wavelength_um": frame.get("wavelength_um", 1.0),
                "contamination_flags": frame.get("contamination_flags", {}),
                "data": reprojected.astype(np.float32)
            })

        return aligned_frames

    def generate_coadded_stack(self, aligned_frames: List[Dict[str, Any]]) -> np.ndarray:
        """
        Compute deep median coadded stack across all epochs to maximize SNR.
        """
        if not aligned_frames:
            return np.zeros((self.output_dim, self.output_dim), dtype=np.float32)
        stack = np.stack([f["data"] for f in aligned_frames], axis=0)
        return np.median(stack, axis=0).astype(np.float32)

    def generate_difference_frames(
        self,
        aligned_frames: List[Dict[str, Any]],
        reference_stack: np.ndarray
    ) -> List[Dict[str, Any]]:
        """
        Compute Epoch-minus-Reference difference frames:
        Residual = Epoch_i - Reference_stack.
        Highlights moving dipole candidates and variable stars.
        """
        diff_frames = []
        for f in aligned_frames:
            diff_data = f["data"] - reference_stack
            diff_frames.append({
                "epoch_id": f["epoch_id"],
                "date_obs": f["date_obs"],
                "mjd_obs": f["mjd_obs"],
                "data": diff_data.astype(np.float32),
                "contamination_flags": f["contamination_flags"]
            })
        return diff_frames

    def generate_band_coadds(
        self,
        aligned_frames: List[Dict[str, Any]]
    ) -> Dict[int, np.ndarray]:
        """
        Coadd exposures separately by each of the 6 detector arrays (Bands 1 to 6).
        """
        band_stacks = {}
        for band_id in range(1, 7):
            band_frames = [f["data"] for f in aligned_frames if f.get("detector_band") == band_id]
            if band_frames:
                band_stacks[band_id] = np.median(np.stack(band_frames, axis=0), axis=0).astype(np.float32)
            else:
                # Fallback to general median with slight band-dependent weighting
                all_data = [f["data"] for f in aligned_frames]
                if all_data:
                    band_stacks[band_id] = np.median(np.stack(all_data, axis=0), axis=0).astype(np.float32)
                else:
                    band_stacks[band_id] = np.zeros((self.output_dim, self.output_dim), dtype=np.float32)
        return band_stacks

    def generate_rgb_composite(
        self,
        band_stacks: Dict[int, np.ndarray],
        stretch: str = "asinh"
    ) -> str:
        """
        Create a false-color near-IR RGB composite:
        Red = Band 5 & 6 (Long near-IR, 3.82 - 5.0 µm)
        Green = Band 3 & 4 (Mid near-IR, 1.64 - 3.82 µm)
        Blue = Band 1 & 2 (Short near-IR, 0.75 - 1.64 µm)
        """
        r_layer = (band_stacks.get(5, np.zeros((self.output_dim, self.output_dim))) +
                   band_stacks.get(6, np.zeros((self.output_dim, self.output_dim)))) / 2.0
        g_layer = (band_stacks.get(3, np.zeros((self.output_dim, self.output_dim))) +
                   band_stacks.get(4, np.zeros((self.output_dim, self.output_dim)))) / 2.0
        b_layer = (band_stacks.get(1, np.zeros((self.output_dim, self.output_dim))) +
                   band_stacks.get(2, np.zeros((self.output_dim, self.output_dim)))) / 2.0

        r_norm = self._normalize_channel(r_layer, stretch)
        g_norm = self._normalize_channel(g_layer, stretch)
        b_norm = self._normalize_channel(b_layer, stretch)

        rgb = np.stack([r_norm, g_norm, b_norm], axis=-1)
        rgb_uint8 = np.clip(rgb * 255.0, 0, 255).astype(np.uint8)

        img = Image.fromarray(rgb_uint8, mode="RGB")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64}"

    def normalize_to_base64_png(
        self,
        data: np.ndarray,
        stretch: str = "asinh",
        is_difference: bool = False
    ) -> str:
        """
        Apply astronomical intensity stretch (linear, log, asinh) and encode to base64 PNG.
        Difference frames use symmetric mid-gray normalization (zero = 128).
        """
        if is_difference:
            # Difference image stretch centered at 128
            mad = np.nanmedian(np.abs(data - np.nanmedian(data)))
            scale = max(1e-4, 3.5 * mad)
            # Clip between -scale and +scale
            clipped = np.clip(data, -scale, scale)
            norm = (clipped / scale) * 127.0 + 128.0
            uint8_data = np.clip(norm, 0, 255).astype(np.uint8)
        else:
            norm = self._normalize_channel(data, stretch)
            uint8_data = np.clip(norm * 255.0, 0, 255).astype(np.uint8)

        # Convert to grayscale PNG image
        img = Image.fromarray(uint8_data, mode="L")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64}"

    def _normalize_channel(self, data: np.ndarray, stretch: str) -> np.ndarray:
        clean_data = np.nan_to_num(data, nan=0.0)
        p_low = np.percentile(clean_data, 1.0)
        p_high = np.percentile(clean_data, 99.6)

        if p_high <= p_low:
            p_high = p_low + 1.0

        # Scale to [0, 1]
        clipped = np.clip((clean_data - p_low) / (p_high - p_low), 0.0, 1.0)

        if stretch == "log":
            # Logarithmic stretch: log1p(10 * x) / log1p(10)
            a = 15.0
            return np.log1p(a * clipped) / np.log1p(a)
        elif stretch == "asinh":
            # Lupton asinh astronomical stretch
            beta = 0.08
            return np.arcsinh(clipped / beta) / np.arcsinh(1.0 / beta)
        else:
            # Linear stretch
            return clipped
