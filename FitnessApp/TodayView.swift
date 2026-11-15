import SwiftData
import SwiftUI

/// Today's date and the workouts that started today.
struct TodayView: View {
    @Query private var storedWorkouts: [Workout]

    @State private var isAdding = false
    @State private var workoutToEdit: Workout?

    var body: some View {
        let calendar = appCalendar()
        let now = Date.now
        let todayWorkouts = workoutsForToday(at: now, calendar: calendar)

        NavigationStack {
            Group {
                if todayWorkouts.isEmpty {
                    ContentUnavailableView {
                        VStack(spacing: 12) {
                            Image(systemName: "sun.max")
                                .font(.largeTitle)
                                .foregroundStyle(Color.accentColor)
                            Text(longDate(now, calendar: calendar))
                                .font(.title3.weight(.semibold))
                                .multilineTextAlignment(.center)
                            Text("Nothing logged today")
                                .font(.title2.weight(.semibold))
                        }
                    } description: {
                        Text("Add a run, walk, or any other session when you are ready.")
                    } actions: {
                        Button("Add workout") {
                            isAdding = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        Section {
                            ForEach(todayWorkouts) { workout in
                                WorkoutListRow(workout: workout, calendar: calendar) {
                                    workoutToEdit = workout
                                }
                            }
                        } header: {
                            Text(longDate(now, calendar: calendar))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .textCase(nil)
                        }
                    }
                }
            }
            .navigationTitle("Today")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isAdding = true
                    } label: {
                        Label("Add workout", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $isAdding) {
                NavigationStack {
                    WorkoutFormView(workout: nil)
                }
                .presentationDragIndicator(.visible)
            }
            .sheet(item: $workoutToEdit) { workout in
                NavigationStack {
                    WorkoutFormView(workout: workout)
                }
                .presentationDragIndicator(.visible)
            }
        }
    }

    private func workoutsForToday(at now: Date, calendar: Calendar) -> [Workout] {
        let records = workouts(on: now, from: storedWorkouts.map(\.record), calendar: calendar)
        return workouts(matching: records, in: storedWorkouts)
    }
}

#Preview("Empty") {
    TodayView()
        .previewScreen(samples: false)
}

#Preview("Logged") {
    TodayView()
        .previewScreen(samples: true)
}
