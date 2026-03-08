#!/usr/bin/env python3

import argparse
import csv
import json
import math
import random
import wave
from pathlib import Path

import numpy as np


DEFAULT_DATASET_DIR = (
    Path.home()
    / ".cache"
    / "kagglehub"
    / "datasets"
    / "alecledoux"
    / "fart-recordings-dataset"
    / "versions"
    / "12"
    / "fart_dataset"
)

CORE_FEATURES = [
    "duration_s",
    "rms",
    "zero_crossing_rate",
    "silence_ratio",
    "trimmed_fraction",
    "spectral_centroid_hz",
    "spectral_bandwidth_hz",
    "spectral_flatness",
    "dominant_freq_hz",
    "low_band_ratio",
    "mid_band_ratio",
    "high_band_ratio",
    "burst_count",
    "crest_factor",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Probe a small batch of WAV files and emit exploratory audio features."
    )
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        default=DEFAULT_DATASET_DIR,
        help=f"Directory containing WAV files. Default: {DEFAULT_DATASET_DIR}",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=128,
        help="Number of clips to sample.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=7,
        help="Random seed for reproducible sampling and clustering.",
    )
    parser.add_argument(
        "--cluster-count",
        type=int,
        default=6,
        help="Number of provisional clusters.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("analysis/audio/output/latest"),
        help="Directory for outputs.",
    )
    return parser.parse_args()


def list_wavs(dataset_dir):
    if not dataset_dir.exists():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")
    files = sorted(path for path in dataset_dir.rglob("*.wav") if path.is_file())
    if not files:
        raise FileNotFoundError(f"No WAV files found under: {dataset_dir}")
    return files


def sample_files(files, sample_size, seed):
    if sample_size >= len(files):
        return files
    rng = random.Random(seed)
    sample = rng.sample(files, sample_size)
    sample.sort()
    return sample


def pcm_to_float(raw_bytes, sample_width, channels):
    if sample_width == 1:
        data = np.frombuffer(raw_bytes, dtype=np.uint8).astype(np.float32)
        data = (data - 128.0) / 128.0
    elif sample_width == 2:
        data = np.frombuffer(raw_bytes, dtype="<i2").astype(np.float32) / 32768.0
    elif sample_width == 3:
        raw = np.frombuffer(raw_bytes, dtype=np.uint8).reshape(-1, 3)
        data = (
            raw[:, 0].astype(np.int32)
            | (raw[:, 1].astype(np.int32) << 8)
            | (raw[:, 2].astype(np.int32) << 16)
        )
        sign_mask = 1 << 23
        data = ((data ^ sign_mask) - sign_mask).astype(np.float32) / float(sign_mask)
    elif sample_width == 4:
        data = np.frombuffer(raw_bytes, dtype="<i4").astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"Unsupported sample width: {sample_width}")

    if data.size % channels != 0:
        raise ValueError("PCM byte count is not divisible by channel count.")

    data = data.reshape(-1, channels)
    mono = data.mean(axis=1)
    return mono


def load_wav(path):
    with wave.open(str(path), "rb") as wav_file:
        channels = wav_file.getnchannels()
        sample_rate = wav_file.getframerate()
        sample_width = wav_file.getsampwidth()
        frame_count = wav_file.getnframes()
        raw_bytes = wav_file.readframes(frame_count)

    signal = pcm_to_float(raw_bytes, sample_width, channels)
    duration_s = frame_count / sample_rate if sample_rate else 0.0
    return {
        "signal": signal,
        "sample_rate": sample_rate,
        "channels": channels,
        "sample_width": sample_width,
        "frame_count": frame_count,
        "duration_s": duration_s,
    }


def trim_signal(signal, threshold_db=-40.0):
    peak = float(np.max(np.abs(signal))) if signal.size else 0.0
    if peak <= 0.0:
        return signal.copy(), 0, signal.size

    threshold = peak * (10.0 ** (threshold_db / 20.0))
    indices = np.flatnonzero(np.abs(signal) >= threshold)
    if indices.size == 0:
        return signal.copy(), 0, signal.size

    start = int(indices[0])
    end = int(indices[-1]) + 1
    return signal[start:end], start, end


def frame_signal(signal, frame_size, hop_size):
    if signal.size == 0:
        return np.zeros((1, frame_size), dtype=np.float32)

    frames = []
    start = 0
    while start < signal.size:
        frame = signal[start : start + frame_size]
        if frame.size < frame_size:
            frame = np.pad(frame, (0, frame_size - frame.size))
        frames.append(frame)
        if start + frame_size >= signal.size:
            break
        start += hop_size

    return np.vstack(frames).astype(np.float32)


def estimate_bursts(trimmed_signal, sample_rate):
    frame_size = max(256, min(2048, int(sample_rate * 0.032)))
    hop_size = max(128, frame_size // 2)
    frames = frame_signal(trimmed_signal, frame_size, hop_size)
    frame_rms = np.sqrt(np.mean(np.square(frames), axis=1))
    if not np.any(frame_rms):
        return 0

    threshold = max(float(np.percentile(frame_rms, 65)) * 0.65, float(frame_rms.mean()) * 0.8)
    active = frame_rms >= threshold
    burst_count = 0
    active_run = False
    for is_active in active:
        if is_active and not active_run:
            burst_count += 1
            active_run = True
        elif not is_active:
            active_run = False
    return int(burst_count)


def spectral_features(trimmed_signal, sample_rate):
    if trimmed_signal.size == 0:
        return {
            "spectral_centroid_hz": 0.0,
            "spectral_bandwidth_hz": 0.0,
            "spectral_flatness": 0.0,
            "dominant_freq_hz": 0.0,
            "low_band_ratio": 0.0,
            "mid_band_ratio": 0.0,
            "high_band_ratio": 0.0,
        }

    fft_size = min(trimmed_signal.size, 65536)
    focus = trimmed_signal[:fft_size]
    window = np.hanning(focus.size)
    spectrum = np.fft.rfft(focus * window)
    power = np.abs(spectrum) ** 2
    freqs = np.fft.rfftfreq(focus.size, d=1.0 / sample_rate)

    if power.size <= 1 or float(power.sum()) == 0.0:
        return {
            "spectral_centroid_hz": 0.0,
            "spectral_bandwidth_hz": 0.0,
            "spectral_flatness": 0.0,
            "dominant_freq_hz": 0.0,
            "low_band_ratio": 0.0,
            "mid_band_ratio": 0.0,
            "high_band_ratio": 0.0,
        }

    safe_power = power + 1e-12
    power_sum = float(safe_power.sum())
    centroid = float(np.sum(freqs * safe_power) / power_sum)
    bandwidth = float(np.sqrt(np.sum(((freqs - centroid) ** 2) * safe_power) / power_sum))
    flatness = float(np.exp(np.mean(np.log(safe_power))) / np.mean(safe_power))

    dominant_index = int(np.argmax(safe_power[1:]) + 1) if safe_power.size > 1 else 0
    dominant_freq = float(freqs[dominant_index]) if dominant_index < freqs.size else 0.0

    low_energy = float(safe_power[freqs < 250].sum())
    mid_energy = float(safe_power[(freqs >= 250) & (freqs < 2000)].sum())
    high_energy = float(safe_power[freqs >= 2000].sum())

    return {
        "spectral_centroid_hz": centroid,
        "spectral_bandwidth_hz": bandwidth,
        "spectral_flatness": flatness,
        "dominant_freq_hz": dominant_freq,
        "low_band_ratio": low_energy / power_sum,
        "mid_band_ratio": mid_energy / power_sum,
        "high_band_ratio": high_energy / power_sum,
    }


def provisional_tags(features):
    tags = []

    if features["trimmed_duration_s"] < 0.35:
        tags.append("micro-burst")
    elif features["trimmed_duration_s"] > 2.0:
        tags.append("sustained")
    else:
        tags.append("mid-length")

    if features["burst_count"] >= 4:
        tags.append("staccato")
    elif features["burst_count"] <= 1 and features["duration_s"] > 0.8:
        tags.append("single-roll")

    if features["low_band_ratio"] > 0.28 and features["low_band_ratio"] > features["high_band_ratio"] * 1.5:
        tags.append("low-heavy")
    elif features["high_band_ratio"] > 0.18 and features["high_band_ratio"] > features["low_band_ratio"] * 1.5:
        tags.append("high-texture")

    if features["spectral_flatness"] > 0.08:
        tags.append("noisy")
    elif features["spectral_flatness"] < 0.015:
        tags.append("tonal")

    if features["trimmed_fraction"] > 0.45:
        tags.append("long-tail")

    if features["silence_ratio"] > 0.88:
        tags.append("sparse")

    if features["crest_factor"] > 18.0:
        tags.append("peaky")

    if features["zero_crossing_rate"] > 0.18:
        tags.append("buzzy")

    return tags


def extract_features(path):
    audio = load_wav(path)
    signal = audio["signal"]
    trimmed_signal, trim_start, trim_end = trim_signal(signal)

    peak = float(np.max(np.abs(signal))) if signal.size else 0.0
    rms = float(np.sqrt(np.mean(np.square(signal)))) if signal.size else 0.0
    crest_factor = float(peak / rms) if rms > 0.0 else 0.0

    zero_crossings = np.count_nonzero(np.diff(np.signbit(signal))) if signal.size > 1 else 0
    zero_crossing_rate = float(zero_crossings / max(1, signal.size - 1))

    silence_threshold = max(peak * 0.02, 1e-4)
    silence_ratio = float(np.mean(np.abs(signal) < silence_threshold)) if signal.size else 0.0
    trimmed_fraction = (
        float(1.0 - (trimmed_signal.size / signal.size)) if signal.size else 0.0
    )

    features = {
        "path": str(path),
        "file_name": path.name,
        "sample_rate": int(audio["sample_rate"]),
        "channels": int(audio["channels"]),
        "sample_width": int(audio["sample_width"]),
        "frame_count": int(audio["frame_count"]),
        "duration_s": float(audio["duration_s"]),
        "peak_abs": peak,
        "rms": rms,
        "crest_factor": crest_factor,
        "zero_crossing_rate": zero_crossing_rate,
        "silence_ratio": silence_ratio,
        "trimmed_fraction": trimmed_fraction,
        "trim_start_frame": int(trim_start),
        "trim_end_frame": int(trim_end),
        "trimmed_duration_s": float(trimmed_signal.size / audio["sample_rate"])
        if audio["sample_rate"]
        else 0.0,
        "burst_count": estimate_bursts(trimmed_signal, audio["sample_rate"]),
    }
    features.update(spectral_features(trimmed_signal, audio["sample_rate"]))
    features["provisional_tags"] = provisional_tags(features)
    return features


def zscore_matrix(rows, feature_names):
    matrix = np.array(
        [[float(row[name]) for name in feature_names] for row in rows],
        dtype=np.float64,
    )
    means = matrix.mean(axis=0)
    stds = matrix.std(axis=0)
    stds[stds == 0.0] = 1.0
    return (matrix - means) / stds, means, stds


def kmeans(matrix, cluster_count, seed, max_iter=40):
    if matrix.shape[0] < cluster_count:
        cluster_count = matrix.shape[0]

    rng = np.random.default_rng(seed)
    centroids = matrix[rng.choice(matrix.shape[0], size=cluster_count, replace=False)].copy()
    assignments = np.zeros(matrix.shape[0], dtype=np.int32)

    for _ in range(max_iter):
        distances = np.sum((matrix[:, None, :] - centroids[None, :, :]) ** 2, axis=2)
        next_assignments = np.argmin(distances, axis=1)
        if np.array_equal(assignments, next_assignments):
            break
        assignments = next_assignments

        for index in range(cluster_count):
            members = matrix[assignments == index]
            if members.size == 0:
                centroids[index] = matrix[rng.integers(0, matrix.shape[0])]
            else:
                centroids[index] = members.mean(axis=0)

    return assignments, centroids


def summarize_cluster(rows, cluster_indices, feature_names, global_means, global_stds):
    members = [rows[index] for index in cluster_indices]
    if not members:
        return {
            "size": 0,
            "headline": "empty",
            "feature_highlights": [],
            "sample_files": [],
            "top_tags": [],
        }

    cluster_values = np.array(
        [[float(row[name]) for name in feature_names] for row in members],
        dtype=np.float64,
    )
    cluster_means = cluster_values.mean(axis=0)
    zscores = (cluster_means - global_means) / global_stds
    ranked = sorted(
        zip(feature_names, zscores),
        key=lambda item: abs(float(item[1])),
        reverse=True,
    )

    highlights = []
    for name, score in ranked[:3]:
        direction = "higher" if score > 0 else "lower"
        highlights.append(f"{direction} {name}")

    tag_counts = {}
    for member in members:
        for tag in member["provisional_tags"]:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    top_tags = [
        tag for tag, _ in sorted(tag_counts.items(), key=lambda item: (-item[1], item[0]))[:4]
    ]

    return {
        "size": len(members),
        "headline": ", ".join(highlights) if highlights else "mixed profile",
        "feature_highlights": highlights,
        "sample_files": [member["file_name"] for member in members[:5]],
        "top_tags": top_tags,
    }


def compute_neighbors(rows, matrix, count=3, examples=8):
    neighbors = []
    limit = min(examples, len(rows))
    for index in range(limit):
        deltas = matrix - matrix[index]
        distances = np.sqrt(np.sum(deltas * deltas, axis=1))
        order = np.argsort(distances)
        close = []
        for neighbor_index in order[1 : count + 1]:
            close.append(
                {
                    "file_name": rows[int(neighbor_index)]["file_name"],
                    "path": rows[int(neighbor_index)]["path"],
                    "distance": round(float(distances[int(neighbor_index)]), 4),
                }
            )
        neighbors.append(
            {
                "query_file": rows[index]["file_name"],
                "query_path": rows[index]["path"],
                "neighbors": close,
            }
        )
    return neighbors


def safe_stats(values):
    array = np.array(values, dtype=np.float64)
    return {
        "min": round(float(array.min()), 6),
        "median": round(float(np.median(array)), 6),
        "mean": round(float(array.mean()), 6),
        "max": round(float(array.max()), 6),
    }


def write_csv(rows, output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "file_name",
        "path",
        "cluster_id",
        "sample_rate",
        "channels",
        "sample_width",
        "frame_count",
        "duration_s",
        "trimmed_duration_s",
        "trim_start_frame",
        "trim_end_frame",
        "peak_abs",
        "rms",
        "crest_factor",
        "zero_crossing_rate",
        "silence_ratio",
        "trimmed_fraction",
        "burst_count",
        "spectral_centroid_hz",
        "spectral_bandwidth_hz",
        "spectral_flatness",
        "dominant_freq_hz",
        "low_band_ratio",
        "mid_band_ratio",
        "high_band_ratio",
        "provisional_tags",
    ]
    with output_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            row_copy = dict(row)
            row_copy["provisional_tags"] = "|".join(row_copy["provisional_tags"])
            writer.writerow(row_copy)


def write_json(payload, output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w") as handle:
        json.dump(payload, handle, indent=2)


def write_report(output_path, summary, clusters, neighbors):
    lines = []
    lines.append("# Small-Batch Audio Probe")
    lines.append("")
    lines.append(f"- Dataset dir: `{summary['dataset_dir']}`")
    lines.append(f"- Sample size: `{summary['sample_size']}`")
    lines.append(f"- Random seed: `{summary['seed']}`")
    lines.append(f"- Cluster count: `{summary['cluster_count']}`")
    lines.append("")
    lines.append("## Distribution Snapshot")
    lines.append("")
    for feature_name, stats in summary["feature_stats"].items():
        lines.append(
            f"- `{feature_name}`: min {stats['min']}, median {stats['median']}, mean {stats['mean']}, max {stats['max']}"
        )
    lines.append("")
    lines.append("## Tag Prevalence")
    lines.append("")
    for tag, count in summary["tag_counts"]:
        lines.append(f"- `{tag}`: {count}")
    lines.append("")
    lines.append("## Provisional Clusters")
    lines.append("")
    for cluster in clusters:
        lines.append(
            f"- Cluster {cluster['cluster_id']}: {cluster['size']} clips, {cluster['headline']}"
        )
        lines.append(f"  top tags: {', '.join(cluster['top_tags']) or 'none'}")
        lines.append(f"  sample files: {', '.join(cluster['sample_files']) or 'none'}")
    lines.append("")
    lines.append("## Neighbor Examples")
    lines.append("")
    for item in neighbors:
        formatted = ", ".join(
            f"{neighbor['file_name']} ({neighbor['distance']})" for neighbor in item["neighbors"]
        )
        lines.append(f"- `{item['query_file']}` -> {formatted}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n")


def main():
    args = parse_args()
    all_files = list_wavs(args.dataset_dir)
    sampled_files = sample_files(all_files, args.sample_size, args.seed)

    rows = [extract_features(path) for path in sampled_files]
    matrix, means, stds = zscore_matrix(rows, CORE_FEATURES)
    assignments, _ = kmeans(matrix, args.cluster_count, args.seed)

    clusters = []
    for cluster_id in range(min(args.cluster_count, len(rows))):
        member_indices = [index for index, value in enumerate(assignments) if int(value) == cluster_id]
        cluster_summary = summarize_cluster(rows, member_indices, CORE_FEATURES, means, stds)
        cluster_summary["cluster_id"] = cluster_id
        clusters.append(cluster_summary)

    for index, row in enumerate(rows):
        row["cluster_id"] = int(assignments[index])

    feature_stats = {
        name: safe_stats([row[name] for row in rows])
        for name in [
            "duration_s",
            "trimmed_duration_s",
            "burst_count",
            "zero_crossing_rate",
            "silence_ratio",
            "spectral_centroid_hz",
            "spectral_bandwidth_hz",
            "spectral_flatness",
            "dominant_freq_hz",
            "low_band_ratio",
            "mid_band_ratio",
            "high_band_ratio",
        ]
    }

    neighbors = compute_neighbors(rows, matrix)

    summary = {
        "dataset_dir": str(args.dataset_dir),
        "sample_size": len(rows),
        "seed": args.seed,
        "cluster_count": min(args.cluster_count, len(rows)),
        "total_available_files": len(all_files),
        "feature_stats": feature_stats,
        "tag_counts": sorted(
            [
                (tag, count)
                for tag, count in {
                    tag: sum(tag in row["provisional_tags"] for row in rows)
                    for row in rows
                    for tag in row["provisional_tags"]
                }.items()
            ],
            key=lambda item: (-item[1], item[0]),
        ),
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_csv(rows, args.output_dir / "clips.csv")
    write_json(clusters, args.output_dir / "clusters.json")
    write_json(neighbors, args.output_dir / "neighbors.json")
    write_json(summary, args.output_dir / "summary.json")
    write_report(args.output_dir / "report.md", summary, clusters, neighbors)

    print(f"Wrote analysis bundle to {args.output_dir}")


if __name__ == "__main__":
    main()
