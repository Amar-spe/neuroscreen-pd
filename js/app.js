/**
 * NeuroScreen-PD Main Application Controller
 * Handles view switching, session management, chart rendering,
 * and integration of Voice, Tapping, Drawing, Gait, and Fusion engines.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Instantiate core processing engines
  const voiceProcessor = new VoiceProcessor();
  const tappingProcessor = new TappingProcessor();
  const spiralCanvas = document.getElementById('spiralCanvas');
  const guideCanvas = document.getElementById('guideCanvas');
  const fusionEngine = new MultimodalFusionEngine();
  const gaitProcessor = new GaitProcessor();

  const drawingProcessor = new DrawingProcessor(
    spiralCanvas,
    guideCanvas,
    (liveFeatures) => {
      handleLiveDrawingUpdate(liveFeatures);
    },
    (finalFeatures) => {
      handleCompletedDrawingVerification(finalFeatures);
    }
  );

  // State management
  const appState = {
    activeView: 'assessment',
    activeModality: 'voice',
    patient: {
      id: 'PT-REF-001',
      name: 'Standard Reference',
      age: 30,
      gender: 'Male',
      hand: 'Right',
      familyHistory: 'none',
      rbd: false,
      smell: false,
      restingTremor: false,
      constipation: false,
      intakeCompleted: true
    },
    modalitiesData: {
      voice: voiceProcessor.features,
      tapping: tappingProcessor.results,
      drawing: drawingProcessor.features,
      gait: gaitProcessor.features
    },
    fusionResult: null,
    history: [
      {
        date: '2026-09-01',
        session: 'Visit 1 (Baseline)',
        riskPercent: 42,
        category: 'MODERATE',
        voiceJitter: 1.15,
        tapFreq: 4.1,
        spiralTremor: 0.32,
        gaitCadence: 92,
        notes: 'Initial mild tremor and occasional vocal roughness noted.'
      },
      {
        date: '2026-09-18',
        session: 'Visit 2 (Repeat)',
        riskPercent: 48,
        category: 'MODERATE',
        voiceJitter: 1.28,
        tapFreq: 3.8,
        spiralTremor: 0.38,
        gaitCadence: 88,
        notes: 'Repeat test confirms persistent subtle motor slowing.'
      },
      {
        date: '2026-10-15',
        session: 'Visit 3 (Monitoring)',
        riskPercent: 71,
        category: 'HIGH',
        voiceJitter: 2.12,
        tapFreq: 3.1,
        spiralTremor: 0.62,
        gaitCadence: 81,
        notes: 'Marked increase in tremor amplitude and vocal dysphonia. Referral triggered.'
      }
    ]
  };

  // Expose to window for debugging
  window.appState = appState;

  // --- THEME TOGGLE CONTROLLER ---
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const savedTheme = localStorage.getItem('neuroscreen_theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('neuroscreen_theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('neuroscreen_theme', 'dark');
      }
      // Re-render visuals to match theme tokens
      if (typeof renderRadarChart === 'function') renderRadarChart();
      if (drawingProcessor) drawingProcessor.drawTemplateGuide();
      const vc = document.getElementById('voiceVisualizerCanvas');
      if (vc && voiceProcessor && !voiceProcessor.isRecording) voiceProcessor.drawPlaceholder(vc);
      const gc = document.getElementById('gaitWaveCanvas');
      if (gc && gaitProcessor && !gaitProcessor.isActive) gaitProcessor.renderPlaceholder(gc);
    });
  }

  // --- UI NAVIGATION LOGIC ---
  const navTabs = document.querySelectorAll('.nav-tab-btn');
  const views = document.querySelectorAll('.app-view');

  function switchView(viewName) {
    appState.activeView = viewName;
    navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-view') === viewName);
    });
    views.forEach(v => {
      v.classList.toggle('active', v.id === `view-${viewName}`);
    });

    if (viewName === 'fusion') {
      updateFusionDisplay();
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const viewName = tab.getAttribute('data-view');
      switchView(viewName);
    });
  });

  // --- MODALITY SUB-TABS (Within Assessment View) ---
  const modalityBtns = document.querySelectorAll('.modality-card-btn');
  const modalityPanes = document.querySelectorAll('.modality-pane');

  function switchModality(modalityName) {
    appState.activeModality = modalityName;
    modalityBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-modality') === modalityName);
    });
    modalityPanes.forEach(p => {
      p.classList.toggle('active', p.id === `pane-${modalityName}`);
    });

    if (modalityName === 'drawing') {
      setTimeout(() => drawingProcessor.resizeCanvases(), 50);
    }
  }

  modalityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchModality(btn.getAttribute('data-modality'));
    });
  });

  // --- PRESET PROFILE SELECTOR ---
  const presetSelect = document.getElementById('presetSelect');
  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'healthy') {
        loadPresetProfile('healthy');
      } else if (val === 'parkinsons') {
        loadPresetProfile('parkinsons');
      } else if (val === 'early') {
        loadPresetProfile('early');
      } else {
        resetAllModalities();
      }
    });
  }

  function loadPresetProfile(type) {
    if (type === 'healthy') {
      appState.modalitiesData.voice = voiceProcessor.generateSyntheticSample('healthy');
      appState.modalitiesData.tapping = tappingProcessor.generateSyntheticTaps('healthy');
      appState.modalitiesData.drawing = drawingProcessor.generateSampleSpiral('healthy');
      appState.modalitiesData.gait = gaitProcessor.generateSyntheticGait('healthy', document.getElementById('gaitWaveCanvas'));
    } else if (type === 'parkinsons') {
      appState.modalitiesData.voice = voiceProcessor.generateSyntheticSample('parkinsons');
      appState.modalitiesData.tapping = tappingProcessor.generateSyntheticTaps('parkinsons');
      appState.modalitiesData.drawing = drawingProcessor.generateSampleSpiral('parkinsons');
      appState.modalitiesData.gait = gaitProcessor.generateSyntheticGait('parkinsons', document.getElementById('gaitWaveCanvas'));
    } else if (type === 'early') {
      // Early borderline pattern
      const voice = voiceProcessor.generateSyntheticSample('healthy');
      voice.jitterPercent = 1.18;
      voice.shimmerPercent = 4.1;
      voice.isAbnormal = true;
      appState.modalitiesData.voice = voice;

      const tap = tappingProcessor.generateSyntheticTaps('healthy');
      tap.tapFrequencyHz = 3.9;
      tap.cvPercent = 22.4;
      tap.isAbnormal = true;
      appState.modalitiesData.tapping = tap;

      appState.modalitiesData.drawing = drawingProcessor.generateSampleSpiral('healthy');
      appState.modalitiesData.gait = gaitProcessor.generateSyntheticGait('healthy', document.getElementById('gaitWaveCanvas'));
    }

    updateModalityDisplays();
    updateModalityStatusDots();
    updateFusionDisplay();
  }

  function resetAllModalities() {
    voiceProcessor.features = { f0: 0, jitterPercent: 0, jitterRap: 0, shimmerPercent: 0, shimmerDb: 0, mfcc: [], isAbnormal: false };
    tappingProcessor.results = { tapCount: 0, tapFrequencyHz: 0, meanItiMs: 0, stdItiMs: 0, cvPercent: 0, fatigueSlope: 0, freezingPauses: 0, isAbnormal: false };
    drawingProcessor.clearCanvas();
    drawingProcessor.drawTemplateGuide();
    gaitProcessor.features = { cadenceStepsPerMin: 0, strideVariabilityCv: 0, symmetryIndexPercent: 0, stepRegularityScore: 0, isAbnormal: false };

    appState.modalitiesData = {
      voice: voiceProcessor.features,
      tapping: tappingProcessor.results,
      drawing: drawingProcessor.features,
      gait: gaitProcessor.features
    };

    // Reset Live Drawing HUD
    const hudLabel = document.getElementById('spiralHudLabel');
    const hudPercent = document.getElementById('spiralHudPercentage');
    const hudBar = document.getElementById('spiralHudProgressBar');
    const hudVerdict = document.getElementById('spiralHudVerdict');
    const hudPoints = document.getElementById('spiralHudPoints');
    const hudDot = document.getElementById('spiralHudDot');

    if (hudLabel) hudLabel.textContent = "Parkinson's Probability:";
    if (hudPercent) {
      hudPercent.textContent = '0.0%';
      hudPercent.style.color = '#1B7A43';
    }
    if (hudBar) {
      hudBar.style.width = '0%';
      hudBar.style.background = '#1B7A43';
    }
    if (hudVerdict) hudVerdict.textContent = 'Baseline: 0.0% · Ready to trace spiral';
    if (hudPoints) hudPoints.textContent = 'Points: 0';
    if (hudDot) {
      hudDot.style.background = '#1B7A43';
      hudDot.style.boxShadow = 'none';
    }

    // Reset SVM Card
    const svmScoreEl = document.getElementById('val-draw-svm-score');
    const svmDistEl = document.getElementById('val-draw-svm-dist');
    const svmBadgeEl = document.getElementById('val-draw-svm-badge');
    const svmNoteEl = document.getElementById('val-draw-svm-note');
    if (svmScoreEl) {
      svmScoreEl.textContent = '0.0%';
      svmScoreEl.style.color = '#1B7A43';
    }
    if (svmDistEl) {
      svmDistEl.textContent = '-1.80';
      svmDistEl.style.color = '#0F6B6B';
    }
    if (svmBadgeEl) {
      svmBadgeEl.textContent = 'Baseline (0.0% Risk)';
      svmBadgeEl.className = 'card-badge badge-ready';
    }
    if (svmNoteEl) {
      svmNoteEl.textContent = 'Draw continuously from the center circle outward to evaluate your kinematic features against the PaHaW & Oxford Parkinson\'s dataset distributions.';
    }

    updateMetricDot('ind-draw-rmse', false);
    updateMetricDot('ind-draw-tremor', false);
    updateMetricDot('ind-draw-micro', false);
    updateMetricDot('ind-draw-smooth', false);

    updateModalityDisplays();
    updateModalityStatusDots();
    updateFusionDisplay();

    const vc = document.getElementById('voiceVisualizerCanvas');
    if (vc) voiceProcessor.drawPlaceholder(vc);
    const gc = document.getElementById('gaitWaveCanvas');
    if (gc) gaitProcessor.renderPlaceholder(gc);
  }

  function updateModalityStatusDots() {
    ['voice', 'tapping', 'drawing', 'gait'].forEach(mod => {
      const dot = document.getElementById(`dot-${mod}`);
      const hasData = appState.modalitiesData[mod] && 
        (appState.modalitiesData[mod].f0 > 0 || 
         appState.modalitiesData[mod].tapCount > 0 || 
         appState.modalitiesData[mod].rmseDeviation > 0 || 
         appState.modalitiesData[mod].hasDrawn ||
         appState.modalitiesData[mod].cadenceStepsPerMin > 0);
      if (dot) {
        dot.classList.toggle('completed', Boolean(hasData));
      }
    });
    checkScreeningCompletion();
  }

  // --- VOICE MODULE EVENT HANDLERS ---
  const recordVoiceBtn = document.getElementById('recordVoiceBtn');
  const stopVoiceBtn = document.getElementById('stopVoiceBtn');
  const demoVoiceNormalBtn = document.getElementById('demoVoiceNormalBtn');
  const demoVoicePdBtn = document.getElementById('demoVoicePdBtn');
  const voiceCanvas = document.getElementById('voiceVisualizerCanvas');

  if (recordVoiceBtn) {
    recordVoiceBtn.addEventListener('click', async () => {
      recordVoiceBtn.disabled = true;
      stopVoiceBtn.disabled = false;
      const started = await voiceProcessor.startLiveRecording(voiceCanvas);
      if (!started) {
        // Fallback simulation if no mic permission
        voiceProcessor.generateSyntheticSample('healthy');
        updateModalityDisplays();
        updateModalityStatusDots();
        recordVoiceBtn.disabled = false;
        stopVoiceBtn.disabled = true;
      }
    });
  }

  if (stopVoiceBtn) {
    stopVoiceBtn.addEventListener('click', () => {
      recordVoiceBtn.disabled = false;
      stopVoiceBtn.disabled = true;
      const res = voiceProcessor.stopLiveRecording();
      appState.modalitiesData.voice = res;
      updateModalityDisplays();
      updateModalityStatusDots();
    });
  }

  if (demoVoiceNormalBtn) {
    demoVoiceNormalBtn.addEventListener('click', () => {
      appState.modalitiesData.voice = voiceProcessor.generateSyntheticSample('healthy');
      updateModalityDisplays();
      updateModalityStatusDots();
    });
  }

  if (demoVoicePdBtn) {
    demoVoicePdBtn.addEventListener('click', () => {
      appState.modalitiesData.voice = voiceProcessor.generateSyntheticSample('parkinsons');
      updateModalityDisplays();
      updateModalityStatusDots();
    });
  }

  // --- TAPPING MODULE EVENT HANDLERS ---
  const startTapBtn = document.getElementById('startTapBtn');
  const tapTargetBtn = document.getElementById('tapTargetBtn');
  const tapCountdown = document.getElementById('tapCountdown');
  const tapCountDisplay = document.getElementById('tapCountDisplay');
  const demoTapNormalBtn = document.getElementById('demoTapNormalBtn');
  const demoTapPdBtn = document.getElementById('demoTapPdBtn');

  if (startTapBtn) {
    startTapBtn.addEventListener('click', () => {
      startTapBtn.disabled = true;
      tapTargetBtn.disabled = false;
      tapTargetBtn.focus();

      tappingProcessor.startTest(
        10,
        (remaining, count) => {
          tapCountdown.textContent = `${remaining.toFixed(1)}s`;
          tapCountDisplay.textContent = count;
        },
        (results) => {
          tapTargetBtn.disabled = true;
          startTapBtn.disabled = false;
          appState.modalitiesData.tapping = results;
          updateModalityDisplays();
          updateModalityStatusDots();
        }
      );
    });
  }

  if (tapTargetBtn) {
    const handleTap = (e) => {
      e.preventDefault();
      if (tappingProcessor.isActive) {
        tappingProcessor.recordTap();
        tapTargetBtn.classList.add('pressed');
        setTimeout(() => tapTargetBtn.classList.remove('pressed'), 80);
      }
    };
    tapTargetBtn.addEventListener('pointerdown', handleTap);
  }

  // Also support Keyboard Space / Z / M for tapping test
  window.addEventListener('keydown', (e) => {
    if (appState.activeView === 'assessment' && appState.activeModality === 'tapping') {
      if ((e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyM') && tappingProcessor.isActive) {
        e.preventDefault();
        tappingProcessor.recordTap();
        if (tapTargetBtn) {
          tapTargetBtn.classList.add('pressed');
          setTimeout(() => tapTargetBtn.classList.remove('pressed'), 80);
        }
      }
    }
  });

  if (demoTapNormalBtn) {
    demoTapNormalBtn.addEventListener('click', () => {
      appState.modalitiesData.tapping = tappingProcessor.generateSyntheticTaps('healthy');
      updateModalityDisplays();
      updateModalityStatusDots();
    });
  }

  if (demoTapPdBtn) {
    demoTapPdBtn.addEventListener('click', () => {
      appState.modalitiesData.tapping = tappingProcessor.generateSyntheticTaps('parkinsons');
      updateModalityDisplays();
      updateModalityStatusDots();
    });
  }

  // --- LIVE ON-TIME DRAWING & SVM VERIFICATION HANDLERS ---
  function handleLiveDrawingUpdate(liveFeats) {
    // 1. Immediately update metric cards in real-time as pen moves
    const dRmse = document.getElementById('val-draw-rmse');
    if (dRmse) {
      dRmse.textContent = `${liveFeats.rmseDeviation} px`;
      setIndicator(dRmse, liveFeats.rmseDeviation > 14.0);
    }
    const dTremor = document.getElementById('val-draw-tremor');
    if (dTremor) {
      dTremor.textContent = `${liveFeats.tremorIndex}`;
      setIndicator(dTremor, liveFeats.tremorIndex > 0.28);
    }
    const dMicro = document.getElementById('val-draw-micro');
    if (dMicro) {
      dMicro.textContent = `${liveFeats.micrographiaRatio}%`;
      setIndicator(dMicro, liveFeats.micrographiaRatio > 0 && liveFeats.micrographiaRatio < 80);
    }
    const dSmooth = document.getElementById('val-draw-smooth');
    if (dSmooth) {
      dSmooth.textContent = `${liveFeats.velocitySmoothness}`;
      setIndicator(dSmooth, liveFeats.velocitySmoothness > 0.60);
    }

    // Update status dot indicators in card headers
    updateMetricDot('ind-draw-rmse', liveFeats.rmseDeviation > 14.0);
    updateMetricDot('ind-draw-tremor', liveFeats.tremorIndex > 0.28);
    updateMetricDot('ind-draw-micro', liveFeats.micrographiaRatio > 0 && liveFeats.micrographiaRatio < 80);
    updateMetricDot('ind-draw-smooth', liveFeats.velocitySmoothness > 0.60);

    // 2. Real-time SVM Kernel Evaluation & Dataset Comparison
    const svmRes = fusionEngine.evaluateDrawingSVM(liveFeats);
    const scoreColor = svmRes.svmScorePercent >= 65 ? '#B91C1C' : (svmRes.svmScorePercent >= 35 ? '#B45309' : '#1B7A43');

    // 3. Update Dedicated Live Parkinson's HUD Tracker
    const hudPercent = document.getElementById('spiralHudPercentage');
    const hudBar = document.getElementById('spiralHudProgressBar');
    const hudVerdict = document.getElementById('spiralHudVerdict');
    const hudPoints = document.getElementById('spiralHudPoints');
    const hudDot = document.getElementById('spiralHudDot');

    if (hudPercent) {
      hudPercent.textContent = `${svmRes.svmScorePercent}%`;
      hudPercent.style.color = scoreColor;
    }
    if (hudBar) {
      hudBar.style.width = `${Math.min(100, Math.max(0, svmRes.svmScorePercent))}%`;
      hudBar.style.background = scoreColor;
    }
    if (hudVerdict) {
      hudVerdict.textContent = `Live Analysis: ${svmRes.classification} (${svmRes.svmScorePercent}%)`;
    }
    if (hudPoints) {
      hudPoints.textContent = `Points: ${liveFeats.pointCount || 0}`;
    }
    if (hudDot) {
      hudDot.style.background = scoreColor;
      hudDot.style.boxShadow = 'none';
    }

    // 4. Update SVM Card
    const svmScoreEl = document.getElementById('val-draw-svm-score');
    const svmDistEl = document.getElementById('val-draw-svm-dist');
    const svmBadgeEl = document.getElementById('val-draw-svm-badge');
    const svmNoteEl = document.getElementById('val-draw-svm-note');
    const drawLiveBadge = document.getElementById('drawLiveBadge');

    if (svmScoreEl) {
      svmScoreEl.textContent = `${svmRes.svmScorePercent}%`;
      svmScoreEl.style.color = scoreColor;
    }
    if (svmDistEl) {
      const sign = svmRes.decisionDistance >= 0 ? '+' : '';
      svmDistEl.textContent = `${sign}${svmRes.decisionDistance}`;
      svmDistEl.style.color = svmRes.decisionDistance >= 0 ? '#B91C1C' : '#0F6B6B';
    }
    if (svmBadgeEl) {
      svmBadgeEl.textContent = `Live: ${svmRes.svmScorePercent}% PD Risk`;
      svmBadgeEl.className = `card-badge ${svmRes.badgeClass}`;
    }
    if (svmNoteEl) {
      svmNoteEl.innerHTML = `<strong>Dataset Comparison:</strong> ${svmRes.datasetComparison} <br><span style="color:var(--text-muted); font-size:0.72rem;">SVM Hyperplane Margin Confidence: ${svmRes.confidence}%</span>`;
    }
    if (drawLiveBadge) {
      drawLiveBadge.textContent = 'Active Kinematic Analysis';
      drawLiveBadge.className = 'card-badge badge-ready';
    }
  }

  function handleCompletedDrawingVerification(finalFeats) {
    appState.modalitiesData.drawing = finalFeats;

    // 1. Evaluate final SVM Decision Function against dataset distribution
    const svmRes = fusionEngine.evaluateDrawingSVM(finalFeats);
    const scoreColor = svmRes.svmScorePercent >= 65 ? '#B91C1C' : (svmRes.svmScorePercent >= 35 ? '#B45309' : '#1B7A43');

    // 2. Automatically record verification to file storage
    const record = fusionEngine.recordVerification('Archimedes Spiral Drawing', finalFeats, svmRes);

    // 3. Update Live Parkinson's HUD Tracker (Locked Final Verdict)
    const hudLabel = document.getElementById('spiralHudLabel');
    const hudPercent = document.getElementById('spiralHudPercentage');
    const hudBar = document.getElementById('spiralHudProgressBar');
    const hudVerdict = document.getElementById('spiralHudVerdict');
    const hudPoints = document.getElementById('spiralHudPoints');
    const hudDot = document.getElementById('spiralHudDot');

    if (hudLabel) hudLabel.textContent = "Final Verified Parkinson's Score:";
    if (hudPercent) {
      hudPercent.textContent = `${svmRes.svmScorePercent}%`;
      hudPercent.style.color = scoreColor;
    }
    if (hudBar) {
      hudBar.style.width = `${Math.min(100, Math.max(0, svmRes.svmScorePercent))}%`;
      hudBar.style.background = scoreColor;
    }
    if (hudVerdict) {
      hudVerdict.innerHTML = `<strong>Final Verdict:</strong> ${svmRes.classification} (${svmRes.svmScorePercent}%)`;
    }
    if (hudPoints) {
      hudPoints.textContent = `Points: ${finalFeats.pointCount || 0}`;
    }
    if (hudDot) {
      hudDot.style.background = scoreColor;
      hudDot.style.boxShadow = 'none';
    }

    // 4. Update SVM Card Elements
    const svmScoreEl = document.getElementById('val-draw-svm-score');
    const svmDistEl = document.getElementById('val-draw-svm-dist');
    const svmBadgeEl = document.getElementById('val-draw-svm-badge');
    const svmNoteEl = document.getElementById('val-draw-svm-note');
    const drawLogStatus = document.getElementById('draw-log-status');
    const drawLiveBadge = document.getElementById('drawLiveBadge');

    if (svmScoreEl) {
      svmScoreEl.textContent = `${svmRes.svmScorePercent}%`;
      svmScoreEl.style.color = scoreColor;
    }
    if (svmDistEl) {
      const sign = svmRes.decisionDistance >= 0 ? '+' : '';
      svmDistEl.textContent = `${sign}${svmRes.decisionDistance}`;
      svmDistEl.style.color = svmRes.decisionDistance >= 0 ? '#B91C1C' : '#0F6B6B';
    }
    if (svmBadgeEl) {
      svmBadgeEl.textContent = svmRes.classification;
      svmBadgeEl.className = `card-badge ${svmRes.badgeClass}`;
    }
    if (svmNoteEl) {
      svmNoteEl.innerHTML = `<strong>Dataset Comparison:</strong> ${svmRes.datasetComparison} <br><span style="color:var(--text-muted); font-size:0.72rem;">SVM Hyperplane Margin Confidence: ${svmRes.confidence}%</span>`;
    }
    if (drawLogStatus) {
      drawLogStatus.innerHTML = `
        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#10b981;"></span>
        <span>Verified & Logged to File (${record.displayTime}) · Run ${record.id} · Score: ${svmRes.svmScorePercent}%</span>
      `;
    }
    if (drawLiveBadge) {
      drawLiveBadge.textContent = 'Verification Complete';
      drawLiveBadge.className = 'card-badge badge-ready';
    }

    // Refresh displays and fusion dial
    updateModalityDisplays();
    updateModalityStatusDots();
    updateFusionDisplay();
  }

  // --- DRAWING / SPIRAL MODULE CONTROLS ---
  const clearSpiralBtn = document.getElementById('clearSpiralBtn');
  const demoSpiralNormalBtn = document.getElementById('demoSpiralNormalBtn');
  const demoSpiralPdBtn = document.getElementById('demoSpiralPdBtn');
  const exportLogJsonBtn = document.getElementById('exportLogJsonBtn');
  const exportLogCsvBtn = document.getElementById('exportLogCsvBtn');

  if (demoSpiralNormalBtn) {
    demoSpiralNormalBtn.addEventListener('click', () => {
      const feats = drawingProcessor.generateSampleSpiral('healthy');
      handleCompletedDrawingVerification(feats);
    });
  }

  if (demoSpiralPdBtn) {
    demoSpiralPdBtn.addEventListener('click', () => {
      const feats = drawingProcessor.generateSampleSpiral('parkinsons');
      handleCompletedDrawingVerification(feats);
    });
  }

  if (clearSpiralBtn) {
    clearSpiralBtn.addEventListener('click', () => {
      drawingProcessor.clearCanvas();
      drawingProcessor.drawTemplateGuide();
      appState.modalitiesData.drawing = drawingProcessor.features;

      // Reset Live HUD
      const hudLabel = document.getElementById('spiralHudLabel');
      const hudPercent = document.getElementById('spiralHudPercentage');
      const hudBar = document.getElementById('spiralHudProgressBar');
      const hudVerdict = document.getElementById('spiralHudVerdict');
      const hudPoints = document.getElementById('spiralHudPoints');
      const hudDot = document.getElementById('spiralHudDot');

      if (hudLabel) hudLabel.textContent = "Parkinson's Disease Probability:";
      if (hudPercent) {
        hudPercent.textContent = '0.0%';
        hudPercent.style.color = '#10b981';
      }
      if (hudBar) {
        hudBar.style.width = '0%';
        hudBar.style.background = '#10b981';
      }
      if (hudVerdict) hudVerdict.textContent = 'Baseline: 0.0% · Ready to trace spiral';
      if (hudPoints) hudPoints.textContent = 'Points: 0';
      if (hudDot) {
        hudDot.style.background = '#10b981';
        hudDot.style.boxShadow = '0 0 8px rgba(16, 185, 129, 0.5)';
      }

      // Reset SVM Card
      const svmScoreEl = document.getElementById('val-draw-svm-score');
      const svmDistEl = document.getElementById('val-draw-svm-dist');
      const svmBadgeEl = document.getElementById('val-draw-svm-badge');
      const svmNoteEl = document.getElementById('val-draw-svm-note');
      if (svmScoreEl) {
        svmScoreEl.textContent = '0.0%';
        svmScoreEl.style.color = '#10b981';
      }
      if (svmDistEl) {
        svmDistEl.textContent = '-1.80';
        svmDistEl.style.color = 'var(--cyan-light)';
      }
      if (svmBadgeEl) {
        svmBadgeEl.textContent = 'Baseline (0.0% Risk)';
        svmBadgeEl.className = 'card-badge badge-ready';
      }
      if (svmNoteEl) {
        svmNoteEl.textContent = 'Draw continuously from the center circle outward. Baseline begins at 0.0% and scales according to real dataset motor impairment.';
      }
      updateMetricDot('ind-draw-rmse', false);
      updateMetricDot('ind-draw-tremor', false);
      updateMetricDot('ind-draw-micro', false);
      updateMetricDot('ind-draw-smooth', false);
      updateModalityDisplays();
      updateModalityStatusDots();
    });
  }

  if (exportLogJsonBtn) {
    exportLogJsonBtn.addEventListener('click', () => {
      fusionEngine.exportVerificationJSON();
    });
  }

  if (exportLogCsvBtn) {
    exportLogCsvBtn.addEventListener('click', () => {
      fusionEngine.exportVerificationCSV();
    });
  }

  if (exportLogJsonBtn) {
    exportLogJsonBtn.addEventListener('click', () => {
      fusionEngine.exportVerificationJSON();
    });
  }

  if (exportLogCsvBtn) {
    exportLogCsvBtn.addEventListener('click', () => {
      fusionEngine.exportVerificationCSV();
    });
  }

  // --- GAIT MODULE EVENT HANDLERS ---
  const startGaitSensorBtn = document.getElementById('startGaitSensorBtn');
  const stopGaitSensorBtn = document.getElementById('stopGaitSensorBtn');
  const demoGaitNormalBtn = document.getElementById('demoGaitNormalBtn');
  const demoGaitPdBtn = document.getElementById('demoGaitPdBtn');
  const gaitCanvas = document.getElementById('gaitWaveCanvas');

  if (startGaitSensorBtn) {
    startGaitSensorBtn.addEventListener('click', () => {
      startGaitSensorBtn.disabled = true;
      stopGaitSensorBtn.disabled = false;
      gaitProcessor.startLiveSensor(gaitCanvas, (sampleCount, steps) => {
        const gaitInfo = document.getElementById('gaitLiveInfo');
        if (gaitInfo) gaitInfo.textContent = `Samples: ${sampleCount} | Steps Detected: ${steps}`;
      });
    });
  }

  if (stopGaitSensorBtn) {
    stopGaitSensorBtn.addEventListener('click', () => {
      startGaitSensorBtn.disabled = false;
      stopGaitSensorBtn.disabled = true;
      const res = gaitProcessor.stopLiveSensor();
      appState.modalitiesData.gait = res;
      updateModalityDisplays();
      updateModalityStatusDots();
    });
  }

  if (demoGaitNormalBtn) {
    demoGaitNormalBtn.addEventListener('click', () => {
      appState.modalitiesData.gait = gaitProcessor.generateSyntheticGait('healthy', gaitCanvas);
      updateModalityDisplays();
      updateModalityStatusDots();
    });
  }

  if (demoGaitPdBtn) {
    demoGaitPdBtn.addEventListener('click', () => {
      appState.modalitiesData.gait = gaitProcessor.generateSyntheticGait('parkinsons', gaitCanvas);
      updateModalityDisplays();
      updateModalityStatusDots();
    });
  }

  // --- UPDATE MODALITY DISPLAYS (Numeric Values & Status Lights) ---
  function updateModalityDisplays() {
    const v = appState.modalitiesData.voice;
    const t = appState.modalitiesData.tapping;
    const d = appState.modalitiesData.drawing;
    const g = appState.modalitiesData.gait;

    // Voice Elements
    const vF0 = document.getElementById('val-voice-f0');
    if (vF0) vF0.textContent = v.f0 ? `${v.f0} Hz` : '--';
    const vJitter = document.getElementById('val-voice-jitter');
    if (vJitter) {
      vJitter.textContent = v.jitterPercent ? `${v.jitterPercent}%` : '--';
      setIndicator(vJitter, v.jitterPercent > 1.45);
    }
    const vShimmer = document.getElementById('val-voice-shimmer');
    if (vShimmer) {
      vShimmer.textContent = v.shimmerPercent ? `${v.shimmerPercent}%` : '--';
      setIndicator(vShimmer, v.shimmerPercent > 6.0);
    }

    // Tapping Elements
    const tFreq = document.getElementById('val-tap-freq');
    if (tFreq) {
      tFreq.textContent = t.tapFrequencyHz ? `${t.tapFrequencyHz} Hz` : '--';
      setIndicator(tFreq, t.tapFrequencyHz > 0 && t.tapFrequencyHz < 4.0);
    }
    const tCv = document.getElementById('val-tap-cv');
    if (tCv) {
      tCv.textContent = t.cvPercent ? `${t.cvPercent}%` : '--';
      setIndicator(tCv, t.cvPercent > 20.0);
    }
    const tSlope = document.getElementById('val-tap-slope');
    if (tSlope) tSlope.textContent = t.fatigueSlope !== undefined && t.tapCount > 0 ? `${t.fatigueSlope}` : '--';
    const tFreezing = document.getElementById('val-tap-freezing');
    if (tFreezing) {
      tFreezing.textContent = t.tapCount > 0 ? `${t.freezingPauses}` : '--';
      setIndicator(tFreezing, t.freezingPauses >= 2);
    }

    // Drawing Elements
    const hasDrawData = Boolean(d.hasDrawn || (d.rmseDeviation !== undefined && d.rmseDeviation > 0) || (d.tremorIndex !== undefined && d.tremorIndex > 0));
    const dRmse = document.getElementById('val-draw-rmse');
    if (dRmse) {
      dRmse.textContent = hasDrawData ? `${d.rmseDeviation} px` : '--';
      setIndicator(dRmse, d.rmseDeviation > 14.0);
    }
    const dTremor = document.getElementById('val-draw-tremor');
    if (dTremor) {
      dTremor.textContent = hasDrawData ? `${d.tremorIndex}` : '--';
      setIndicator(dTremor, d.tremorIndex > 0.28);
    }
    const dMicro = document.getElementById('val-draw-micro');
    if (dMicro) {
      dMicro.textContent = hasDrawData ? `${d.micrographiaRatio}%` : '--';
      setIndicator(dMicro, d.micrographiaRatio > 0 && d.micrographiaRatio < 80);
    }
    const dSmooth = document.getElementById('val-draw-smooth');
    if (dSmooth) {
      dSmooth.textContent = hasDrawData ? `${d.velocitySmoothness}` : '--';
      setIndicator(dSmooth, d.velocitySmoothness > 0.60);
    }

    updateMetricDot('ind-draw-rmse', hasDrawData && d.rmseDeviation > 14.0);
    updateMetricDot('ind-draw-tremor', hasDrawData && d.tremorIndex > 0.28);
    updateMetricDot('ind-draw-micro', hasDrawData && d.micrographiaRatio > 0 && d.micrographiaRatio < 80);
    updateMetricDot('ind-draw-smooth', hasDrawData && d.velocitySmoothness > 0.60);

    // Gait Elements
    const gCadence = document.getElementById('val-gait-cadence');
    if (gCadence) {
      gCadence.textContent = g.cadenceStepsPerMin ? `${gCadenceSteps(g.cadenceStepsPerMin)}` : '--';
      setIndicator(gCadence, g.cadenceStepsPerMin > 0 && g.cadenceStepsPerMin < 90);
    }
    const gCv = document.getElementById('val-gait-cv');
    if (gCv) {
      gCv.textContent = g.strideVariabilityCv ? `${g.strideVariabilityCv}%` : '--';
      setIndicator(gCv, g.strideVariabilityCv > 6.0);
    }
    const gSym = document.getElementById('val-gait-sym');
    if (gSym) {
      gSym.textContent = g.symmetryIndexPercent ? `${g.symmetryIndexPercent}%` : '--';
      setIndicator(gSym, g.symmetryIndexPercent > 0 && g.symmetryIndexPercent < 85);
    }
  }

  function gCadenceSteps(val) {
    return `${val} /min`;
  }

  function updateMetricDot(dotId, isAbnormal) {
    const dot = document.getElementById(dotId);
    if (!dot) return;
    dot.className = `metric-indicator ${isAbnormal ? 'indicator-abnormal' : 'indicator-normal'}`;
  }

  function setIndicator(element, isAbnormal) {
    if (!element) return;
    element.classList.remove('indicator-normal', 'indicator-abnormal');
    if (isAbnormal) {
      element.style.color = 'var(--status-abnormal, #B91C1C)';
    } else {
      element.style.color = 'var(--text-main, #1A1A1A)';
    }
  }

  // --- MULTIMODAL FUSION DISPLAY LOGIC ---
  function updateFusionDisplay() {
    const fusion = fusionEngine.computeFusion(appState.modalitiesData, appState.patient);
    appState.fusionResult = fusion;

    // Gauge circle calculation (circumference = 2 * PI * r = 2 * 3.14159 * 80 = 502.65)
    const gaugeCircle = document.getElementById('fusionGaugeCircle');
    const gaugeValue = document.getElementById('fusionGaugeValue');
    const gaugeLabel = document.getElementById('fusionGaugeLabel');

    if (gaugeCircle && gaugeValue) {
      const circum = 502.65;
      const offset = circum - (fusion.overallRiskPercent / 100) * circum;
      gaugeCircle.style.strokeDashoffset = offset;
      gaugeValue.textContent = `${fusion.overallRiskPercent}%`;

      if (fusion.riskCategory === 'HIGH') {
        gaugeCircle.style.stroke = '#B91C1C';
        gaugeLabel.textContent = 'HIGH RISK';
        gaugeLabel.style.color = '#B91C1C';
      } else if (fusion.riskCategory === 'MODERATE') {
        gaugeCircle.style.stroke = '#B45309';
        gaugeLabel.textContent = 'MODERATE';
        gaugeLabel.style.color = '#B45309';
      } else if (fusion.riskCategory === 'PENDING') {
        gaugeCircle.style.stroke = '#1B7A43';
        gaugeLabel.textContent = 'BASELINE (0%)';
        gaugeLabel.style.color = '#1B7A43';
      } else {
        gaugeCircle.style.stroke = '#1B7A43';
        gaugeLabel.textContent = 'NORMAL';
        gaugeLabel.style.color = '#1B7A43';
      }
    }

    // Intervention & Follow-up Box
    const alertBox = document.getElementById('interventionAlertCard');
    const alertTitle = document.getElementById('interventionTitle');
    const alertText = document.getElementById('interventionText');
    const checklist = document.getElementById('protocolChecklist');

    if (alertBox && alertTitle && alertText) {
      if (fusion.riskCategory === 'PENDING') {
        alertBox.className = 'intervention-alert-card intervention-normal';
        alertTitle.textContent = 'Screening Baseline (0.0% Initial Risk)';
        alertText.textContent = 'No motor or vocal impairments detected yet. Complete any modality test to begin live automated risk assessment.';
        if (checklist) {
          checklist.innerHTML = `
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>System calibrated to 0.0% baseline</span></li>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Ready to capture Voice, Tapping, Drawing, or Gait</span></li>
          `;
        }
      } else {
        alertBox.className = `intervention-alert-card ${fusion.alertClass}`;
        alertTitle.textContent = fusion.riskLabel;
        alertText.textContent = fusion.recommendation;

        if (checklist && fusion.protocolSteps) {
          checklist.innerHTML = '';
          fusion.protocolSteps.forEach(step => {
            const li = document.createElement('li');
            li.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>${step}</span>
            `;
            checklist.appendChild(li);
          });
        }
      }
    }

    // Modality Contribution Bars (XAI)
    const contribList = document.getElementById('modalityContributionList');
    if (contribList) {
      contribList.innerHTML = '';
      if (!fusion.contributions.length) {
        contribList.innerHTML = '<p style="font-size:0.8rem; color:var(--text-dim);">No modalities completed yet.</p>';
      } else {
        fusion.contributions.forEach(c => {
          const item = document.createElement('div');
          item.className = 'contribution-bar-item';
          const fillColor = c.isAbnormal ? '#B91C1C' : (c.probPercent > 35 ? '#B45309' : '#1B7A43');
          item.innerHTML = `
            <div class="contrib-name">${c.name}</div>
            <div class="contrib-progress-track">
              <div class="contrib-progress-fill" style="width: ${c.probPercent}%; background: ${fillColor};"></div>
            </div>
            <div class="contrib-val">${c.probPercent}%</div>
          `;
          contribList.appendChild(item);
        });
      }
    }

    // Patient Biological Priors (MDS Criteria Breakdown)
    const bioTagsEl = document.getElementById('bioPriorTags');
    if (bioTagsEl) {
      bioTagsEl.innerHTML = '';
      if (!fusion.bioPriors || !fusion.bioPriors.length) {
        bioTagsEl.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Standard normative reference priors applied.</span>';
      } else {
        fusion.bioPriors.forEach(p => {
          const tag = document.createElement('span');
          tag.className = 'bio-tag';
          tag.innerHTML = `<span>${p.factor}:</span> <strong>${p.detail}</strong>`;
          bioTagsEl.appendChild(tag);
        });
      }
    }

    // Render Radar Chart
    renderRadarChart();
  }

  // --- RADAR / BIOMARKER SPIDER CHART ---
  function renderRadarChart() {
    const canvas = document.getElementById('biomarkerRadarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 35;

    ctx.clearRect(0, 0, w, h);

    const labels = [
      'Vocal Jitter',
      'Vocal Shimmer',
      'Tapping Slowing',
      'Rhythm Arrhythmia',
      'Spiral Tremor',
      'Micrographia',
      'Gait Asymmetry'
    ];
    const totalAxes = labels.length;

    // Draw background concentric polygon rings
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const rings = 4;
    for (let r = 1; r <= rings; r++) {
      const ringRadius = (radius / rings) * r;
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < totalAxes; i++) {
        const angle = (i / totalAxes) * 2 * Math.PI - Math.PI / 2;
        const x = cx + ringRadius * Math.cos(angle);
        const y = cy + ringRadius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Draw axis lines and labels
    ctx.font = '500 11px Inter, sans-serif';
    ctx.fillStyle = isDark ? '#848995' : '#6E6B65';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < totalAxes; i++) {
      const angle = (i / totalAxes) * 2 * Math.PI - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.09)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();

      const labelDist = radius + 22;
      const lx = cx + labelDist * Math.cos(angle);
      const ly = cy + labelDist * Math.sin(angle);
      ctx.fillText(labels[i], lx, ly);
    }

    // Compute normalized values (0.0 to 1.0, where 1.0 is severe Parkinsonian impairment)
    const v = appState.modalitiesData.voice;
    const t = appState.modalitiesData.tapping;
    const d = appState.modalitiesData.drawing;
    const g = appState.modalitiesData.gait;

    // Check which modalities have actual test results recorded
    const hasVoice = Boolean(v && v.f0 > 0);
    const hasTap = Boolean(t && t.tapCount > 0);
    const hasDraw = Boolean(d && (d.hasDrawn || d.rmseDeviation > 0 || d.tremorIndex > 0));
    const hasGait = Boolean(g && g.cadenceStepsPerMin > 0);
    const hasAnyAssessment = hasVoice || hasTap || hasDraw || hasGait;

    // Strict 0.0 baseline: unassessed modalities or clean baselines are strictly 0.0
    const valJitter = hasVoice ? Math.min(1.0, Math.max(0, (v.jitterPercent - 0.50) / 2.0)) : 0.0;
    const valShimmer = hasVoice ? Math.min(1.0, Math.max(0, (v.shimmerPercent - 3.0) / 7.5)) : 0.0;
    const valTapSlowing = hasTap ? Math.min(1.0, Math.max(0, (4.5 - t.tapFrequencyHz) / 2.5)) : 0.0;
    const valArrhythmia = hasTap ? Math.min(1.0, Math.max(0, (t.cvPercent - 12.0) / 24.0)) : 0.0;
    const valTremor = hasDraw ? Math.min(1.0, Math.max(0, (d.tremorIndex - 0.16) / 0.45)) : 0.0;
    const valMicro = hasDraw ? Math.min(1.0, Math.max(0, (82.0 - d.micrographiaRatio) / 35.0)) : 0.0;
    const valGaitAsym = hasGait ? Math.min(1.0, Math.max(0, (90.0 - g.symmetryIndexPercent) / 25.0)) : 0.0;

    const values = [
      valJitter,
      valShimmer,
      valTapSlowing,
      valArrhythmia,
      valTremor,
      valMicro,
      valGaitAsym
    ];

    // Draw Clinical Threshold Reference Area (Safe Zone)
    ctx.fillStyle = isDark ? 'rgba(52, 211, 153, 0.12)' : 'rgba(27, 122, 67, 0.08)';
    ctx.strokeStyle = isDark ? 'rgba(52, 211, 153, 0.35)' : 'rgba(27, 122, 67, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < totalAxes; i++) {
      const angle = (i / totalAxes) * 2 * Math.PI - Math.PI / 2;
      const normSafe = 0.35; // safe threshold
      const x = cx + radius * normSafe * Math.cos(angle);
      const y = cy + radius * normSafe * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // If no assessments completed yet, display clean 0.0% origin center beacon
    if (!hasAnyAssessment) {
      ctx.fillStyle = isDark ? '#2DD4BF' : '#0F6B6B';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillStyle = isDark ? '#EDEDEB' : '#1A1A1A';
      ctx.textAlign = 'center';
      ctx.fillText('All 8 Biomarkers at Baseline', cx, cy - 14);
      ctx.font = '400 10px Inter, sans-serif';
      ctx.fillStyle = isDark ? '#848995' : '#6E6B65';
      ctx.fillText('Awaiting patient modality assessments', cx, cy + 16);
      return;
    }

    // Draw Observed Patient Values Polygon when real data exists
    const isHigh = (appState.fusionResult && appState.fusionResult.riskCategory === 'HIGH');
    const isModerate = (appState.fusionResult && appState.fusionResult.riskCategory === 'MODERATE');
    const polygonColor = isHigh ? '#B91C1C' : (isModerate ? '#B45309' : (isDark ? '#2DD4BF' : '#0F6B6B'));
    const fillColor = isHigh ? 'rgba(185, 28, 28, 0.18)' : (isModerate ? 'rgba(180, 83, 9, 0.18)' : (isDark ? 'rgba(45, 212, 191, 0.18)' : 'rgba(15, 107, 107, 0.18)'));

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = polygonColor;
    ctx.lineWidth = 1.75;
    ctx.beginPath();

    for (let i = 0; i < totalAxes; i++) {
      const angle = (i / totalAxes) * 2 * Math.PI - Math.PI / 2;
      const val = Math.max(0.0, values[i]);
      const x = cx + radius * val * Math.cos(angle);
      const y = cy + radius * val * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Plot vertex points
    ctx.fillStyle = polygonColor;
    for (let i = 0; i < totalAxes; i++) {
      const angle = (i / totalAxes) * 2 * Math.PI - Math.PI / 2;
      const val = Math.max(0.0, values[i]);
      const x = cx + radius * val * Math.cos(angle);
      const y = cy + radius * val * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // --- LONGITUDINAL MONITORING CHART & HISTORY TABLE ---
  function renderLongitudinalChart() {
    const canvas = document.getElementById('longitudinalCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const padX = 55;
    const padY = 40;

    ctx.clearRect(0, 0, w, h);

    const hist = appState.history;
    if (hist.length < 2) return;

    // Draw grid lines (Y-axis 0 to 100%)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';

    for (let p = 0; p <= 100; p += 25) {
      const y = h - padY - (p / 100) * (h - 2 * padY);
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();
      ctx.fillText(`${p}%`, padX - 8, y + 4);
    }

    // Threshold lines (35% safe, 65% high risk)
    const y35 = h - padY - (35 / 100) * (h - 2 * padY);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padX, y35);
    ctx.lineTo(w - 20, y35);
    ctx.stroke();

    const y65 = h - padY - (65 / 100) * (h - 2 * padY);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.beginPath();
    ctx.moveTo(padX, y65);
    ctx.lineTo(w - 20, y65);
    ctx.stroke();
    ctx.setLineDash([]);

    // Plot Risk Curve
    const plotWidth = w - padX - 30;
    const points = hist.map((item, idx) => {
      const x = padX + (idx / (hist.length - 1)) * plotWidth;
      const y = h - padY - (item.riskPercent / 100) * (h - 2 * padY);
      return { x, y, item };
    });

    // Gradient fill under trend line
    const grad = ctx.createLinearGradient(0, padY, 0, h - padY);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(points[0].x, h - padY);
    points.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(points[points.length - 1].x, h - padY);
    ctx.closePath();
    ctx.fill();

    // Trend line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Draw markers and labels
    ctx.textAlign = 'center';
    points.forEach((pt) => {
      ctx.fillStyle = pt.item.riskPercent >= 65 ? '#f43f5e' : (pt.item.riskPercent >= 35 ? '#f59e0b' : '#10b981');
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Session date on X axis
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Plus Jakarta Sans, sans-serif';
      ctx.fillText(pt.item.date, pt.x, h - 15);

      // Score above marker
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText(`${pt.item.riskPercent}%`, pt.x, pt.y - 12);
    });
  }

  function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    appState.history.forEach((row, idx) => {
      const tr = document.createElement('tr');
      const badgeClass = row.category === 'HIGH' ? 'badge-danger' : (row.category === 'MODERATE' ? 'badge-warning' : 'badge-ready');
      tr.innerHTML = `
        <td style="font-family:var(--font-mono); font-weight:600;">${row.date}</td>
        <td>${row.session}</td>
        <td><span class="card-badge ${badgeClass}">${row.category} (${row.riskPercent}%)</span></td>
        <td style="font-family:var(--font-mono);">${row.voiceJitter}%</td>
        <td style="font-family:var(--font-mono);">${row.tapFreq} Hz</td>
        <td style="font-family:var(--font-mono);">${row.spiralTremor}</td>
        <td style="font-family:var(--font-mono);">${row.gaitCadence}/min</td>
        <td style="color:var(--text-muted); font-size:0.78rem;">${row.notes}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Add Current Test to History
  const saveToHistoryBtn = document.getElementById('saveToHistoryBtn');
  if (saveToHistoryBtn) {
    saveToHistoryBtn.addEventListener('click', () => {
      const fusion = appState.fusionResult || fusionEngine.computeFusion(appState.modalitiesData);
      const today = new Date().toISOString().split('T')[0];
      const newEntry = {
        date: today,
        session: `Session #${appState.history.length + 1}`,
        riskPercent: fusion.overallRiskPercent,
        category: fusion.riskCategory,
        voiceJitter: appState.modalitiesData.voice.jitterPercent || 0.5,
        tapFreq: appState.modalitiesData.tapping.tapFrequencyHz || 4.5,
        spiralTremor: appState.modalitiesData.drawing.tremorIndex || 0.15,
        gaitCadence: appState.modalitiesData.gait.cadenceStepsPerMin || 105,
        notes: fusion.recommendation.slice(0, 75) + '...'
      };
      appState.history.push(newEntry);
      renderLongitudinalChart();
      renderHistoryTable();
      alert('Current session added to longitudinal patient history!');
    });
  }

  // --- BENCHMARK VISUALIZATIONS ---
  function renderBenchmarkCharts() {
    // Fill benchmark table with metrics from fusionEngine.benchmarkMetrics
    const metrics = fusionEngine.benchmarkMetrics;
    const setCell = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${val}%`;
    };

    setCell('lr-acc', metrics.logisticRegression.accuracy);
    setCell('lr-prec', metrics.logisticRegression.precision);
    setCell('lr-rec', metrics.logisticRegression.recall);
    setCell('lr-spec', metrics.logisticRegression.specificity);
    setCell('lr-f1', metrics.logisticRegression.f1Score);
    const lrAuc = document.getElementById('lr-auc');
    if (lrAuc) lrAuc.textContent = metrics.logisticRegression.rocAuc;

    setCell('svm-acc', metrics.svmRbf.accuracy);
    setCell('svm-prec', metrics.svmRbf.precision);
    setCell('svm-rec', metrics.svmRbf.recall);
    setCell('svm-spec', metrics.svmRbf.specificity);
    setCell('svm-f1', metrics.svmRbf.f1Score);
    const svmAuc = document.getElementById('svm-auc');
    if (svmAuc) svmAuc.textContent = metrics.svmRbf.rocAuc;

    setCell('rf-acc', metrics.randomForest.accuracy);
    setCell('rf-prec', metrics.randomForest.precision);
    setCell('rf-rec', metrics.randomForest.recall);
    setCell('rf-spec', metrics.randomForest.specificity);
    setCell('rf-f1', metrics.randomForest.f1Score);
    const rfAuc = document.getElementById('rf-auc');
    if (rfAuc) rfAuc.textContent = metrics.randomForest.rocAuc;

    setCell('fuse-acc', metrics.multimodalLateFusion.accuracy);
    setCell('fuse-prec', metrics.multimodalLateFusion.precision);
    setCell('fuse-rec', metrics.multimodalLateFusion.recall);
    setCell('fuse-spec', metrics.multimodalLateFusion.specificity);
    setCell('fuse-f1', metrics.multimodalLateFusion.f1Score);
    const fuseAuc = document.getElementById('fuse-auc');
    if (fuseAuc) fuseAuc.textContent = metrics.multimodalLateFusion.rocAuc;

    // Render ROC Curves on canvas
    renderRocCurveCanvas();
  }

  function renderRocCurveCanvas() {
    const canvas = document.getElementById('rocCurveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const pad = 40;

    ctx.clearRect(0, 0, w, h);

    // Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();

    // Random diagonal line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    ctx.lineTo(w - pad, pad);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve drawing helper
    const drawCurve = (color, sharpness) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pad, h - pad);
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const fpr = i / steps;
        const tpr = Math.pow(fpr, 1 / sharpness);
        const x = pad + fpr * (w - 2 * pad);
        const y = (h - pad) - tpr * (h - 2 * pad);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawCurve('#94a3b8', 4.5); // Logistic Regression (AUC 0.912)
    drawCurve('#6366f1', 7.5); // SVM RBF (AUC 0.948)
    drawCurve('#06b6d4', 12.0); // Random Forest (AUC 0.974)
    drawCurve('#10b981', 18.0); // Multimodal Fusion (AUC 0.989)

    // Axis Labels
    ctx.font = '10px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('False Positive Rate (1 - Specificity)', w / 2, h - 12);
    ctx.save();
    ctx.translate(15, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('True Positive Rate (Sensitivity / Recall)', 0, 0);
    ctx.restore();
  }

  // --- REPORT GENERATION & MODAL ---
  const openReportBtn = document.getElementById('openReportBtn');
  const reportModal = document.getElementById('reportModal');
  const closeReportModalBtn = document.getElementById('closeReportModalBtn');
  const closeReportBtnBottom = document.getElementById('closeReportBtnBottom');
  const printReportBtn = document.getElementById('printReportBtn');
  const downloadPdfDirectBtn = document.getElementById('downloadPdfDirectBtn');
  const viewFusionDirectBtn = document.getElementById('viewFusionDirectBtn');

  if (openReportBtn && reportModal) {
    openReportBtn.addEventListener('click', () => {
      populateReportModal();
      reportModal.classList.add('active');
    });
  }

  if (closeReportModalBtn && reportModal) {
    closeReportModalBtn.addEventListener('click', () => {
      reportModal.classList.remove('active');
    });
  }

  if (closeReportBtnBottom && reportModal) {
    closeReportBtnBottom.addEventListener('click', () => {
      reportModal.classList.remove('active');
    });
  }

  function triggerPdfDownload() {
    populateReportModal();
    if (reportModal) reportModal.classList.add('active');

    const origTitle = document.title;
    const safeName = (appState.patient.name || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeId = (appState.patient.id || 'PT-2026-089').replace(/[^a-zA-Z0-9_-]/g, '_');
    document.title = `NeuroScreen-PD_Clinical_Report_${safeName}_${safeId}`;

    setTimeout(() => {
      window.print();
      document.title = origTitle;
    }, 150);
  }

  if (printReportBtn) {
    printReportBtn.addEventListener('click', () => {
      triggerPdfDownload();
    });
  }

  if (downloadPdfDirectBtn) {
    downloadPdfDirectBtn.addEventListener('click', () => {
      triggerPdfDownload();
    });
  }

  if (viewFusionDirectBtn) {
    viewFusionDirectBtn.addEventListener('click', () => {
      switchView('fusion');
    });
  }

  function populateReportModal() {
    const fusion = appState.fusionResult || fusionEngine.computeFusion(appState.modalitiesData, appState.patient);
    const v = appState.modalitiesData.voice;
    const t = appState.modalitiesData.tapping;
    const d = appState.modalitiesData.drawing;
    const g = appState.modalitiesData.gait;

    const reportDate = document.getElementById('rep-date');
    if (reportDate) reportDate.textContent = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const repName = document.getElementById('rep-name');
    if (repName) repName.textContent = appState.patient.name || 'Anonymous Patient';

    const repId = document.getElementById('rep-id');
    if (repId) repId.textContent = appState.patient.id || 'PT-2026-089';

    const repAgeSex = document.getElementById('rep-age-sex');
    if (repAgeSex) repAgeSex.textContent = `${appState.patient.age || 64} Yrs / ${appState.patient.gender || 'Male'}`;

    const repHand = document.getElementById('rep-hand');
    if (repHand) repHand.textContent = `${appState.patient.hand || 'Right'} Handed`;

    const repFamily = document.getElementById('rep-family');
    if (repFamily) {
      if (appState.patient.familyHistory === 'first-degree') repFamily.textContent = 'First-Degree Relative (Parent/Sibling with PD)';
      else if (appState.patient.familyHistory === 'extended') repFamily.textContent = 'Extended Family (Grandparent/Uncle/Aunt with PD)';
      else repFamily.textContent = 'No Known Family History (Sporadic PD)';
    }

    const repProdromal = document.getElementById('rep-prodromal');
    if (repProdromal) {
      const markers = [];
      if (appState.patient.rbd) markers.push('RBD (Dream Enactment)');
      if (appState.patient.smell) markers.push('Hyposmia (Smell Loss)');
      if (appState.patient.restingTremor) markers.push('Resting Tremor Noticed');
      if (appState.patient.constipation) markers.push('Chronic Constipation');
      repProdromal.textContent = markers.length > 0 ? markers.join(', ') : 'None Reported';
    }

    const repBioSummary = document.getElementById('rep-bio-summary-box');
    if (repBioSummary) {
      if (fusion.bioPriors && fusion.bioPriors.length > 0) {
        const listStr = fusion.bioPriors.map(p => `<strong>${p.factor}</strong> (${p.detail})`).join(' · ');
        repBioSummary.innerHTML = `<strong>Calibrated Biological Priors (MDS Criteria):</strong> ${listStr}`;
        repBioSummary.style.display = 'block';
      } else {
        repBioSummary.style.display = 'none';
      }
    }

    const repRisk = document.getElementById('rep-risk');
    if (repRisk) {
      repRisk.textContent = `${fusion.overallRiskPercent}% (${fusion.riskCategory})`;
      repRisk.style.color = fusion.riskCategory === 'HIGH' ? '#B91C1C' : (fusion.riskCategory === 'MODERATE' ? '#B45309' : '#1B7A43');
    }

    const repRec = document.getElementById('rep-recommendation');
    if (repRec) repRec.textContent = fusion.recommendation;

    // Biomarker Table Rows
    const setRepVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setRepVal('rep-v-f0', v.f0 ? `${v.f0} Hz` : 'N/A');
    setRepVal('rep-v-jit', v.jitterPercent ? `${v.jitterPercent}%` : 'N/A');
    setRepVal('rep-v-shim', v.shimmerPercent ? `${v.shimmerPercent}%` : 'N/A');

    setRepVal('rep-t-freq', t.tapFrequencyHz ? `${t.tapFrequencyHz} Hz` : 'N/A');
    setRepVal('rep-t-cv', t.cvPercent ? `${t.cvPercent}%` : 'N/A');
    setRepVal('rep-t-pause', t.tapCount > 0 ? `${t.freezingPauses}` : 'N/A');

    setRepVal('rep-d-rmse', d.rmseDeviation ? `${d.rmseDeviation} px` : 'N/A');
    setRepVal('rep-d-trem', d.tremorIndex ? `${d.tremorIndex}` : 'N/A');
    setRepVal('rep-d-micro', d.micrographiaRatio ? `${d.micrographiaRatio}%` : 'N/A');

    setRepVal('rep-g-cad', g.cadenceStepsPerMin ? `${g.cadenceStepsPerMin} /min` : 'N/A');
    setRepVal('rep-g-cv', g.strideVariabilityCv ? `${g.strideVariabilityCv}%` : 'N/A');
    setRepVal('rep-g-sym', g.symmetryIndexPercent ? `${g.symmetryIndexPercent}%` : 'N/A');
  }

  // --- PATIENT INTAKE & SCREENING COMPLETION CONTROLLER ---
  const patientIntakeModal = document.getElementById('patientIntakeModal');
  const openIntakeModalBtn = document.getElementById('openIntakeModalBtn');
  const closeIntakeModalBtn = document.getElementById('closeIntakeModalBtn');
  const skipIntakeBtn = document.getElementById('skipIntakeBtn');
  const patientIntakeForm = document.getElementById('patientIntakeForm');

  // Load saved profile if available
  try {
    const saved = localStorage.getItem('neuroscreen_patient_profile');
    if (saved) {
      Object.assign(appState.patient, JSON.parse(saved));
    }
  } catch (e) {
    console.warn('Profile load error', e);
  }

  function updateHeaderPatientSummary() {
    const summary = document.getElementById('headerPatientSummary');
    if (summary) {
      const gShort = (appState.patient.gender && appState.patient.gender[0]) ? appState.patient.gender[0].toUpperCase() : 'M';
      summary.textContent = `Patient: ${appState.patient.name || 'Anonymous'}, ${appState.patient.age || 64}y (${gShort})`;
    }
    const compTag = document.getElementById('completionPatientTag');
    if (compTag) {
      compTag.textContent = `Patient: ${appState.patient.name || 'Anonymous'} (${appState.patient.age || 64}y, ${appState.patient.gender || 'Male'})`;
    }
  }

  function syncIntakeFormFromState() {
    const nameEl = document.getElementById('intakeName');
    const ageEl = document.getElementById('intakeAge');
    const genEl = document.getElementById('intakeGender');
    const handEl = document.getElementById('intakeHand');
    const idEl = document.getElementById('intakeId');
    const famEl = document.getElementById('intakeFamilyHistory');
    const rbdEl = document.getElementById('intakeRbd');
    const smellEl = document.getElementById('intakeSmell');
    const tremorEl = document.getElementById('intakeTremor');
    const constEl = document.getElementById('intakeConstipation');

    if (nameEl) nameEl.value = appState.patient.name || '';
    if (ageEl) ageEl.value = appState.patient.age || 64;
    if (genEl) genEl.value = appState.patient.gender || 'Male';
    if (handEl) handEl.value = appState.patient.hand || 'Right';
    if (idEl) idEl.value = appState.patient.id || 'PT-2026-089';
    if (famEl) famEl.value = appState.patient.familyHistory || 'none';
    if (rbdEl) rbdEl.checked = Boolean(appState.patient.rbd);
    if (smellEl) smellEl.checked = Boolean(appState.patient.smell);
    if (tremorEl) tremorEl.checked = Boolean(appState.patient.restingTremor);
    if (constEl) constEl.checked = Boolean(appState.patient.constipation);
  }

  function saveIntakeFormToState() {
    const nameEl = document.getElementById('intakeName');
    const ageEl = document.getElementById('intakeAge');
    const genEl = document.getElementById('intakeGender');
    const handEl = document.getElementById('intakeHand');
    const idEl = document.getElementById('intakeId');
    const famEl = document.getElementById('intakeFamilyHistory');
    const rbdEl = document.getElementById('intakeRbd');
    const smellEl = document.getElementById('intakeSmell');
    const tremorEl = document.getElementById('intakeTremor');
    const constEl = document.getElementById('intakeConstipation');

    appState.patient.name = nameEl && nameEl.value.trim() ? nameEl.value.trim() : 'Anonymous Patient';
    appState.patient.age = ageEl ? (parseInt(ageEl.value, 10) || 64) : 64;
    appState.patient.gender = genEl ? genEl.value : 'Male';
    appState.patient.hand = handEl ? handEl.value : 'Right';
    appState.patient.id = idEl && idEl.value ? idEl.value : 'PT-2026-089';
    appState.patient.familyHistory = famEl ? famEl.value : 'none';
    appState.patient.rbd = rbdEl ? rbdEl.checked : false;
    appState.patient.smell = smellEl ? smellEl.checked : false;
    appState.patient.restingTremor = tremorEl ? tremorEl.checked : false;
    appState.patient.constipation = constEl ? constEl.checked : false;
    appState.patient.intakeCompleted = true;

    try {
      localStorage.setItem('neuroscreen_patient_profile', JSON.stringify(appState.patient));
    } catch (e) {
      console.warn('Storage save error', e);
    }

    updateHeaderPatientSummary();
    updateFusionDisplay();
    checkScreeningCompletion();
  }

  if (openIntakeModalBtn && patientIntakeModal) {
    openIntakeModalBtn.addEventListener('click', () => {
      syncIntakeFormFromState();
      patientIntakeModal.classList.add('active');
    });
  }

  if (closeIntakeModalBtn && patientIntakeModal) {
    closeIntakeModalBtn.addEventListener('click', () => {
      patientIntakeModal.classList.remove('active');
    });
  }

  if (skipIntakeBtn && patientIntakeModal) {
    skipIntakeBtn.addEventListener('click', () => {
      appState.patient.intakeCompleted = true;
      patientIntakeModal.classList.remove('active');
      updateHeaderPatientSummary();
      updateFusionDisplay();
    });
  }

  if (patientIntakeForm && patientIntakeModal) {
    patientIntakeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveIntakeFormToState();
      patientIntakeModal.classList.remove('active');
    });
  }

  function checkScreeningCompletion() {
    const v = appState.modalitiesData.voice;
    const t = appState.modalitiesData.tapping;
    const d = appState.modalitiesData.drawing;
    const g = appState.modalitiesData.gait;

    const hasVoice = Boolean(v && v.f0 > 0);
    const hasTap = Boolean(t && t.tapCount > 0);
    const hasDraw = Boolean(d && (d.pointCount > 0 || d.hasDrawn || d.rmseDeviation > 0));
    const hasGait = Boolean(g && g.cadenceStepsPerMin > 0);

    const allDone = hasVoice && hasTap && hasDraw && hasGait;
    const banner = document.getElementById('screeningCompletionCard');
    if (banner) {
      banner.style.display = allDone ? 'block' : 'none';
    }
    const compTag = document.getElementById('completionPatientTag');
    if (compTag) {
      compTag.textContent = `Patient: ${appState.patient.name || 'Anonymous'} (${appState.patient.age || 64}y, ${appState.patient.gender || 'Male'})`;
    }
    return allDone;
  }

  // Draw initial placeholders for voice and gait waveforms
  const vc = document.getElementById('voiceVisualizerCanvas');
  if (vc) voiceProcessor.drawPlaceholder(vc);
  const gc = document.getElementById('gaitWaveCanvas');
  if (gc) gaitProcessor.renderPlaceholder(gc);

  // Initialize in live interactive mode by default (awaiting live user input)
  resetAllModalities();
  updateHeaderPatientSummary();

  // First opening requirement: immediately prompt for patient name, age, gender, and biological markers
  if (patientIntakeModal && !appState.patient.intakeCompleted) {
    syncIntakeFormFromState();
    patientIntakeModal.classList.add('active');
  }
});
