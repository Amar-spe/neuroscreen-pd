/**
 * Gait & Locomotion Digital Biomarker Engine
 * Analyzes step frequency/cadence, stride variability (CV%), and bilateral symmetry index.
 * Supports HTML5 DeviceMotionEvent (mobile accelerometer) and synthetic walking sensor telemetry.
 * Aligned with Arora et al. (2015) smartphone mobility sensing.
 */

class GaitProcessor {
  constructor() {
    this.isActive = false;
    this.rawAcceleration = []; // [{t, x, y, z, mag}]
    this.stepPeaks = [];
    this.intervalId = null;

    this.features = {
      cadenceStepsPerMin: 0,
      strideVariabilityCv: 0,
      symmetryIndexPercent: 0,
      stepRegularityScore: 0,
      gaitScore: 0,
      isAbnormal: false
    };
  }

  startLiveSensor(canvas = null, onUpdate = null) {
    this.isActive = true;
    this.rawAcceleration = [];
    this.stepPeaks = [];
    this.startTime = performance.now();

    this.motionHandler = (event) => {
      if (!this.isActive) return;
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;
      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;
      const mag = Math.sqrt(x * x + y * y + z * z);
      const t = performance.now();

      this.rawAcceleration.push({ t, x, y, z, mag });
      this.detectStepPeak(t, mag);

      if (onUpdate) onUpdate(this.rawAcceleration.length, this.stepPeaks.length);
    };

    if (window.DeviceMotionEvent) {
      // In iOS 13+, requestPermission is required
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              window.addEventListener('devicemotion', this.motionHandler);
            }
          })
          .catch(console.warn);
      } else {
        window.addEventListener('devicemotion', this.motionHandler);
      }
    }
  }

  detectStepPeak(t, mag) {
    // Dynamic peak detector for vertical trunk deceleration impacts
    const n = this.rawAcceleration.length;
    if (n < 5) return;

    const prev = this.rawAcceleration[n - 2].mag;
    const curr = mag;
    const prevPrev = this.rawAcceleration[n - 3].mag;

    // Peak above gravity baseline threshold (10.6 m/s^2)
    if (prev > prevPrev && prev > curr && prev > 10.6) {
      if (this.stepPeaks.length === 0 || (t - this.stepPeaks[this.stepPeaks.length - 1].t) > 320) {
        this.stepPeaks.push({ t: this.rawAcceleration[n - 2].t, mag: prev });
      }
    }
  }

  stopLiveSensor() {
    this.isActive = false;
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
    return this.calculateGaitFeatures();
  }

  calculateGaitFeatures() {
    const peaks = this.stepPeaks;
    if (peaks.length < 4) {
      return this.features;
    }

    const stepIntervals = [];
    for (let i = 1; i < peaks.length; i++) {
      stepIntervals.push(peaks[i].t - peaks[i - 1].t);
    }

    const totalDurationSec = (peaks[peaks.length - 1].t - peaks[0].t) / 1000;
    const cadenceStepsPerMin = totalDurationSec > 0 ? (peaks.length / totalDurationSec) * 60 : 0;

    // Stride Interval Variability (CV %)
    const meanInterval = stepIntervals.reduce((a, b) => a + b, 0) / stepIntervals.length;
    const variance = stepIntervals.reduce((acc, val) => acc + Math.pow(val - meanInterval, 2), 0) / stepIntervals.length;
    const stdInterval = Math.sqrt(variance);
    const strideCv = meanInterval > 0 ? (stdInterval / meanInterval) * 100 : 0;

    // Bilateral Symmetry Index: Compare consecutive left/right step intervals
    let sumAsymmetry = 0;
    let pairs = 0;
    for (let i = 0; i < stepIntervals.length - 1; i += 2) {
      const stepL = stepIntervals[i];
      const stepR = stepIntervals[i + 1];
      const diff = Math.abs(stepL - stepR);
      const meanLR = (stepL + stepR) / 2;
      sumAsymmetry += (diff / meanLR);
      pairs++;
    }
    const avgAsymmetryPercent = pairs > 0 ? (sumAsymmetry / pairs) * 100 : 5;
    const symmetryIndexPercent = Math.max(0, 100 - avgAsymmetryPercent);

    // Clinical Scoring:
    // Healthy: Cadence 95-125 steps/min, Stride CV < 5.5%, Symmetry > 88%
    // Parkinsonian: Reduced cadence (< 90), elevated CV (> 10%), asymmetry (< 78%)
    let gaitAbnormality = 0;
    if (cadenceStepsPerMin < 90) gaitAbnormality += 0.35 * Math.min(2.0, (90 - cadenceStepsPerMin) / 25);
    if (strideCv > 5.5) gaitAbnormality += 0.40 * Math.min(2.5, (strideCv - 5.5) / 6.5);
    if (symmetryIndexPercent < 85) gaitAbnormality += 0.25 * Math.min(2.0, (85 - symmetryIndexPercent) / 20);

    const gaitScore = Math.min(1.0, Math.max(0.0, gaitAbnormality));
    const isAbnormal = gaitScore > 0.45;

    this.features = {
      cadenceStepsPerMin: parseFloat(cadenceStepsPerMin.toFixed(1)),
      strideVariabilityCv: parseFloat(strideCv.toFixed(1)),
      symmetryIndexPercent: parseFloat(symmetryIndexPercent.toFixed(1)),
      stepRegularityScore: parseFloat((1.0 - Math.min(1.0, strideCv / 20)).toFixed(2)),
      gaitScore: parseFloat(gaitScore.toFixed(3)),
      isAbnormal
    };

    return this.features;
  }

  /**
   * Generates synthetic 10-second gait acceleration stream calibrated against PhysioNet Gait Dataset
   */
  generateSyntheticGait(profile = 'healthy', canvas = null) {
    this.rawAcceleration = [];
    this.stepPeaks = [];
    const duration = 10.0;
    const samplingFreq = 50; // 50 Hz
    const totalSamples = duration * samplingFreq;
    const startTime = performance.now();

    const targetCadence = profile === 'parkinsons' ? 84.0 : 112.0; // steps/min
    const baseStepDur = 60.0 / targetCadence; // sec per step

    // Pre-calculate step timing schedule with clinical variability
    const steps = [];
    let tWalk = 0.0;
    let stepIdx = 0;

    while (tWalk < duration) {
      const isLeft = (stepIdx % 2 === 0);
      let dur = baseStepDur;
      if (profile === 'parkinsons') {
        // Lateralized step length asymmetry + arrhythmic basal ganglia timing jitter
        dur = isLeft ? baseStepDur * 0.86 : baseStepDur * 1.18;
        dur += (Math.random() - 0.5) * 0.14;
      } else {
        // Normative gait has tight rhythmic pacing (CV < 3.0%)
        dur += (Math.random() - 0.5) * 0.02;
      }
      steps.push({ idx: stepIdx, start: tWalk, dur, isLeft });
      tWalk += dur;
      stepIdx++;
    }

    for (let i = 0; i < totalSamples; i++) {
      const tSec = i / samplingFreq;
      const tMs = startTime + (tSec * 1000);

      // Find current step
      let curStep = steps.find(s => tSec >= s.start && tSec < s.start + s.dur);
      if (!curStep) curStep = steps[steps.length - 1];

      const progress = (tSec - curStep.start) / curStep.dur;
      const phase = progress * Math.PI * 2.0;

      const peakAmp = (profile === 'parkinsons') 
        ? (curStep.isLeft ? 2.3 : 3.4) 
        : 2.85;

      const verticalAcc = 9.8 + (Math.sin(phase) * peakAmp) + ((Math.random() - 0.5) * 0.25);
      const lateralAcc = Math.cos(phase / 2) * 1.2;
      const fwdAcc = Math.sin(phase) * 1.5;
      const mag = Math.sqrt(lateralAcc * lateralAcc + fwdAcc * fwdAcc + verticalAcc * verticalAcc);

      this.rawAcceleration.push({ t: tMs, x: lateralAcc, y: verticalAcc, z: fwdAcc, mag });
      this.detectStepPeak(tMs, mag);
    }

    if (canvas) {
      this.renderGaitWaveform(canvas);
    }

    return this.calculateGaitFeatures();
  }

  renderPlaceholder(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    ctx.fillStyle = isDark ? '#15181C' : '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Baseline
    ctx.strokeStyle = isDark ? '#2D333E' : '#E2DFD8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillStyle = isDark ? '#848995' : '#6E6B65';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Waiting for sensor acquisition · Walk naturally for 10–20 steps", w / 2, h / 2 - 12);
  }

  renderGaitWaveform(canvas) {
    if (!canvas || !this.rawAcceleration.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    ctx.fillStyle = isDark ? '#15181C' : '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Draw baseline
    ctx.strokeStyle = isDark ? '#2D333E' : '#E2DFD8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Draw acceleration waveform in accent color
    ctx.strokeStyle = isDark ? '#2DD4BF' : '#0F6B6B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const n = this.rawAcceleration.length;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * w;
      // Center at 9.8 m/s^2
      const val = this.rawAcceleration[i].mag;
      const y = (h / 2) - ((val - 9.8) * 10);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Highlight detected step peaks cleanly without glowing
    ctx.fillStyle = isDark ? '#2DD4BF' : '#0F6B6B';
    for (const peak of this.stepPeaks) {
      const idx = this.rawAcceleration.findIndex(a => Math.abs(a.t - peak.t) < 15);
      if (idx !== -1) {
        const px = (idx / n) * w;
        const py = (h / 2) - ((peak.mag - 9.8) * 10);
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
}

window.GaitProcessor = GaitProcessor;
