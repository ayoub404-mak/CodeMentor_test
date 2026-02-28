# Define the complete learning path curriculum graph

CURRICULUM_PHASES = {
    "phase_1_fundamentals": [
        "variables",
        "operators",
        "conditionals",
        "loops",
        "functions",
        "string_manipulation"
    ],
    "phase_2_data_structures": [
        "lists_tuples",
        "dictionaries_sets",
        "stacks_queues",
        "linked_lists",
        "trees",
        "graphs"
    ],
    "phase_3_algorithms": [
        "searching",
        "sorting",
        "recursion",
        "dynamic_programming",
        "two_pointers"
    ]
}

def get_next_topic(current_topic: str | None, level: str) -> str:
    """Determine the next logical topic based on the curriculum graph."""
    if not current_topic:
        if level == "beginner":
            return "variables"
        elif level == "intermediate":
            return "lists_tuples"
        elif level == "advanced":
            return "searching"
        else:
            return "variables"

    # Flatten all topics into a single ordered list
    all_topics = (
        CURRICULUM_PHASES["phase_1_fundamentals"] +
        CURRICULUM_PHASES["phase_2_data_structures"] +
        CURRICULUM_PHASES["phase_3_algorithms"]
    )

    try:
        current_idx = all_topics.index(current_topic)
        if current_idx + 1 < len(all_topics):
            return all_topics[current_idx + 1]
    except ValueError:
        pass

    return "course_completed"
