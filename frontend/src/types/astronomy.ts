export interface ContaminationFlags {
  cosmic_ray_hits: number;
  stray_light_warning: boolean;
  saturation_warning: boolean;
  quality_bitmask: number;
}

export interface EpochFrame {
  epoch_id: number;
  date_obs: string;
  mjd_obs: number;
  detector_band: number;
  wavelength_um: number;
  image_b64: string;
  contamination_flags: ContaminationFlags;
}

export interface DifferenceFrame {
  epoch_id: number;
  date_obs: string;
  mjd_obs: number;
  image_b64: string;
  contamination_flags: ContaminationFlags;
}

export interface WCSInfo {
  crval: [number, number];
  crpix: [number, number];
  cdelt: [number, number];
  dim: number;
  pixel_scale_arcsec: number;
}

export interface CutoutsResponse {
  center: { ra: number; dec: number };
  fov_deg: number;
  stretch: string;
  wcs: WCSInfo;
  epochs: EpochFrame[];
  reference_stack: string;
  difference_frames: DifferenceFrame[];
  band_stacks: Record<string, string>;
  rgb_composite: string;
  total_epochs: number;
}

export interface MolecularFeature {
  molecule: string;
  wavelength_um: number;
  range: [number, number];
  description: string;
}

export interface SpectrumResponse {
  target: string;
  pixel_coords: { x: number; y: number };
  sky_coords: { ra: number; dec: number };
  wavelengths_um: number[];
  fluxes_mjy: number[];
  flux_errors: number[];
  band_ids: number[];
  detector_bands: number[];
  classification: string;
  classification_notes: string;
  molecular_features: MolecularFeature[];
  channel_count: number;
}

export interface GaiaStar {
  source_id: string;
  ra: number;
  dec: number;
  phot_g_mean_mag: number;
  pmra: number;
  pmdec: number;
  parallax: number;
}

export interface AllWiseSource {
  ra: number;
  dec: number;
  w1_mag: number;
  w2_mag: number;
  epoch: number;
}

export interface NeossatObs {
  observation_id: string;
  target_name: string;
  time_start: string;
  time_end: string;
  instrument: string;
  mission: string;
  cadc_url: string;
}

export interface OverlayResponse {
  center: { ra: number; dec: number };
  fov_deg: number;
  gaia_dr3: GaiaStar[];
  allwise: AllWiseSource[];
  neossat: NeossatObs[];
}

export interface PresetTarget {
  id: string;
  name: string;
  ra: number;
  dec: number;
  fov_deg: number;
  type: string;
  description: string;
  spectral_class: string;
  distance_ly: number;
}
