import SwiftData
import SwiftUI

/// Personal workout log. Workouts stay on this phone.
@main
struct FitnessAppEntry: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(for: Workout.self)
    }
}
