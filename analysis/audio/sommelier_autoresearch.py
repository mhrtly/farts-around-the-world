#!/usr/bin/env python3

import argparse
import csv
import hashlib
import json
import random
from copy import deepcopy
from pathlib import Path

from probe_small_batch import DEFAULT_DATASET_DIR, extract_features, list_wavs, sample_files
from sommelier_strategies import clone_personas


DIMENSION_ORDER = ["pitch", "duration", "rumble", "texture", "bursts", "tail", "force"]

WORD_BANK = {
    "poet": {
        "pitch": {
            "high": ["reed-bright", "silver-throated", "soprano", "whistling"],
            "low": ["baritone", "cellar-deep", "subterranean", "low-bellied"],
        },
        "duration": {
            "high": ["lingering", "patient", "slow to leave", "long-palated"],
            "low": ["blink-fast", "brief", "impatient", "gone at once"],
        },
        "rumble": {
            "high": ["velvet-rumbled", "warm-bodied", "underlit", "deep-backed"],
            "low": ["light-bodied", "airy", "hovering", "nearly weightless"],
        },
        "texture": {
            "high": ["papery", "raspy", "grain-shot", "splintered"],
            "low": ["velvety", "smooth-skinned", "rounded", "polished"],
        },
        "bursts": {
            "high": ["staccato", "hoofbeat", "fluttering", "many-syllabled"],
            "low": ["single-roll", "unbroken", "clean-spoken", "one-breathed"],
        },
        "tail": {
            "high": ["afterglowing", "long-finished", "trailing", "still shimmering"],
            "low": ["hard-cut", "snapped-off", "abrupt", "knife-finished"],
        },
        "force": {
            "high": ["full-bodied", "assertive", "broad-shouldered", "firmly declared"],
            "low": ["delicate", "narrow", "shy", "restrained"],
        },
    },
    "naturalist": {
        "pitch": {
            "high": ["high-voiced", "elevated", "upper-register", "chirper-like"],
            "low": ["low-voiced", "ground-hugging", "deep-register", "roller-like"],
        },
        "duration": {
            "high": ["long-bodied", "sustained", "linger-prone", "extended"],
            "low": ["short-bodied", "brief", "compact", "rapid"],
        },
        "rumble": {
            "high": ["rumble-backed", "heavy-bodied", "low-resonant", "densely rooted"],
            "low": ["light-bodied", "low-resonance", "thin-backed", "surface-skimming"],
        },
        "texture": {
            "high": ["high-texture", "grain-rich", "rough-surfaced", "rasp-forward"],
            "low": ["smooth-surfaced", "low-texture", "round-edged", "soft-grained"],
        },
        "bursts": {
            "high": ["multi-burst", "segmented", "clustered", "pulse-rich"],
            "low": ["single-burst", "continuous", "one-roll", "less segmented"],
        },
        "tail": {
            "high": ["long-tailed", "slow-decay", "trailing", "finish-rich"],
            "low": ["short-tailed", "fast-decay", "abrupt-finished", "quick-cut"],
        },
        "force": {
            "high": ["forceful", "strong-bodied", "assertive", "higher-energy"],
            "low": ["delicate", "soft-bodied", "restrained", "lower-energy"],
        },
    },
    "engineer": {
        "pitch": {
            "high": ["high pitch center", "treble-biased", "upper-register", "frequency-elevated"],
            "low": ["low pitch center", "bass-weighted", "low-register", "frequency-sunk"],
        },
        "duration": {
            "high": ["long envelope", "extended release", "sustained window", "wide hold time"],
            "low": ["short envelope", "compressed release", "tight window", "fast hold time"],
        },
        "rumble": {
            "high": ["heavy low-body load", "strong substructure", "low-band rich", "rumble-loaded"],
            "low": ["lean low-body load", "minimal substructure", "low-band light", "rumble-thin"],
        },
        "texture": {
            "high": ["high edge activity", "rough waveform skin", "texture-forward", "grain-rich surface"],
            "low": ["suppressed edge activity", "smooth waveform skin", "texture-light", "grain-poor surface"],
        },
        "bursts": {
            "high": ["multi-pulse", "segmented packeting", "high burst count", "repeat-impulse"],
            "low": ["single-pulse", "continuous packet", "low burst count", "one-pass release"],
        },
        "tail": {
            "high": ["extended decay", "long release tail", "post-peak persistence", "slow collapse"],
            "low": ["abrupt decay", "short release tail", "rapid collapse", "fast dropout"],
        },
        "force": {
            "high": ["high drive", "strong body energy", "elevated peak load", "force-rich"],
            "low": ["low drive", "modest body energy", "reduced peak load", "force-light"],
        },
    },
}

RELATION_TEXT = {
    "pitch": {"high": "the highest voice in the flight", "low": "the lowest voice in the flight"},
    "duration": {"high": "one of the longest bodies in the flight", "low": "one of the briefest bodies in the flight"},
    "rumble": {"high": "the heaviest low end in the flight", "low": "the lightest low end in the flight"},
    "texture": {"high": "one of the most textured surfaces here", "low": "one of the smoothest surfaces here"},
    "bursts": {"high": "the most segmented phrase in the flight", "low": "one of the least segmented phrases here"},
    "tail": {"high": "the longest finish in the flight", "low": "the shortest finish in the flight"},
    "force": {"high": "one of the strongest bodies in the flight", "low": "one of the gentlest bodies in the flight"},
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run a tiny Karpathy-style auto-research loop for fart sommelier note strategies."
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
        default=72,
        help="How many clips to sample from the dataset before building lineups.",
    )
    parser.add_argument(
        "--lineup-count",
        type=int,
        default=36,
        help="How many 3-clip flights to evaluate per run.",
    )
    parser.add_argument(
        "--generations",
        type=int,
        default=18,
        help="How many search generations to run.",
    )
    parser.add_argument(
        "--population",
        type=int,
        default=6,
        help="How many mutations to test per generation.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=11,
        help="Random seed for reproducible flights and mutations.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("analysis/audio/output/sommelier_latest"),
        help="Directory for results.tsv, report.md, and best strategy JSON.",
    )
    return parser.parse_args()


def clamp(value, lower, upper):
    return max(lower, min(upper, value))


def join_clauses(clauses):
    if not clauses:
        return "an oddly indescribable little event"
    if len(clauses) == 1:
        return clauses[0]
    if len(clauses) == 2:
        return f"{clauses[0]} and {clauses[1]}"
    return f"{', '.join(clauses[:-1])}, and {clauses[-1]}"


def stable_pick(options, key):
    digest = hashlib.sha1(key.encode("utf-8")).digest()
    index = int.from_bytes(digest[:4], "big") % len(options)
    return options[index]


def derive_dimensions(features):
    dominant = float(features["dominant_freq_hz"] or 0.0)
    centroid = float(features["spectral_centroid_hz"] or 0.0)
    pitch = dominant if dominant > 0 else centroid * 0.42

    texture = (
        float(features["spectral_flatness"]) * 3.2
        + float(features["zero_crossing_rate"]) * 1.6
        + float(features["high_band_ratio"]) * 0.8
    )
    rumble = (
        float(features["low_band_ratio"]) * 1.25
        - float(features["high_band_ratio"]) * 0.45
        + max(0.0, (220.0 - pitch) / 220.0) * 0.22
    )
    force = float(features["rms"]) * 6.0 + float(features["crest_factor"]) * 0.05
    tail = float(features["trimmed_fraction"]) * 0.45 + float(features["silence_ratio"]) * 0.55

    return {
        "pitch": pitch,
        "duration": float(features["trimmed_duration_s"]),
        "rumble": rumble,
        "texture": texture,
        "bursts": float(features["burst_count"]),
        "tail": tail,
        "force": force,
    }


def prepare_rows(files):
    rows = []
    for path in files:
        features = extract_features(path)
        features["dims"] = derive_dimensions(features)
        rows.append(features)
    return rows


def build_lineups(rows, lineup_count, seed):
    rng = random.Random(seed)
    indices = list(range(len(rows)))
    flights = []
    for _ in range(lineup_count):
        chosen = rng.sample(indices, 3)
        flights.append([rows[index] for index in chosen])
    return flights


def choose_facets(lineup, target_index, persona):
    facets = []
    target = lineup[target_index]

    for key in DIMENSION_ORDER:
        values = [float(item["dims"][key]) for item in lineup]
        mean = sum(values) / len(values)
        variance = sum((value - mean) ** 2 for value in values) / len(values)
        std = variance ** 0.5 or 1.0
        target_value = float(target["dims"][key])
        z_score = (target_value - mean) / std
        direction = "high" if z_score >= 0 else "low"
        facets.append(
            {
                "key": key,
                "direction": direction,
                "mean": mean,
                "std": std,
                "weight": float(persona["weights"][key]),
                "strength": abs(z_score) * float(persona["weights"][key]),
            }
        )

    facets.sort(key=lambda item: item["strength"], reverse=True)
    focus_count = int(clamp(int(persona.get("focus_count", 3)), 2, 4))
    return facets[:focus_count]


def render_note(lineup, target_index, persona, facets):
    target = lineup[target_index]
    style = persona["style"]
    lyricism = float(persona.get("lyricism", 1.0))
    clauses = []
    descriptor_terms = []
    for facet in facets:
        term = stable_pick(
            WORD_BANK[style][facet["key"]][facet["direction"]],
            f"{persona['id']}:{target['file_name']}:{facet['key']}:{facet['direction']}",
        )
        relation = RELATION_TEXT[facet["key"]][facet["direction"]]
        descriptor_terms.append(term)
        clauses.append(f"{term}, {relation}")

    if style == "poet":
        opener = stable_pick(
            [
                "A private little weather system",
                "A strangely intimate flourish",
                "A soft disturbance with ambition",
                "A small release that insists on being remembered",
            ],
            f"{persona['id']}:{target['file_name']}:open",
        )
        closer = stable_pick(
            [
                "Less force than personality.",
                "It stays in the imagination longer than in air.",
                "The room would remember it kindly.",
                "Subtle, but unwilling to be anonymous.",
            ],
            f"{persona['id']}:{target['file_name']}:close",
        )
        flourish = ""
        if lyricism > 1.0:
            flourish = " " + stable_pick(
                [
                    "It leaves a tiny emotional bruise.",
                    "The room would remember the curve of it.",
                    "Its exit is gentler than its confidence.",
                ],
                f"{persona['id']}:{target['file_name']}:flourish",
            )
        note = f"{opener}: {join_clauses(clauses)}. {closer}{flourish}"
    elif style == "naturalist":
        species = stable_pick(
            ["Rumbulus", "Ventoris", "Crepitus", "Sibila"],
            f"{target['file_name']}:{facets[0]['key']}:genus",
        )
        flourish = ""
        if lyricism > 0.95:
            flourish = " " + stable_pick(
                [
                    "Behavior suggests a certain domestic confidence.",
                    "A mild but memorable representative of the line.",
                    "Worth preserving as a reference specimen.",
                ],
                f"{persona['id']}:{target['file_name']}:flourish",
            )
        note = (
            f"Specimen {species}. Field notes: {join_clauses(clauses)}. "
            f"Observed as a viable member of this small flight.{flourish}"
        )
    else:
        closer = stable_pick(
            [
                "A disciplined pressure event.",
                "The waveform has strong self-respect.",
                "Signal quality is carrying the personality here.",
                "Measured, but not anonymous.",
            ],
            f"{persona['id']}:{target['file_name']}:close",
        )
        flourish = ""
        if lyricism > 0.9:
            flourish = " " + stable_pick(
                [
                    "There is elegance in the restraint.",
                    "Personality is emerging through the structure.",
                    "The metrics are doing more than merely qualifying it.",
                ],
                f"{persona['id']}:{target['file_name']}:flourish",
            )
        note = f"Readout: {join_clauses(clauses)}. {closer}{flourish}"

    lexical_span = len(set(descriptor_terms)) + max(0.0, lyricism - 0.8)
    return note, lexical_span


def predict_target(lineup, facets):
    scores = []
    for row in lineup:
        score = 0.0
        for facet in facets:
            z_score = (float(row["dims"][facet["key"]]) - facet["mean"]) / facet["std"]
            contribution = z_score if facet["direction"] == "high" else -z_score
            score += contribution * facet["weight"]
        scores.append(score)

    best_index = max(range(len(scores)), key=lambda index: scores[index])
    ordered = sorted(scores, reverse=True)
    margin = ordered[0] - ordered[1] if len(ordered) > 1 else ordered[0]
    return best_index, margin, scores


def evaluate_candidate(personas, lineups):
    total_trials = 0
    total_correct = 0
    total_margin = 0.0
    total_lexical = 0.0
    persona_metrics = []
    examples = []

    for persona in personas:
        correct = 0
        margin_sum = 0.0
        lexical_sum = 0.0

        for lineup_index, lineup in enumerate(lineups):
            target_index = lineup_index % len(lineup)
            facets = choose_facets(lineup, target_index, persona)
            note, lexical_span = render_note(lineup, target_index, persona, facets)
            predicted_index, margin, _ = predict_target(lineup, facets)
            success = int(predicted_index == target_index)

            total_trials += 1
            total_correct += success
            total_margin += margin
            total_lexical += lexical_span

            correct += success
            margin_sum += margin
            lexical_sum += lexical_span

            if len(examples) < 9:
                examples.append(
                    {
                        "persona": persona["name"],
                        "target_file": lineup[target_index]["file_name"],
                        "lineup": [row["file_name"] for row in lineup],
                        "note": note,
                        "correct": bool(success),
                    }
                )

        persona_metrics.append(
            {
                "id": persona["id"],
                "name": persona["name"],
                "accuracy": correct / len(lineups),
                "margin": margin_sum / len(lineups),
                "lexical": lexical_sum / len(lineups),
            }
        )

    match_accuracy = total_correct / max(total_trials, 1)
    mean_margin = total_margin / max(total_trials, 1)
    mean_lexical = total_lexical / max(total_trials, 1)
    style_balance = sum(item["accuracy"] for item in persona_metrics) / max(len(persona_metrics), 1)

    score = match_accuracy * 100.0 + mean_margin * 10.0 + mean_lexical * 2.5 + style_balance * 4.0

    return {
        "score": score,
        "match_accuracy": match_accuracy,
        "mean_margin": mean_margin,
        "mean_lexical": mean_lexical,
        "persona_metrics": persona_metrics,
        "examples": examples,
    }


def mutate_personas(personas, rng):
    candidate = deepcopy(personas)
    persona = rng.choice(candidate)
    dimension = rng.choice(DIMENSION_ORDER)
    persona["weights"][dimension] = round(
        clamp(float(persona["weights"][dimension]) + rng.uniform(-0.24, 0.24), 0.5, 1.7),
        4,
    )

    if rng.random() < 0.35:
        persona["focus_count"] = int(clamp(int(persona.get("focus_count", 3)) + rng.choice([-1, 1]), 2, 4))

    if rng.random() < 0.35:
        persona["lyricism"] = round(
            clamp(float(persona.get("lyricism", 1.0)) + rng.uniform(-0.18, 0.18), 0.45, 1.45),
            4,
        )

    return candidate


def write_results(history, output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "generation",
                "accepted",
                "score",
                "match_accuracy",
                "mean_margin",
                "mean_lexical",
            ],
            delimiter="\t",
        )
        writer.writeheader()
        writer.writerows(history)


def write_report(best_personas, best_result, output_path):
    lines = [
        "# Fart Sommelier Auto-Research",
        "",
        f"- Overall score: `{best_result['score']:.4f}`",
        f"- Match accuracy: `{best_result['match_accuracy']:.4f}`",
        f"- Mean decision margin: `{best_result['mean_margin']:.4f}`",
        f"- Mean lexical span: `{best_result['mean_lexical']:.4f}`",
        "",
        "## Persona Metrics",
        "",
    ]

    for metric in best_result["persona_metrics"]:
        lines.append(
            f"- `{metric['name']}`: accuracy {metric['accuracy']:.4f}, margin {metric['margin']:.4f}, lexical {metric['lexical']:.4f}"
        )

    lines.extend(["", "## Best Strategy Snapshot", ""])
    for persona in best_personas:
        weights = ", ".join(f"{key}={value}" for key, value in persona["weights"].items())
        lines.append(
            f"- `{persona['name']}`: focus_count={persona['focus_count']}, lyricism={persona['lyricism']}, weights {{{weights}}}"
        )

    lines.extend(["", "## Sample Notes", ""])
    for example in best_result["examples"][:9]:
        lines.append(f"- `{example['persona']}` on `{example['target_file']}` ({'hit' if example['correct'] else 'miss'}):")
        lines.append(f"  {example['note']}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n")


def main():
    args = parse_args()
    files = list_wavs(args.dataset_dir)
    sampled = sample_files(files, args.sample_size, args.seed)
    rows = prepare_rows(sampled)
    lineups = build_lineups(rows, args.lineup_count, args.seed)

    rng = random.Random(args.seed)
    best_personas = clone_personas()
    best_result = evaluate_candidate(best_personas, lineups)

    history = [
        {
            "generation": 0,
            "accepted": 1,
            "score": f"{best_result['score']:.6f}",
            "match_accuracy": f"{best_result['match_accuracy']:.6f}",
            "mean_margin": f"{best_result['mean_margin']:.6f}",
            "mean_lexical": f"{best_result['mean_lexical']:.6f}",
        }
    ]

    for generation in range(1, args.generations + 1):
        accepted = False
        generation_best_personas = best_personas
        generation_best_result = best_result

        for _ in range(args.population):
            candidate_personas = mutate_personas(best_personas, rng)
            candidate_result = evaluate_candidate(candidate_personas, lineups)
            if candidate_result["score"] > generation_best_result["score"]:
                generation_best_personas = candidate_personas
                generation_best_result = candidate_result
                accepted = True

        if generation_best_result["score"] > best_result["score"]:
            best_personas = generation_best_personas
            best_result = generation_best_result

        history.append(
            {
                "generation": generation,
                "accepted": int(accepted),
                "score": f"{generation_best_result['score']:.6f}",
                "match_accuracy": f"{generation_best_result['match_accuracy']:.6f}",
                "mean_margin": f"{generation_best_result['mean_margin']:.6f}",
                "mean_lexical": f"{generation_best_result['mean_lexical']:.6f}",
            }
        )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_results(history, args.output_dir / "results.tsv")
    write_report(best_personas, best_result, args.output_dir / "report.md")
    (args.output_dir / "best_personas.json").write_text(json.dumps(best_personas, indent=2) + "\n")
    (args.output_dir / "best_result.json").write_text(json.dumps(best_result, indent=2) + "\n")

    print(f"Wrote sommelier autoresearch bundle to {args.output_dir}")


if __name__ == "__main__":
    main()
