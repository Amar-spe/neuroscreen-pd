/**
 * Finger-Tapping Motor Telemetry & Bradykinesia Analysis Engine
 * Follows the standardized MDS-UPDRS Part III Item 3.4 (Finger Tapping) protocol.
 * Measures cadence, rhythm regularity (CV%), deceleration fatigue slope, and freezing pauses.
 */

class TappingProcessor {
  constructor() {
    this.isActive = false;
    this.durationSec = 10;
    this.startTime = 0;
    this.tapTimestamps = [];
    this.timerInterval = null;

    // Extracted features
    this.results = {
      tapCount: 0,
      tapFrequencyHz: 0,
      meanItiMs: 0,
      stdItiMs: 0,
      cvPercent: 0,
      fatigueSlope: 0,
      freezingPauses: 0,
      bradykinesiaScore: 0,
      isAbnormal: false
    };
  }

  startTest(durationSec = 10, onTick = null, onFinish = null) {
    this.durationSec = durationSec;
    this.tapTimestamps = [];
    this.isActive = true;
    this.startTime = performance.now();

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      const elapsed = (performance.now() - this.startTime) / 1000;
      const remaining = Math.max(0, this.durationSec - elapsed);

      if (onTick) onTick(remaining, this.tapTimestamps.length);

      if (remaining <= 0) {
        this.stopTest();
        if (onFinish) onFinish(this.calculateFeatures());
      }
    }, 50);
  }

  recordTap() {
    if (!this.isActive) return false;
    const now = performance.now();
    this.tapTimestamps.push(now);
    return true;
  }

  stopTest() {
    this.isActive = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    return this.calculateFeatures();
  }

  calculateFeatures() {
    const n = this.tapTimestamps.length;
    if (n < 4) {
      // Insufficient taps
      this.results = {
        tapCount: n,
        tapFrequencyHz: 0,
        meanItiMs: 0,
        stdItiMs: 0,
        cvPercent: 0,
        fatigueSlope: 0,
        freezingPauses: 0,
        bradykinesiaScore: 0,
        isAbnormal: false
      };
      return this.results;
    }

    // Inter-Tap Intervals (ITIs)
    const itis = [];
    let freezingPauses = 0;

    for (let i = 1; i < n; i++) {
      const interval = this.tapTimestamps[i] - this.tapTimestamps[i - 1];
      itis.push(interval);
      if (interval > 500) {
        freezingPauses++; // Freezing / motor arrest pause > 500ms
      }
    }

    const totalDurationSec = (this.tapTimestamps[n - 1] - this.tapTimestamps[0]) / 1000;
    const tapFrequencyHz = totalDurationSec > 0 ? (n / totalDurationSec) : 0;

    // Mean and Standard Deviation of ITI
    const sumIti = itis.reduce((a, b) => a + b, 0);
    const meanItiMs = sumIti / itis.length;

    const variance = itis.reduce((acc, val) => acc + Math.pow(val - meanItiMs, 2), 0) / itis.length;
    const stdItiMs = Math.sqrt(variance);

    // Coefficient of Variation (CV% = std / mean * 100)
    const cvPercent = meanItiMs > 0 ? (stdItiMs / meanItiMs) * 100 : 0;

    // Fatigue / Deceleration Slope: Linear regression of ITI vs Time
    // A positive slope indicates progressive deceleration (bradykinesia sequence effect)
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    const k = itis.length;

    for (let i = 0; i < k; i++) {
      const t = (this.tapTimestamps[i] - this.startTime) / 1000; // time in sec
      sumX += t;
      sumY += itis[i];
      sumXY += t * itis[i];
      sumXX += t * t;
    }

    const denominator = (k * sumXX - sumX * sumX);
    const slope = denominator !== 0 ? (k * sumXY - sumX * sumY) / denominator : 0;

    // Clinical Scoring & Thresholds:
    // Healthy Normal: Frequency >= 4.2 Hz, CV < 18%, Freezing Pauses <= 1, Fatigue Slope < 8 ms/s
    // Parkinsonian Bradykinesia: Frequency < 3.5 Hz, CV > 25%, Freezing Pauses >= 2, Positive fatigue slope
    let motorScore = 0;
    if (tapFrequencyHz < 4.0) {
      motorScore += 0.40 * Math.min(2.0, (4.0 - tapFrequencyHz) / 1.5);
    }
    if (cvPercent > 20.0) {
      motorScore += 0.35 * Math.min(2.5, (cvPercent - 20.0) / 15.0);
    }
    if (freezingPauses >= 2) {
      motorScore += 0.15 * Math.min(2.0, freezingPauses / 2.0);
    }
    if (slope > 8.0) {
      motorScore += 0.10 * Math.min(2.0, slope / 15.0);
    }

    const normalizedBradykinesia = Math.min(1.0, Math.max(0.0, motorScore));
    const isAbnormal = normalizedBradykinesia > 0.45;

    this.results = {
      tapCount: n,
      tapFrequencyHz: parseFloat(tapFrequencyHz.toFixed(2)),
      meanItiMs: parseFloat(meanItiMs.toFixed(1)),
      stdItiMs: parseFloat(stdItiMs.toFixed(1)),
      cvPercent: parseFloat(cvPercent.toFixed(1)),
      fatigueSlope: parseFloat(slope.toFixed(2)),
      freezingPauses,
      bradykinesiaScore: parseFloat(normalizedBradykinesia.toFixed(3)),
      isAbnormal
    };

    return this.results;
  }

  /**
   * Generates synthetic tap sequences for offline testing or demonstration
   */
  generateSyntheticTaps(profile = 'healthy') {
    this.tapTimestamps = [];
    const duration = 10.0;
    this.startTime = performance.now();
    let currentT = this.startTime;

    if (profile === 'parkinsons') {
      // Bradykinetic, erratic, slowing down with freezing
      let currentInterval = 280; // starts slow (3.5 Hz)
      while ((currentT - this.startTime) / 1000 < duration) {
        this.tapTimestamps.push(currentT);
        // Add random irregularity + progressive fatigue slowing
        const noise = (Math.random() - 0.5) * 110;
        currentInterval += 12; // Deceleration slope (+12 ms/sec)
        // Occasional freezing episode
        const isFreezing = Math.random() < 0.08;
        const interval = isFreezing ? 680 : Math.max(160, currentInterval + noise);
        currentT += interval;
      }
    } else {
      // Healthy control: Rapid, regular, rhythmic (~5.5 Hz)
      const targetInterval = 182; // ~5.5 Hz
      while ((currentT - this.startTime) / 1000 < duration) {
        this.tapTimestamps.push(currentT);
        const jitter = (Math.random() - 0.5) * 22; // very slight variance (~12%)
        currentT += Math.max(120, targetInterval + jitter);
      }
    }

    return this.calculateFeatures();
  }
}

window.TappingProcessor = TappingProcessor;
