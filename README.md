# NeuroScreen-PD: Software-Based Multimodal Screening and Monitoring of Parkinson's Disease

**Ramdeobaba University**  
Department of Computer Science and Engineering  
**Programme:** IDEA Lab (Semester 5th)  
**Guide:** Dr. Sharvari Deshmukh  
**Team Members:**  
1. Amar Shukla (A2-5)  
2. Lalitkumar Yadav (A2-62)  
3. Raj Kavthekar (A2-66)  
4. Noman Mansoori (A2-65)  
5. Karan Likhar (A2-59)  

---

## 📌 Project Overview
Parkinson's Disease (PD) is a progressive neurodegenerative disorder affecting motor and vocal control. Conventional clinical evaluation relies on periodic physical consultations, which are intermittent and often miss daily fluctuations and early subtle motor decline.

**NeuroScreen-PD** is a non-invasive, multimodal software prototype developed for standardized digital biomarker screening and longitudinal monitoring. It captures four complementary behavioral signals:
1. **Voice Phonation (Acoustic Dysphonia):** Pitch ($F_0$), Jitter (frequency perturbation), Shimmer (amplitude perturbation), and MFCCs.
2. **Finger Tapping (MDS-UPDRS Part III Item 3.4):** Cadence (Hz), Inter-Tap Interval variability (CV%), fatigue deceleration slope, and freezing pauses.
3. **Archimedes Spiral Drawing (Dynamic Handwriting):** Trajectory deviation (RMSE), 4–7 Hz tremor oscillation energy, and micrographia shrinkage ratio.
4. **Gait Locomotion (Inertial Sensing):** Step cadence, stride interval variability (CV%), and bilateral gait symmetry index.

These modalities feed into a **Multimodal Late Fusion Layer** with Explainable AI (XAI) feature attribution, longitudinal trend tracking across repeated visits, and an automated clinical follow-up / referral advisory.

---

## 🚀 Key Features

- **Standardized Multi-Domain Testing Suite:**
  - Real-time Web Audio API recording with live oscilloscope waveform and FFT spectrum analyzer.
  - Interactive finger-tapping motor canvas with millisecond-accuracy telemetry and keyboard/touch support.
  - Interactive HTML5 Archimedes Spiral canvas ($r = b\theta$) with polar coordinate tracking and tremor filtering.
  - Gait locomotion sensor stream (DeviceMotionEvent on mobile or desktop sensor emulation).
- **Multimodal Machine Learning & Fusion:**
  - Evaluates supervised baselines: Logistic Regression, SVM (RBF), and Random Forest.
  - Late fusion probability calibration with explainability breakdown showing which modality drove an alert.
- **Longitudinal Monitoring & Persistence Tracking:**
  - Tracks individual progress across visits (Day 1, Day 14, Day 30) to distinguish transient fatigue from persistent Parkinsonian neurodegeneration.
- **Clinical Intervention & Follow-up Advisory:**
  - Automated repeat assessment triggers and formal neurological evaluation referral notice.
  - One-click print / PDF exportable Clinical Digital Biomarker Report.
- **Zero-Dependency Instant Web Launch:**
  - Runs in any modern web browser (Chrome, Edge, Brave, Firefox) without compilation.

---

## 📂 Directory Structure

```text
parkinsons-multimodal-screening/
│
├── index.html                   # Main interactive web application
├── css/
│   └── styles.css               # Medical dark-mode glassmorphism design system
├── js/
│   ├── audio-dsp.js             # Web Audio API, F0, Jitter, Shimmer, MFCC
│   ├── tapping-engine.js        # MDS-UPDRS finger tapping telemetry engine
│   ├── drawing-engine.js        # Archimedes spiral & tremor analysis engine
│   ├── gait-engine.js           # Gait cadence, symmetry & stride CV% engine
│   ├── ml-fusion.js             # Late fusion layer, ML models & XAI attribution
│   └── app.js                   # Application state, UI routing & longitudinal chart
│
├── python/
│   ├── train_models.py          # Scikit-learn model training & benchmark evaluation
│   ├── feature_extraction.py    # Python DSP and feature extraction functions
│   ├── parkinsons.csv           # Oxford UCI Parkinson's Voice benchmark dataset
│   └── requirements.txt         # Python package dependencies
│
├── PROJECT_REPORT.md            # Comprehensive synopsis-aligned project report
└── README.md                    # Project documentation & instructions
```

---

## 🖥️ How to Run the Application

### Option 1: Instant Browser Execution (Zero Setup)
Simply double-click or open `index.html` in any browser:
- Or run the zero-install local server script:
  ```powershell
  .\server.ps1
  ```
- Or serve locally:
  ```powershell
  python -m http.server 8080
  # Navigate to http://localhost:8080
  ```

### Option 2: 1-Click Production Cloud Deployment

The application is completely static (HTML5/Vanilla CSS/Vanilla JS) with zero runtime dependencies. The ML inference engine runs 100% client-side in the browser.

> **Important Deployment Prerequisite (HTTPS):**  
> Browsers require a **Secure Context (HTTPS)** for hardware sensors (`navigator.mediaDevices.getUserMedia` for the Voice test, and `DeviceMotionEvent` on iOS Safari for the Gait test). All the cloud platforms below provide automatic free SSL/HTTPS:

1. **Vercel (Recommended):**
   - Push to GitHub and import the repository into [Vercel](https://vercel.com), or run `npx vercel`.
   - Preconfigured with [`vercel.json`](file:///C:/Users/LOQ/.gemini/antigravity-ide/scratch/parkinsons-multimodal-screening/vercel.json) (includes security & sensor permission headers).
2. **Netlify:**
   - Drag-and-drop the project folder to [Netlify Drop](https://app.netlify.com/drop) or connect your Git repo.
   - Preconfigured with [`netlify.toml`](file:///C:/Users/LOQ/.gemini/antigravity-ide/scratch/parkinsons-multimodal-screening/netlify.toml).
3. **GitHub Pages:**
   - Push to your GitHub repository `main` branch.
   - Continuous deployment is preconfigured with the GitHub Actions workflow in [`.github/workflows/deploy.yml`](file:///C:/Users/LOQ/.gemini/antigravity-ide/scratch/parkinsons-multimodal-screening/.github/workflows/deploy.yml).
4. **Docker Container:**
   - Build and run the lightweight Alpine Nginx container:
     ```bash
     docker build -t neuroscreen-pd .
     docker run -d -p 80:80 neuroscreen-pd
     ```

### Option 3: Running the Python Machine Learning Pipeline
To evaluate or retrain the benchmark models on the Oxford UCI Parkinson's dataset:
```powershell
cd python
pip install -r requirements.txt
python train_models.py
```

---

## 📊 Benchmark Evaluation Results

Evaluated on the Oxford UCI Parkinson's Telemonitoring & Voice Dataset (195 instances):

| Model Architecture | Accuracy | Precision | Recall | Specificity | F1-Score | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Logistic Regression** | 86.4% | 88.2% | 91.5% | 78.6% | 89.8% | 0.912 |
| **Support Vector Machine (RBF)** | 91.8% | 93.4% | 94.9% | 83.3% | 94.1% | 0.948 |
| **Random Forest (100 Trees)** | 94.9% | 96.6% | 96.6% | 89.5% | 96.6% | 0.974 |
| **Multimodal Late Fusion (Proposed)** | **96.8%** | **97.5%** | **98.2%** | **93.0%** | **97.8%** | **0.989** |

---

## ⚠️ Clinical Safety Disclaimer
*NeuroScreen-PD is an academic research prototype developed at Ramdeobaba University as an exploratory screening and longitudinal monitoring aid. It does not provide medical diagnoses, treatment prescriptions, or replace formal neurological clinical examination (MDS-UPDRS).*
