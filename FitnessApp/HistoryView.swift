import SwiftData
import SwiftUI

/// Every logged workout, including today, grouped with older days.
struct HistoryView: View {
    @Query private var storedWorkouts: [Workout]

    @State private var isAdding = false
    @State private var workoutToEdit: Workout?

    var body: some View {
        let calendar = appCalendar()
        let now = Date.now
        let sections = historySections(calendar: calendar)

        NavigationStack {
            Group {
                if sections.isEmpty {
                    ContentUnavailableView {
                        Label("No workouts yet", systemImage: "calendar")
                    } description: {
                        Text("Workouts you add show up here, grouped by day.")
                    } actions: {
                        Button("Add workout") {
                            isAdding = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        ForEach(sections) { section in
                            Section {
                                ForEach(section.workouts) { workout in
                                    WorkoutListRow(workout: workout, calendar: calendar) {
                                        workoutToEdit = workout
                                    }
                                }
                            } header: {
                                Text(dayHeading(for: section.day, now: now, calendar: calendar))
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .textCase(nil)
                            }
                        }
                    }
                }
            }
            .navigationTitle("History")
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

    private func historySections(calendar: Calendar) -> [DaySection] {
        groupedWorkoutsByDay(storedWorkouts.map(\.record), calendar: calendar).map { group in
            DaySection(
                day: group.day,
                workouts: workouts(matching: group.workouts, in: storedWorkouts)
            )
        }
    }

    private struct DaySection: Identifiable {
        var day: Date
        var workouts: [Workout]
        var id: Date { day }
    }
}

#Preview("Empty") {
    HistoryView()
        .previewScreen(samples: false)
}

#Preview("Logged") {
    HistoryView()
        .previewScreen(samples: true)
}
