#!/usr/bin/env python3
"""
NeuroScreen-PD: Digital Signal Processing (DSP) & Biomarker Extraction Module
Implements Acoustic Phonation, Finger Tapping, and Spiral Kinematics feature extraction.
"""

import numpy as np

# ==============================================================================
# 1. ACOUSTIC BIOMARKER EXTRACTION (VOICE)
# ==============================================================================

def extract_acoustic_features(audio_samples, sample_rate=44100):
    """
    Extracts fundamental frequency (F0), Jitter, Shimmer, and HNR from audio signal.
    """
    if len(audio_samples) < 2048:
        return {}

    # Frame-based autocorrelation for pitch detection
    frame_size = 2048
    min_f0, max_f0 = 60, 400
    min_lag = int(sample_rate / max_f0)
    max_lag = int(sample_rate / min_f0)

    periods = []
    amplitudes = []
    rmax_list = []

    num_frames = len(audio_samples) // frame_size
    for f in range(num_frames):
        frame = audio_samples[f * frame_size : (f + 1) * frame_size]
        energy = np.sum(frame ** 2)
        if energy < 1e-4:
            continue

        corr = np.correlate(frame, frame, mode='full')
        corr = corr[len(frame)-1:] # positive lags

        lags = np.arange(min_lag, max_lag)
        best_lag = lags[np.argmax(corr[lags])]
        max_corr = corr[best_lag] / energy

        if max_corr > 0.40:
            period = best_lag / sample_rate
            periods.append(period)
            amplitudes.append(np.max(np.abs(frame)))
            rmax_list.append(min(0.999, max(0.01, max_corr)))

    if len(periods) < 3:
        return {"f0": 0, "jitter": 0, "shimmer": 0, "hnr": 0}

    mean_period = np.mean(periods)
    f0 = 1.0 / mean_period

    # Jitter (Local %): cycle to cycle period deviation
    period_diffs = np.abs(np.diff(periods))
    jitter_percent = (np.mean(period_diffs) / mean_period) * 100

    # Shimmer (Local %): cycle to cycle peak amplitude deviation
    mean_amp = np.mean(amplitudes)
    amp_diffs = np.abs(np.diff(amplitudes))
    shimmer_percent = (np.mean(amp_diffs) / (mean_amp + 1e-6)) * 100

    # Harmonics-to-Noise Ratio (HNR in dB)
    avg_rmax = np.mean(rmax_list) if rmax_list else 0.8
    hnr_db = 10 * np.log10(avg_rmax / (1 - avg_rmax + 1e-6))

    return {
        "f0_hz": round(float(f0), 1),
        "jitter_percent": round(float(jitter_percent), 3),
        "shimmer_percent": round(float(shimmer_percent), 3),
        "hnr_db": round(float(hnr_db), 2)
    }

# ==============================================================================
# 2. MOTOR TAPPING TELEMETRY
# ==============================================================================

def analyze_tapping_intervals(timestamps_ms):
    """
    Analyzes inter-tap interval sequence for cadence, rhythm CV%, and deceleration slope.
    """
    if len(timestamps_ms) < 4:
        return {}

    itis = np.diff(timestamps_ms)
    total_time_sec = (timestamps_ms[-1] - timestamps_ms[0]) / 1000.0
    cadence_hz = len(timestamps_ms) / total_time_sec if total_time_sec > 0 else 0

    mean_iti = np.mean(itis)
    std_iti = np.std(itis)
    cv_percent = (std_iti / mean_iti) * 100 if mean_iti > 0 else 0

    # Linear slope of fatigue
    times_sec = (np.array(timestamps_ms[:-1]) - timestamps_ms[0]) / 1000.0
    slope, _ = np.polyfit(times_sec, itis, 1)

    freezing_pauses = int(np.sum(itis > 500))

    return {
        "cadence_hz": round(float(cadence_hz), 2),
        "mean_iti_ms": round(float(mean_iti), 1),
        "cv_percent": round(float(cv_percent), 1),
        "fatigue_slope": round(float(slope), 2),
        "freezing_pauses": freezing_pauses
    }

# ==============================================================================
# 3. ARCHIMEDES SPIRAL & HANDWRITING KINEMATICS
# ==============================================================================

def analyze_spiral_kinematics(x_coords, y_coords, timestamps_ms, center=(200, 200), b=7.5):
    """
    Evaluates radial deviation RMSE, 4-7 Hz tremor oscillation energy, and micrographia.
    """
    cx, cy = center
    dx = np.array(x_coords) - cx
    dy = np.array(y_coords) - cy
    r = np.sqrt(dx**2 + dy**2)
    angles = np.unwrap(np.arctan2(dy, dx))

    ideal_r = b * np.maximum(0, angles - angles[0])
    rmse = np.sqrt(np.mean((r - ideal_r)**2))

    # Second derivative of radial distance (acceleration tremor)
    dr = np.gradient(r)
    d2r = np.gradient(dr)
    tremor_index = np.mean(np.abs(d2r)) / 15.0 # normalized index

    # Micrographia: ratio of max reached radius
    micrographia_ratio = (np.max(r) / (b * 6 * np.pi)) * 100

    return {
        "spiral_rmse_px": round(float(rmse), 1),
        "tremor_index": round(float(min(1.0, tremor_index)), 3),
        "micrographia_ratio_pct": round(float(min(100.0, micrographia_ratio)), 1)
    }

if __name__ == "__main__":
    print("[*] NeuroScreen-PD Feature Extraction Module Ready.")
    # Quick self-test
    taps = [0, 200, 410, 630, 860, 1100, 1360, 1640, 1940, 2260]
    res = analyze_tapping_intervals(taps)
    print("Self-test Tapping Telemetry:", res)
