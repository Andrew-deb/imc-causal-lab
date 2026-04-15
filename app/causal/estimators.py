import logging
import numpy as np
from abc import ABC, abstractmethod
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from econml.metalearners import TLearner
from econml.dr import DRLearner
from econml.dml import CausalForestDML

from app.configs import settings
from app.schemas.modeling_schema import ModelResult, UpliftSegments

logger = logging.getLogger(__name__)

# UPLIFT SEGMENTATION — 4-segment classification
def classify_uplift_segments(
    ite: np.ndarray,
    mu_0: np.ndarray | None=None,
) -> UpliftSegments:


def classify_uplift_segments(
    ite: np.ndarray,
    mu_0: np.ndarray | None = None,
) -> UpliftSegments:
    """
    Classify customers into 4 uplift segments.

    If mu_0 (counterfactual outcome under no treatment) is available:
      Uses proper 4-quadrant classification (Radcliffe & Surry framework):
        - Persuadables:   ITE > 0 and mu_0 <= median  (campaign lifts low-baseline)
        - Sure Things:    ITE <= 0 and mu_0 > median   (high-baseline regardless)
        - Sleeping Dogs:  ITE < 0 and mu_0 <= median   (campaign hurts low-baseline)
        - Lost Causes:    ITE >= 0 and mu_0 <= median and ITE ≈ 0  (no real effect)
    If mu_0 is NOT available (fallback):
      Uses ITE-sign only classification:
        - Persuadables:   ITE > 0
        - Sleeping Dogs:  ITE < 0
        - Sure Things / Lost Causes split by ITE magnitude
    """
    n = len(ite)
    if n == 0:
        return UpliftSegments(
            persuadables=0.0, sure_things=0.0,
            sleeping_dogs=0.0, lost_causes=0.0,
        )

    if mu_0 is not None:
        # ── Proper 4-quadrant using counterfactual baseline 

        baseline_median = np.median(mu_0)
        high_baseline = mu_0 > baseline_median
        low_baseline = ~high_baseline
        persuadables = np.sum((ite > 0) & low_baseline) / n
        sure_things = np.sum((ite <= 0) & high_baseline) / n
        sleeping_dogs = np.sum((ite < 0) & low_baseline) / n
        lost_causes = np.sum((ite >= 0) & high_baseline) / n
    else:
        # ── Fallback: ITE-sign only

        persuadables = np.sum(ite > 0) / n
        sleeping_dogs = np.sum(ite < 0) / n

        # Split near-zero ITEs for sure things vs lost causes

        near_zero = np.abs(ite) <= np.std(ite) * 0.5
        sure_things = np.sum(near_zero & (ite >= 0)) / n
        lost_causes = np.sum(near_zero & (ite < 0)) / n

    return UpliftSegments(
        persuadables=round(float(persuadables), 4),
        sure_things=round(float(sure_things), 4),
        sleeping_dogs=round(float(sleeping_dogs), 4),
        lost_causes=round(float(lost_causes), 4),
    )


# BASE ESTIMATOR

class BaseEstimator(ABC):
    """Abstract base for all causal estimators."""
    name: str = "base"
    @abstractmethod
    def run(
        self,
        X: np.ndarray,
        T: np.ndarray,
        Y: np.ndarray,
        feature_names: list[str] | None = None,
    ) -> ModelResult:
        """Fit the model and return a ModelResult."""
        ...


# 1. LOGISTIC REGRESSION (associative baseline)

class LogisticRegressionEstimator(BaseEstimator):
    """
    Associative baseline.

    Fits a logistic regression of Y on [X, T]. The coefficient on T
    gives an associative (confounded) estimate of the treatment effect.
    Used as a comparison point to show what happens without causal methods.
    """
    name = "logistic_regression"

    def run(self, X, T, Y, feature_names=None) -> ModelResult:
        logger.info("Running Logistic Regression (associative baseline)...")

        # Binarise Y for logistic regression (above median = 1)

        Y_binary = (Y > np.median(Y)).astype(int)

        # Combine X and T as features

        X_with_T = np.column_stack([X, T])
        model = LogisticRegression(max_iter=1000, random_state=42)
        model.fit(X_with_T, Y_binary)

        # The coefficient on T (last feature) is the associative effect

        treatment_coef = float(model.coef_[0, -1])

        # Predict probabilities with T=1 and T=0 for each observation

        X_treated = np.column_stack([X, np.ones(len(X))])
        X_control = np.column_stack([X, np.zeros(len(X))])
        prob_treated = model.predict_proba(X_treated)[:, 1]
        prob_control = model.predict_proba(X_control)[:, 1]

        # ITE approximation: difference in predicted probabilities

        ite = prob_treated - prob_control
        ate = float(np.mean(ite))
        att = float(np.mean(ite[T == 1])) if np.sum(T == 1) > 0 else ate
        logger.info(f"  LogReg ATE={ate:.4f}, ATT={att:.4f}, coef(T)={treatment_coef:.4f}")

        # LogReg has no proper counterfactual → ITE-only fallback

        return ModelResult(
            model_name=self.name,
            ate=round(ate, 6),
            att=round(att, 6),
            ite_array=[round(float(x), 6) for x in ite[:500]],
            uplift_segments=classify_uplift_segments(ite),
        )


# 2. T-LEARNER (EconML)
class TLearnerEstimator(BaseEstimator):
    """
    T-Learner: fits seperate outcome models for treated and control

    μ₁(x) = E[Y | X=x, T=1]   (model for treated)
    μ₀(x) = E[Y | X=x, T=0]   (model for control)
    ITE(x) = μ₁(x) - μ₀(x)

    Uses GradientBoosting as the base learner for flexibility.
    """

    name = "t_learner"

    def run(self, X, T, Y, feature_names=None) -> ModelResult:
        logger.info("Running T-Learner...")

        model = TLearner(
            models=[
                GradientBoostingRegressor(n_estimators=200, max_depth=4, random_state=42),
                GradientBoostingRegressor(n_estimators=200, max_depth=4, random_state=42)
            ]
        )
        model.fit(Y, T, X=X)

        # Individual teratment effects
        
        ite = model.effect(X).flatten()

        ate = float(np.mean(ite))
        att = float(np.mean(ite[T==1])) if np.sum(T == 1) > 0 else ate

        # Counterfactual: predicted outcome under NO treatment
        # T-Learner models_[0] = control model, models_[1] = treated model

        try:
            mu_0 = model.models_[0].predict(X).flatten()
        except Exception:
            mu_0 = None

        # Confidence intervals (T-Learner supports inference)

        try:
            ate_inference = model.effect_inference(X)
            ci = ate_inference.conf_int(alpha=0.05)
            ate_ci = [float(np.mean(ci[0])), float(np.mean(ci[1]))]
        except Exception:
            ate_ci = None

        logger.info(f"  T-Learner ATE={ate:.4f}, ATT={att:.4f}")

        return ModelResult(
            model_name=self.name,
            ate=round(ate, 6),
            att=round(att, 6),
            ate_ci=ate_ci,
            ite_array=[round(float(x), 6) for x in ite[:500]],
            uplift_segments=classify_uplift_segments(ite, mu_0),
        )

    
# 3. DR-LEARNER (EconML — Doubly Robust)

class DRLearnerEstimator(BaseEstimator):
    """
    Doubly Robust Learner: combines propensity scoring + outcome modelling.
    Consistent if EITHER the propensity model OR the outcome model is
    correctly specified — hence "doubly robust."
    Uses cross-fitting (configurable folds) for honest inference.
    """
    name = "dr_learner"

    def run(self, X, T, Y, feature_names=None) -> ModelResult:
        logger.info("Running DR-Learner (EconML)...")

        model = DRLearner(
            model_propensity=GradientBoostingClassifier(
                n_estimators=200, max_depth=4, random_state=42
            ),
            model_regression=GradientBoostingRegressor(
                n_estimators=200, max_depth=4, random_state=42
            ),
            model_final=GradientBoostingRegressor(
                n_estimators=100, max_depth=3, random_state=42
            ),
            cv=settings.CROSS_FITTING_FOLDS,
            random_state=42,
        )
        model.fit(Y, T, X=X)

        # Individual treatment effects
        ite = model.effect(X).flatten()
        ate = float(np.mean(ite))
        att = float(np.mean(ite[T == 1])) if np.sum(T == 1) > 0 else ate

        # Counterfactual: predicted outcome under NO treatment
        # DR-Learner's regression model predicts E[Y|X] (baseline)

        try:
            mu_0 = model.model_regression_.predict(X).flatten()
        except Exception:
            mu_0 = None

        # Confidence intervals (DR-Learner supports asymptotic inference)

        try:
            ate_inference = model.effect_inference(X)
            ci = ate_inference.conf_int(alpha=0.05)
            ate_ci = [float(np.mean(ci[0])), float(np.mean(ci[1]))]
        except Exception:
            ate_ci = None
        logger.info(f"  DR-Learner ATE={ate:.4f}, ATT={att:.4f}")

        return ModelResult(
            model_name=self.name,
            ate=round(ate, 6),
            att=round(att, 6),
            ate_ci=ate_ci,
            ite_array=[round(float(x), 6) for x in ite[:500]],
            uplift_segments=classify_uplift_segments(ite, mu_0),
        )


# 4. CAUSAL FOREST (EconML — CausalForestDML)

class CausalForestEstimator(BaseEstimator):
    """
    Causal Forest with Double Machine Learning.
    Non-parametric estimator that:
    1. Residualises Y and T against X (removes confounding)
    2. Fits a causal forest on the residuals
    3. Provides honest, point-wise confidence intervals
    Supports feature importance to identify which confounders
    most drive treatment effect heterogeneity.
    """
    name = "causal_forest"
    def run(self, X, T, Y, feature_names=None) -> ModelResult:
        logger.info("Running Causal Forest (EconML CausalForestDML)...")
        
        model = CausalForestDML(
            model_y=GradientBoostingRegressor(
                n_estimators=200, max_depth=4, random_state=42
            ),
            model_t=GradientBoostingClassifier(
                n_estimators=200, max_depth=4, random_state=42
            ),
            n_estimators=settings.CAUSAL_FOREST_N_ESTIMATORS,
            cv=settings.CROSS_FITTING_FOLDS,
            random_state=42,
        )
        model.fit(Y, T, X=X)

        # Individual treatment effects

        ite = model.effect(X).flatten()
        ate = float(np.mean(ite))
        att = float(np.mean(ite[T == 1])) if np.sum(T == 1) > 0 else ate

        # Confidence intervals (Causal Forest supports honest inference)

        try:
            ate_inference = model.effect_inference(X)
            ci = ate_inference.conf_int(alpha=0.05)
            ate_ci = [float(np.mean(ci[0])), float(np.mean(ci[1]))]
        except Exception:
            ate_ci = None

        # Feature importances (which confounders drive heterogeneity)

        importances = None
        try:
            raw_importances = model.feature_importances_
            if feature_names and len(feature_names) == len(raw_importances):
                importances = {
                    name: round(float(imp), 6)
                    for name, imp in zip(feature_names, raw_importances)
                }
            else:
                importances = {
                    f"feature_{i}": round(float(imp), 6)
                    for i, imp in enumerate(raw_importances)
                }
        except Exception:
            logger.warning("Could not extract feature importances from Causal Forest")
        logger.info(f"  Causal Forest ATE={ate:.4f}, ATT={att:.4f}")

        # Causal Forest uses residualisation — no direct mu_0 access
        # Falls back to ITE-only uplift segmentation

        return ModelResult(
            model_name=self.name,
            ate=round(ate, 6),
            att=round(att, 6),
            ate_ci=ate_ci,
            ite_array=[round(float(x), 6) for x in ite[:500]],
            uplift_segments=classify_uplift_segments(ite),
            feature_importances=importances,
        )


# FACTORY — get estimators by name

ESTIMATOR_REGISTRY: dict[str, type[BaseEstimator]] = {
    "logistic_regression": LogisticRegressionEstimator,
    "t_learner": TLearnerEstimator,
    "dr_learner": DRLearnerEstimator,
    "causal_forest": CausalForestEstimator,
}


def get_estimator(name: str) -> BaseEstimator:
    """Return an estimator instance by name."""
    if name not in ESTIMATOR_REGISTRY:
        raise ValueError(
            f"Unknown estimator '{name}'. "
            f"Available: {list(ESTIMATOR_REGISTRY.keys())}"
        )
    return ESTIMATOR_REGISTRY[name]()


def get_all_estimators(names: list[str] | None = None) -> list[BaseEstimator]:
    """Return a list of estimator instances. If names is None, return all."""
    if names is None:
        names = list(ESTIMATOR_REGISTRY.keys())
    return [get_estimator(n) for n in names]