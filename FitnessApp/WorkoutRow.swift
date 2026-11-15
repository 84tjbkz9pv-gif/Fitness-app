import SwiftData
import SwiftUI

struct WorkoutRow: View {
    var record: WorkoutRecord
    var calendar: Calendar

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: record.type.symbolName)
                .font(.title3)
                .foregroundStyle(Color.accentColor)
                .frame(width: 28, alignment: .center)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text(record.type.title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(workoutSummary(record, calendar: calendar))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if !record.notes.isEmpty {
                    Text(record.notes)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 8)

            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
                .padding(.top, 4)
        }
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
}

struct WorkoutListRow: View {
    @Environment(\.modelContext) private var modelContext

    var workout: Workout
    var calendar: Calendar
    var onEdit: () -> Void

    var body: some View {
        Button(action: onEdit) {
            WorkoutRow(record: workout.record, calendar: calendar)
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                modelContext.delete(workout)
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}
