/// Picker order is the order of these cases.
enum WorkoutType: String, CaseIterable, Identifiable {
    case run
    case walk
    case cycle
    case strength
    case swim
    case yoga
    case other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .run: "Run"
        case .walk: "Walk"
        case .cycle: "Cycle"
        case .strength: "Strength"
        case .swim: "Swim"
        case .yoga: "Yoga"
        case .other: "Other"
        }
    }

    var symbolName: String {
        switch self {
        case .run: "figure.run"
        case .walk: "figure.walk"
        case .cycle: "figure.outdoor.cycle"
        case .strength: "dumbbell.fill"
        case .swim: "figure.pool.swim"
        case .yoga: "figure.mind.and.body"
        case .other: "figure.mixed.cardio"
        }
    }
}
