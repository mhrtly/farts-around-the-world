# Fart Sommelier Auto-Research Program

This is the audio analogue of the small Karpathy-style loop:

- one fixed evaluator
- one editable strategy file
- short repeated runs
- keep changes only if the score improves

## Editable Surface

Edit only:

- `analysis/audio/sommelier_strategies.py`

That file controls:

- which acoustic dimensions each critic emphasizes
- how many facets each critic tries to foreground
- how lyrical or plainspoken each critic tends to be

## Fixed Evaluator

Do not change during a strategy sweep:

- `analysis/audio/sommelier_autoresearch.py`

The evaluator:

1. samples a small set of fart clips
2. builds many 3-clip tasting flights
3. lets each persona write a note about a target clip
4. checks whether the note would help recover the target from the lineup
5. rewards notes that are both matchable and lexically rich

## Run Command

```bash
python3 analysis/audio/sommelier_autoresearch.py \
  --dataset-dir /Users/markhartley/.cache/kagglehub/datasets/alecledoux/fart-recordings-dataset/versions/12/fart_dataset \
  --sample-size 72 \
  --lineup-count 36 \
  --generations 18 \
  --population 6 \
  --seed 11 \
  --output-dir analysis/audio/output/sommelier_latest
```

## Output Files

- `results.tsv` — score progression by generation
- `best_personas.json` — best current critic strategy config
- `best_result.json` — best metrics and example notes
- `report.md` — human-readable summary

## What Counts As Better

Prefer changes that increase:

- `match_accuracy`
- `mean_margin`
- `mean_lexical`

The ideal critic is not merely funny. The ideal critic makes the right fart easier to find.
