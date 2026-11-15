import Foundation
import SwiftData

@Model
class Workout {
    @Attribute(.unique) var uuid: UUID
    /// Raw `WorkoutType` value. Stored as text so SwiftData can save it directly.
    var typeRaw: String
    var startedAt: Date
    var durationMinutes: Int
    var distanceKilometres: Double?
    var notes: String

    init(valid: ValidWorkout, uuid: UUID = UUID()) {
        self.uuid = uuid
        self.typeRaw = valid.type.rawValue
        self.startedAt = valid.startedAt
        self.durationMinutes = valid.durationMinutes
        self.distanceKilometres = valid.distanceKilometres
        self.notes = valid.notes
    }

    var type: WorkoutType {
        get { WorkoutType(rawValue: typeRaw) ?? .other }
        set { typeRaw = newValue.rawValue }
    }

    var record: WorkoutRecord {
        WorkoutRecord(
            id: uuid,
            type: type,
            startedAt: startedAt,
            durationMinutes: durationMinutes,
            distanceKilometres: distanceKilometres,
            notes: notes
        )
    }

    func apply(_ valid: ValidWorkout) {
        typeRaw = valid.type.rawValue
        startedAt = valid.startedAt
        durationMinutes = valid.durationMinutes
        distanceKilometres = valid.distanceKilometres
        notes = valid.notes
    }
}

func workouts(matching records: [WorkoutRecord], in stored: [Workout]) -> [Workout] {
    var byUUID: [UUID: Workout] = [:]
    for workout in stored {
        byUUID[workout.uuid] = workout
    }
    return records.compactMap { byUUID[$0.id] }
}
