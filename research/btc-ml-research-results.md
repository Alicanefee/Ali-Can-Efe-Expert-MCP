# BTC Machine-Learning Research: Results and Validation Lessons

> **Research notes only. This is not investment advice, not a trading-signal service and not an offer to manage money.** The code and data behind this work are private; only aggregate results and methodology lessons are published here. Backtests and historical experiments do not predict future results, and trading crypto assets carries a substantial risk of loss.

**Author:** Ali Can Efe · **Period covered:** May–June 2026 · **Status:** private research project, results published for transparency

## Scope

| | |
|---|---|
| Asset | BTC/USDT (spot) |
| Data | 1-minute OHLCV, millions of bars, with 5-minute, 15-minute and 4-hour context. Date ranges differ between experiment series (2017–2026 overall). |
| Cost bar | 0.04% round trip (maker fees). Any signal has to clear this to be useful. |
| Methods | CNNs on image-style encodings of indicator windows (GASF-type "fingerprints"), masked-autoencoder (MAE) pretraining, gradient boosting (XGBoost), Optuna hyperparameter search, synthetic-data controls |
| Tooling | PyTorch, XGBoost, Optuna |

## What held up under out-of-sample checks

| Finding | Result |
|---|---|
| Bollinger band width vs. the size of the next large move (1-minute) | correlation **0.626** |
| High vs. low band-width regime | subsequent move size **1.88x** vs. **0.44x** (about 4x apart) |
| 60-bar range proxy vs. future range | Spearman ρ **0.685** |
| Volume spike (z-score > 2) | **1.23x** larger subsequent moves |
| Encoder + XGBoost stack, chronological hold-out (Series A) | **F0.5 = 0.612** on a test set the pretraining encoder never saw. Label: ±0.15% take-profit / stop-loss hit within 60 bars. |
| Regime-aware pipeline, stage 1 (Series C) | validation AUC (one-vs-rest) **0.609** with shallow trees (max depth 4); synthetic-data control AUC 0.529; validation–synthetic gap 0.080 |

These are classification and correlation results. **No net-of-fee profitable strategy is claimed.**

## What did not work

**Predicting direction at 1 minute was not tradeable.**

- Single-indicator mean-reversion rules won about 56% of the time on 1M+ samples, but the average return (+0.02%) was below the 0.04% fee.
- Of 10 indicator combinations (pairs and triples) that looked profitable in training, none held out of sample.
- Regime-conditional rules (low-volatility reversal, high-volatility momentum) ended below fees or negative out of sample.
- Favorable and adverse excursions after a signal were about equal (ratio ~1.0): the opportunity is symmetric.
- Take-profit / stop-loss exits did worse than simply holding (win rate 16–42%).
- A leak-free CNN reached about 50% direction accuracy (chance). The best raw-indicator correlation with direction was 0.06 or lower.

**Common beliefs that failed at 1 minute:** "Bollinger squeeze precedes a breakout" (low volatility stayed low, 0.44x), "ADX separates move size" (1.00x in both directions), "RSI oversold means a bounce" (downside moves were larger).

## How the failures were overcome

| Problem | Evidence | Fix |
|---|---|---|
| Future-bar leakage in a chart-pattern feature | It used ±15 future bars. It produced a fake 71% direction accuracy and a +0.062% backtest. The live run lost about 15%. | Removed the feature or made it causal. Every feature is now audited for backward-looking computation (rolling / EWM / shift; swing highs shifted by one bar). |
| Scaling fitted on all data | Percentiles and scales included the test period. | Fit on the training period only, then apply to test. |
| Per-window z-scoring | It removed the mean and with it the sign and direction information. | Fixed-scale, sign-preserving features. |
| Noisy labels | The price at a single future point is mostly noise. | Window max/min excursion labels. |
| One good live period | A +4.48% live result turned out to be drift. | Mandatory chronological train/test split with an embargo gap. |
| Dead or broken features | A constant Hurst estimate and swing-distance features with ~1e9 standard deviation had contaminated older models. | Removed, and a feature audit was added. |
| Did pretraining see the test windows? | Checked the split: chronological 70/15/15. The MAE encoder trained on the first 70% and its checkpoint was chosen on MAE validation loss only. | Confirmed no leakage. |
| Out-of-fold vs. test gap | OOF F0.5 0.752 vs. test 0.612 (gap 0.139). The author's estimated split of the gap: regime shift 8–10 points, XGBoost overfitting 5–7, embedding collapse 3–5. Regularization barely moved the gap (OOF 0.749, test 0.612). | Treat OOF as optimistic and the test score as the real number. Embedding collapse (one of 64 dimensions held 58.8% of importance in one run and 20.4% in another) was the motivation for MAE pretraining. |
| Selection bias from comparing variants | Three stride settings were compared on validation (Bonferroni α ≈ 0.017). The validation difference was 0.011; test scores were identical (0.546 vs. 0.546). | Checkpoints and settings chosen on validation only. The selection effect is negligible. |
| Residual look-ahead | The higher-timeframe alignment leaks part of the current bar into the raw-OHLCV input (about 1 of 60 bars; indicator features are unaffected). | Documented as low severity instead of hidden. |
| Risk of overfitting a single dataset | Real data alone cannot show whether a pipeline is memorizing. | A synthetic-data control (stylized-facts score 0.910, kurtosis match ~0.94). The validation–synthetic gap is used as an overfit signal. |

## Takeaways

1. **Costs decide 1-minute strategies.** A real 56% win rate still loses money after fees.
2. **Predict what is predictable.** Move size (volatility) was predictable at 1 minute; direction was not.
3. **Validation discipline beats model complexity.** The most impressive early numbers (71% accuracy, +4.48% live) disappeared once leakage and drift were controlled.
4. **Publish the negative results and the residual risks.**

## Limitations

- One asset (BTC/USDT). Other asset classes are not covered by the work summarized here.
- Research stage. Fee-aware backtests of the latest pipeline were still pending when the notes were written, and the multi-timeframe direction experiment had not finished.
- Results are self-reported and have not been independently audited or replicated. Data ranges differ across experiment series.
- The code is private, so readers cannot reproduce the runs.

## Disclaimer

This document describes research experiments for informational purposes only. It is not financial, investment, legal or tax advice, and no recommendation to buy or sell any asset is made or implied. Past and simulated performance is not indicative of future results.

*Derived from private research logs (May–June 2026). Questions about the methodology: use the contact link in the profile.*
