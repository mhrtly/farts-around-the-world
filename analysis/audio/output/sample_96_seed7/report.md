# Small-Batch Audio Probe

- Dataset dir: `/Users/markhartley/.cache/kagglehub/datasets/alecledoux/fart-recordings-dataset/versions/12/fart_dataset`
- Sample size: `96`
- Random seed: `7`
- Cluster count: `5`

## Distribution Snapshot

- `duration_s`: min 0.40585, median 1.746803, mean 2.07259, max 7.801406
- `trimmed_duration_s`: min 0.098912, median 1.434875, mean 1.772686, max 7.717075
- `burst_count`: min 1.0, median 2.0, mean 3.333333, max 14.0
- `zero_crossing_rate`: min 0.022764, median 0.09727, mean 0.115925, max 0.341256
- `silence_ratio`: min 0.357811, median 0.825017, mean 0.797031, max 0.959325
- `spectral_centroid_hz`: min 145.568243, median 1118.857557, mean 1557.539388, max 7856.606144
- `spectral_bandwidth_hz`: min 437.449527, median 1896.791529, mean 2340.037779, max 8227.537908
- `spectral_flatness`: min 0.000427, median 0.019287, mean 0.041469, max 0.244399
- `dominant_freq_hz`: min 46.430969, median 288.343048, mean 432.610461, max 5015.857444
- `low_band_ratio`: min 0.000161, median 0.140515, mean 0.227454, max 0.973366
- `mid_band_ratio`: min 0.015365, median 0.6325, mean 0.611405, max 0.955456
- `high_band_ratio`: min 0.001437, median 0.075855, mean 0.161141, max 0.806889

## Tag Prevalence

- `mid-length`: 59
- `tonal`: 43
- `sustained`: 30
- `low-heavy`: 27
- `staccato`: 27
- `high-texture`: 25
- `peaky`: 20
- `sparse`: 17
- `noisy`: 16
- `buzzy`: 15
- `long-tail`: 15
- `single-roll`: 15
- `micro-burst`: 7

## Provisional Clusters

- Cluster 0: 34 clips, higher crest_factor, lower rms, higher silence_ratio
  top tags: mid-length, peaky, sustained, sparse
  sample files: 1364.wav, 1434.wav, 1438.wav, 1461.wav, 1532.wav
- Cluster 1: 10 clips, higher spectral_flatness, higher spectral_centroid_hz, higher high_band_ratio
  top tags: high-texture, noisy, mid-length, buzzy
  sample files: 4081.wav, 4871.wav, 4986.wav, 5102.wav, 5129.wav
- Cluster 2: 14 clips, higher low_band_ratio, lower mid_band_ratio, higher duration_s
  top tags: low-heavy, tonal, sustained, staccato
  sample files: 1275.wav, 1341.wav, 1426.wav, 1632.wav, 1693.wav
- Cluster 3: 1 clips, higher spectral_centroid_hz, higher spectral_bandwidth_hz, higher spectral_flatness
  top tags: high-texture, long-tail, micro-burst, noisy
  sample files: 4659.wav
- Cluster 4: 37 clips, lower crest_factor, higher rms, higher mid_band_ratio
  top tags: mid-length, tonal, low-heavy, high-texture
  sample files: 1354.wav, 1454.wav, 1513.wav, 1538.wav, 1601.wav

## Neighbor Examples

- `1275.wav` -> 1693.wav (0.989), 521.wav (1.9985), 2830.wav (2.4568)
- `1341.wav` -> 1911.wav (2.2407), 2384.wav (3.5191), 2061.wav (3.584)
- `1354.wav` -> 474.wav (1.0906), 2517.wav (1.6085), 1538.wav (1.6137)
- `1364.wav` -> 1532.wav (1.6928), 2830.wav (1.7202), 1538.wav (1.8499)
- `1426.wav` -> 2330.wav (1.0859), 2384.wav (2.6951), 2323.wav (3.1932)
- `1434.wav` -> 474.wav (2.0271), 4649.wav (2.2463), 1438.wav (2.2733)
- `1438.wav` -> 3120.wav (1.2709), 495.wav (1.3542), 4089.wav (1.5005)
- `1454.wav` -> 2517.wav (1.2093), 6377.wav (1.3195), 2773.wav (1.419)
