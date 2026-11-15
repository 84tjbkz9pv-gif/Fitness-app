import SwiftData
import SwiftUI

/// Add or edit one workout. The draft is kept until Save, so Cancel leaves the stored workout unchanged.
struct WorkoutFormView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    private let workout: Workout?

    @State private var draft: WorkoutDraft
    @State private var validationMessage: String?
    @State private var isConfirmingDelete = false
    @FocusState private var focusedField: Field?

    init(workout: Workout?) {
        self.workout = workout
        if let workout {
            _draft = State(initialValue: WorkoutDraft(record: workout.record))
        } else {
            _draft = State(initialValue: WorkoutDraft())
        }
    }

    var body: some View {
        Form {
            Section {
                Picker("Type", selection: $draft.type) {
                    ForEach(WorkoutType.allCases) { type in
                        Label(type.title, systemImage: type.symbolName)
                            .tag(type)
                    }
                }
                DatePicker(
                    "Start",
                    selection: $draft.startedAt,
                    displayedComponents: [.date, .hourAndMinute]
                )
                TextField("Duration (minutes)", text: $draft.durationText)
                    .keyboardType(.numberPad)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .duration)
                TextField("Distance (km)", text: $draft.distanceText, prompt: Text("Optional"))
                    .keyboardType(.decimalPad)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .distance)
                TextField("Notes", text: $draft.notes, prompt: Text("Optional"), axis: .vertical)
                    .lineLimit(3...6)
                    .focused($focusedField, equals: .notes)
                if let validationMessage {
                    Text(validationMessage)
                        .font(.subheadline)
                        .foregroundStyle(.red)
                }
            }

            if workout != nil {
                Section {
                    Button("Delete workout", role: .destructive) {
                        isConfirmingDelete = true
                    }
                }
            }
        }
        .navigationTitle(workout == nil ? "Add workout" : "Edit workout")
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
            }
            ToolbarItem(placement: .keyboard) {
                Button("Done") { focusedField = nil }
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .onChange(of: draft) {
            validationMessage = nil
        }
        .confirmationDialog(
            "Delete this workout?",
            isPresented: $isConfirmingDelete,
            titleVisibility: .visible
        ) {
            Button("Delete workout", role: .destructive) {
                if let workout {
                    modelContext.delete(workout)
                }
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes it from this phone.")
        }
    }

    private func save() {
        switch validate(draft) {
        case .failure(let error):
            validationMessage = error.message
        case .success(let valid):
            if let workout {
                workout.apply(valid)
            } else {
                modelContext.insert(Workout(valid: valid))
            }
            dismiss()
        }
    }

    private enum Field: Hashable {
        case duration
        case distance
        case notes
    }
}

#Preview("Add") {
    NavigationStack {
        WorkoutFormView(workout: nil)
    }
    .previewScreen(samples: false)
}

#Preview("Edit") {
    let container = previewContainer(samples: true)
    let workout = try? container.mainContext.fetch(FetchDescriptor<Workout>()).first
    NavigationStack {
        WorkoutFormView(workout: workout)
    }
    .modelContainer(container)
}
