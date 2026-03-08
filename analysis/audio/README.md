## Small-Batch Audio Exploration

This folder is for exploratory work on fart-audio patterns without touching the React app.

The first pass is intentionally simple:

- sample a manageable batch from the Kaggle corpus
- extract descriptive signal features from each WAV file
- suggest provisional tags and cluster groupings
- write outputs we can inspect before deciding on heavier ML

### Why start this way

The Kaggle dataset is large enough to get lost in quickly, but not richly labeled enough to jump straight to "intelligent" models with confidence. A small-batch harness lets us answer basic questions first:

- which signals cluster together naturally
- which features separate clips in useful ways
- which labels are worth inventing by hand
- whether retrieval seems more promising than strict classification

### Script

`probe_small_batch.py` expects a directory of `.wav` files and writes a compact analysis bundle:

- `clips.csv`: one row per clip with extracted features
- `clusters.json`: cluster membership and cluster summaries
- `neighbors.json`: nearest-neighbor suggestions for a few sample clips
- `summary.json`: dataset-level summary stats
- `report.md`: human-readable report

### Example

```bash
python3 analysis/audio/probe_small_batch.py \
  --dataset-dir /Users/markhartley/.cache/kagglehub/datasets/alecledoux/fart-recordings-dataset/versions/12/fart_dataset \
  --sample-size 128 \
  --seed 7 \
  --cluster-count 6 \
  --output-dir analysis/audio/output/sample_128_seed7
```

### Current bias

This is not trying to prove a taxonomy up front. The script emits "provisional tags" from simple heuristics so we can notice patterns and decide which labels deserve real annotation later.

### Likely next steps after this harness

- add a hand-label template for a small listening set
- compare handcrafted features against pretrained audio embeddings
- add a mixed positive/negative benchmark for fart detection
