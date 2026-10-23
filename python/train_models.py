#!/usr/bin/env python3
"""
NeuroScreen-PD: Machine Learning Model Training & Evaluation Pipeline
Dataset: Oxford Parkinson's Disease Detection Dataset (Little et al., 2009)
Ramdeobaba University - Department of Computer Science & Engineering
IDEA Lab Project - Semester 5th
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report
)

def load_data(filepath="parkinsons.csv"):
    if not os.path.exists(filepath):
        # Check in current dir or script dir
        script_dir = os.path.dirname(os.path.abspath(__file__))
        alt_path = os.path.join(script_dir, filepath)
        if os.path.exists(alt_path):
            filepath = alt_path
        else:
            raise FileNotFoundError(f"Dataset file {filepath} not found.")

    df = pd.read_csv(filepath)
    print(f"[+] Loaded dataset successfully: {df.shape[0]} rows, {df.shape[1]} columns.")
    
    # Feature columns (exclude subject name and status target)
    feature_cols = [c for c in df.columns if c not in ['name', 'status']]
    X = df[feature_cols].values
    y = df['status'].values
    return X, y, feature_cols

def train_and_evaluate():
    X, y, feature_cols = load_data()

    # Stratified Train/Test split (80% train, 20% test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # Standard feature scaling
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 1. Logistic Regression Baseline
    lr = LogisticRegression(max_iter=1000, random_state=42)
    lr.fit(X_train_scaled, y_train)
    y_pred_lr = lr.predict(X_test_scaled)
    y_prob_lr = lr.predict_proba(X_test_scaled)[:, 1]

    # 2. Support Vector Machine (RBF Kernel)
    svm = SVC(kernel='rbf', probability=True, C=2.0, gamma='scale', random_state=42)
    svm.fit(X_train_scaled, y_train)
    y_pred_svm = svm.predict(X_test_scaled)
    y_prob_svm = svm.predict_proba(X_test_scaled)[:, 1]

    # 3. Random Forest Classifier
    rf = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    rf.fit(X_train, y_train) # Tree models do not strictly require scaling
    y_pred_rf = rf.predict(X_test)
    y_prob_rf = rf.predict_proba(X_test)[:, 1]

    # 4. Multimodal / Ensemble Late Fusion (Soft-Voting weighted combination)
    y_prob_fusion = (0.25 * y_prob_lr) + (0.35 * y_prob_svm) + (0.40 * y_prob_rf)
    y_pred_fusion = (y_prob_fusion >= 0.50).astype(int)

    def compute_metrics(y_true, y_pred, y_prob):
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
        specificity = (tn / (tn + fp)) * 100 if (tn + fp) > 0 else 0
        return {
            "accuracy": round(accuracy_score(y_true, y_pred) * 100, 2),
            "precision": round(precision_score(y_true, y_pred, zero_division=0) * 100, 2),
            "recall": round(recall_score(y_true, y_pred, zero_division=0) * 100, 2),
            "specificity": round(specificity, 2),
            "f1Score": round(f1_score(y_true, y_pred, zero_division=0) * 100, 2),
            "rocAuc": round(roc_auc_score(y_true, y_prob), 4),
            "confusionMatrix": {"TP": int(tp), "FP": int(fp), "TN": int(tn), "FN": int(fn)}
        }

    results = {
        "dataset": "UCI Oxford Parkinson's Telemonitoring & Voice Dataset",
        "sampleCount": len(y),
        "featureCount": len(feature_cols),
        "models": {
            "logisticRegression": compute_metrics(y_test, y_pred_lr, y_prob_lr),
            "svmRbf": compute_metrics(y_test, y_pred_svm, y_prob_svm),
            "randomForest": compute_metrics(y_test, y_pred_rf, y_prob_rf),
            "multimodalLateFusion": compute_metrics(y_test, y_pred_fusion, y_prob_fusion)
        },
        "topFeatureImportances": sorted(
            [{"feature": f, "importance": round(float(imp), 4)} for f, imp in zip(feature_cols, rf.feature_importances_)],
            key=lambda x: x["importance"],
            reverse=True
        )[:8]
    }

    # Print Report
    print("=" * 65)
    print("NEUROSCREEN-PD: ML EVALUATION BENCHMARKS (OXFORD DATASET)")
    print("=" * 65)
    print(f"{'Model Architecture':<24} | {'Acc (%)':<8} | {'Rec (%)':<8} | {'Prec (%)':<8} | {'ROC-AUC':<8}")
    print("-" * 65)
    for model_name, m in results["models"].items():
        print(f"{model_name:<24} | {m['accuracy']:<8} | {m['recall']:<8} | {m['precision']:<8} | {m['rocAuc']:<8}")
    print("=" * 65)

    print("\nTop Predictive Acoustic Biomarkers (Random Forest Feature Importance):")
    for item in results["topFeatureImportances"]:
        print(f"  - {item['feature']:<18}: {item['importance'] * 100:.2f}%")

    # Save to JSON artifact
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_evaluation_results.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n[✓] Results successfully exported to: {output_path}")

if __name__ == "__main__":
    train_and_evaluate()
