# 📚 System Design Interview Prompts Reference

This folder contains all the system prompts and evaluation templates used throughout the **System Design Interview Copilot**. Each file represents a specific interview phase, question generator, or evaluation engine.

---

## 📂 Prompt Directory Index

| File | Phase / Feature | Role & Purpose |
|---|---|---|
| [critique_instructions.md](./critique_instructions.md) | Global Strictness Modifiers | Defines the 3 critique levels (`Hardcore`, `Standard`, `Constructive`) |
| [problem_generation.md](./problem_generation.md) | Catalog & Problem Discovery | Generates high-scale, level-calibrated distributed system problems |
| [phase1_problem_clarification.md](./phase1_problem_clarification.md) | Phase 1: Problem & Scope | Live interviewer chat for scope, scale numbers, and SLA clarifications |
| [phase2_requirements_eval.md](./phase2_requirements_eval.md) | Phase 2: Requirements & Math | Evaluates functional, non-functional SLAs, and mathematical estimations |
| [phase3_hld_vision_eval.md](./phase3_hld_vision_eval.md) | Phase 3: Architecture & Schemas | Multimodal vision & architecture evaluation for SPOFs and data flow |
| [phase4_deepdive_generation.md](./phase4_deepdive_generation.md) | Phase 4: Deep Dive Generation | Dynamically generates 3 tailored technical deep-dive challenges |
| [phase4_deepdive_eval.md](./phase4_deepdive_eval.md) | Phase 4: Deep Dive Evaluation | Evaluates distributed consensus, race conditions, and failure modes |
| [phase5_gold_standard.md](./phase5_gold_standard.md) | Phase 5: Final Review & Blueprint | Generates the authoritative FAANG production solution blueprint |
| [assistant_copilot.md](./assistant_copilot.md) | Global Floating Assistant | Socratic context-aware coaching widget |

---

## ⚙️ How Critique Strictness Is Injected

Every evaluation prompt (Phases 1, 2, 3, 4) dynamically receives a `{{CRITIQUE_INSTRUCTION}}` block based on the candidate's setting in **Settings -> Interviewer Critique Rigor**:

- **`Hardcore / Principal Bar`**: Zero tolerance for hand-waving, heavily penalizes missing failure recovery protocols and mathematical discrepancies.
- **`Standard FAANG Bar`**: Realistic L5/L6 Google/Meta calibration balancing decomposition, scale math, and trade-offs.
- **`Constructive & Encouraging`**: Supportive feedback, forgives minor rounding slips, and highlights growth areas.
