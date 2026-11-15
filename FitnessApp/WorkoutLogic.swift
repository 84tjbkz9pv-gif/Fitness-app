import Foundation

// MARK: - Values

struct WorkoutRecord: Equatable, Identifiable {
    var id: UUID
    var type: WorkoutType
    var startedAt: Date
    var durationMinutes: Int
    var distanceKilometres: Double?
    var notes: String
}

/// What the form is editing. Text fields stay strings until Save.
struct WorkoutDraft: Equatable {
    var type: WorkoutType = .run
    var startedAt: Date = .now
    var durationText: String = "30"
    var distanceText: String = ""
    var notes: String = ""
}

extension WorkoutDraft {
    init(record: WorkoutRecord) {
        self.init(
            type: record.type,
            startedAt: record.startedAt,
            durationText: String(record.durationMinutes),
            distanceText: record.distanceKilometres.map(distanceFieldText) ?? "",
            notes: record.notes
        )
    }
}

/// A workout that has already passed validation.
struct ValidWorkout: Equatable {
    var type: WorkoutType
    var startedAt: Date
    var durationMinutes: Int
    var distanceKilometres: Double?
    var notes: String
}

struct WorkoutDayGroup: Equatable, Identifiable {
    /// Start of this calendar day in the calendar used to group workouts.
    var day: Date
    var workouts: [WorkoutRecord]

    var id: Date { day }
}

enum WorkoutValidationError: Equatable, Error {
    case durationNotAWholeNumber
    case durationNotPositive
    case distanceNotANumber
    case distanceNotPositive

    var message: String {
        switch self {
        case .durationNotAWholeNumber:
            "Enter the duration as a whole number of minutes."
        case .durationNotPositive:
            "Duration must be greater than zero."
        case .distanceNotANumber:
            "Enter the distance in kilometres, or leave it blank."
        case .distanceNotPositive:
            "Distance must be greater than zero, or leave it blank."
        }
    }
}

// MARK: - Validation

func validate(_ draft: WorkoutDraft) -> Result<ValidWorkout, WorkoutValidationError> {
    let minutes: Int
    switch parseDurationMinutes(draft.durationText) {
    case .failure(let error):
        return .failure(error)
    case .success(let value):
        minutes = value
    }

    let distance: Double?
    switch parseDistanceKilometres(draft.distanceText) {
    case .failure(let error):
        return .failure(error)
    case .success(let value):
        distance = value
    }

    return .success(
        ValidWorkout(
            type: draft.type,
            startedAt: draft.startedAt,
            durationMinutes: minutes,
            distanceKilometres: distance,
            notes: draft.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    )
}

/// Blank means no distance. A comma is read as a decimal point, so `5,2` is 5.2 kilometres.
private func parseDistanceKilometres(_ text: String) -> Result<Double?, WorkoutValidationError> {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
        return .success(nil)
    }

    var normalised = trimmed.replacingOccurrences(of: ",", with: ".")
    if normalised.hasSuffix(".") {
        normalised.removeLast()
    }

    guard isDecimalNumber(normalised), let value = Double(normalised), value.isFinite else {
        return .failure(.distanceNotANumber)
    }
    guard value > 0 else {
        return .failure(.distanceNotPositive)
    }
    return .success(value)
}

private func parseDurationMinutes(_ text: String) -> Result<Int, WorkoutValidationError> {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
        return .failure(.durationNotPositive)
    }

    if trimmed.hasPrefix("-"), let value = Int(trimmed), value <= 0 {
        return .failure(.durationNotPositive)
    }

    let digits = CharacterSet.decimalDigits
    guard trimmed.unicodeScalars.allSatisfy({ digits.contains($0) }), let value = Int(trimmed) else {
        return .failure(.durationNotAWholeNumber)
    }
    guard value > 0 else {
        return .failure(.durationNotPositive)
    }
    return .success(value)
}

private func isDecimalNumber(_ text: String) -> Bool {
    var digits = Substring(text)
    if digits.first == "-" {
        digits = digits.dropFirst()
    }
    if digits.isEmpty {
        return false
    }

    let parts = digits.split(separator: ".", omittingEmptySubsequences: false)
    guard parts.count == 1 || parts.count == 2 else {
        return false
    }

    let whole = parts[0]
    if parts.count == 1 {
        return !whole.isEmpty && whole.allSatisfy(\.isNumber)
    }

    let fraction = parts[1]
    let fractionIsDigits = !fraction.isEmpty && fraction.allSatisfy(\.isNumber)
    if whole.isEmpty {
        return fractionIsDigits
    }
    return whole.allSatisfy(\.isNumber) && fractionIsDigits
}

// MARK: - Days

/// Gregorian calendar in British English, using the phone's time zone unless one is passed in.
func appCalendar(timeZone: TimeZone = .current) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.locale = Locale(identifier: "en_GB")
    calendar.timeZone = timeZone
    return calendar
}

/// Workouts whose start falls on the same civil day as `day`, earliest first.
func workouts(on day: Date, from records: [WorkoutRecord], calendar: Calendar) -> [WorkoutRecord] {
    let start = calendar.startOfDay(for: day)
    guard let end = calendar.date(byAdding: .day, value: 1, to: start) else {
        return []
    }
    return records
        .filter { $0.startedAt >= start && $0.startedAt < end }
        .sorted(by: earlierWorkout)
}

/// Days are newest first. Workouts inside a day are earliest first.
func groupedWorkoutsByDay(_ records: [WorkoutRecord], calendar: Calendar) -> [WorkoutDayGroup] {
    let grouped = Dictionary(grouping: records) { record in
        calendar.startOfDay(for: record.startedAt)
    }
    return grouped
        .map { day, dayRecords in
            WorkoutDayGroup(day: day, workouts: dayRecords.sorted(by: earlierWorkout))
        }
        .sorted { $0.day > $1.day }
}

private func earlierWorkout(_ lhs: WorkoutRecord, _ rhs: WorkoutRecord) -> Bool {
    if lhs.startedAt != rhs.startedAt {
        return lhs.startedAt < rhs.startedAt
    }
    return lhs.id.uuidString < rhs.id.uuidString
}

// MARK: - Labels

func dayHeading(for day: Date, now: Date, calendar: Calendar) -> String {
    if calendar.isDate(day, inSameDayAs: now) {
        return "Today"
    }
    if let yesterday = calendar.date(byAdding: .day, value: -1, to: now),
       calendar.isDate(day, inSameDayAs: yesterday) {
        return "Yesterday"
    }
    return longDate(day, calendar: calendar)
}

/// British date, for example "Sunday, 15 November 2026".
/// The start picker follows the phone's own settings; this heading does not.
func longDate(_ date: Date, calendar: Calendar) -> String {
    let day = calendar.component(.day, from: date)
    let year = calendar.component(.year, from: date)
    let weekday = weekdayName(calendar.component(.weekday, from: date))
    let month = monthName(calendar.component(.month, from: date))
    return "\(weekday), \(day) \(month) \(year)"
}

func timeLabel(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.hour, .minute], from: date)
    return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
}

func durationLabel(minutes: Int) -> String {
    guard minutes > 0 else { return "0 minutes" }

    let hours = minutes / 60
    let remainder = minutes % 60
    var parts: [String] = []
    if hours > 0 {
        parts.append(hours == 1 ? "1 hour" : "\(hours) hours")
    }
    if remainder > 0 {
        parts.append(remainder == 1 ? "1 minute" : "\(remainder) minutes")
    }
    return parts.joined(separator: " ")
}

func distanceLabel(kilometres: Double) -> String {
    "\(distanceFieldText(kilometres)) km"
}

/// Dot as the decimal mark, and no thousands separator, so the text can be parsed again.
func distanceFieldText(_ kilometres: Double) -> String {
    guard kilometres.isFinite else { return "0" }

    let scaled = (abs(kilometres) * 100).rounded()
    guard scaled.isFinite, let hundredths = Int(exactly: scaled), hundredths >= 0 else {
        return "0"
    }

    let whole = hundredths / 100
    let fraction = hundredths % 100
    let digits: String
    if fraction == 0 {
        digits = "\(whole)"
    } else if fraction.isMultiple(of: 10) {
        digits = "\(whole).\(fraction / 10)"
    } else {
        digits = String(format: "%d.%02d", whole, fraction)
    }

    if kilometres < 0 {
        return "-\(digits)"
    }
    return digits
}

func workoutSummary(_ record: WorkoutRecord, calendar: Calendar) -> String {
    var parts = [
        timeLabel(record.startedAt, calendar: calendar),
        durationLabel(minutes: record.durationMinutes),
    ]
    if let distance = record.distanceKilometres {
        parts.append(distanceLabel(kilometres: distance))
    }
    return parts.joined(separator: " · ")
}

private func weekdayName(_ index: Int) -> String {
    switch index {
    case 1: "Sunday"
    case 2: "Monday"
    case 3: "Tuesday"
    case 4: "Wednesday"
    case 5: "Thursday"
    case 6: "Friday"
    case 7: "Saturday"
    default: ""
    }
}

private func monthName(_ index: Int) -> String {
    switch index {
    case 1: "January"
    case 2: "February"
    case 3: "March"
    case 4: "April"
    case 5: "May"
    case 6: "June"
    case 7: "July"
    case 8: "August"
    case 9: "September"
    case 10: "October"
    case 11: "November"
    case 12: "December"
    default: ""
    }
}
