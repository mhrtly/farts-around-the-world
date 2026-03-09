from copy import deepcopy


BASE_PERSONAS = [
    {
        "id": "poet",
        "name": "Velvet Reed",
        "style": "poet",
        "focus_count": 3,
        "lyricism": 1.15,
        "weights": {
            "pitch": 1.05,
            "duration": 0.95,
            "rumble": 1.25,
            "texture": 1.2,
            "bursts": 0.8,
            "tail": 1.1,
            "force": 0.9,
        },
    },
    {
        "id": "naturalist",
        "name": "Dr. Fenwick Loam",
        "style": "naturalist",
        "focus_count": 3,
        "lyricism": 0.85,
        "weights": {
            "pitch": 0.95,
            "duration": 1.15,
            "rumble": 1.0,
            "texture": 0.95,
            "bursts": 1.2,
            "tail": 1.0,
            "force": 0.9,
        },
    },
    {
        "id": "engineer",
        "name": "A. Resonance",
        "style": "engineer",
        "focus_count": 3,
        "lyricism": 0.65,
        "weights": {
            "pitch": 1.0,
            "duration": 1.1,
            "rumble": 0.9,
            "texture": 1.2,
            "bursts": 1.3,
            "tail": 1.05,
            "force": 1.15,
        },
    },
]


def clone_personas():
    return deepcopy(BASE_PERSONAS)
