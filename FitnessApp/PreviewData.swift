import SwiftData
import SwiftUI

@MainActor
func previewContainer(samples: Bool) -> ModelContainer {
    let configuration = ModelConfiguration(isStoredInMemoryOnly: true)
    let container: ModelContainer
    do {
        container = try ModelContainer(for: Workout.self, configurations: configuration)
    } catch {
        fatalError("Could not create the preview store: \(error)")
    }

    guard samples else { return container }

    let calendar = appCalendar()
    let now = Date.now

    func at(hour: Int, minute: Int, daysAgo: Int) -> Date {
        let day = calendar.date(byAdding: .day, value: -daysAgo, to: now) ?? now
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
    }

    let samplesToInsert = [
        ValidWorkout(
            type: .run,
            startedAt: at(hour: 8, minute: 0, daysAgo: 0),
            durationMinutes: 32,
            distanceKilometres: 5.2,
            notes: "Easy loop round the park."
        ),
        ValidWorkout(
            type: .strength,
            startedAt: at(hour: 18, minute: 15, daysAgo: 0),
            durationMinutes: 25,
            distanceKilometres: nil,
            notes: "Short session at home."
        ),
        ValidWorkout(
            type: .yoga,
            startedAt: at(hour: 19, minute: 0, daysAgo: 1),
            durationMinutes: 40,
            distanceKilometres: nil,
            notes: ""
        ),
    ]

    for sample in samplesToInsert {
        container.mainContext.insert(Workout(valid: sample))
    }
    try? container.mainContext.save()
    return container
}

extension View {
    @MainActor
    func previewScreen(samples: Bool) -> some View {
        modelContainer(previewContainer(samples: samples))
    }
}
