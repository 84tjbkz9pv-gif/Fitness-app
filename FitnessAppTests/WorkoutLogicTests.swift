import Foundation
import XCTest
@testable import FitnessApp

final class WorkoutLogicTests: XCTestCase {
    private func utcCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_GB")
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    private func makeDate(
        _ calendar: Calendar,
        year: Int,
        month: Int,
        day: Int,
        hour: Int = 0,
        minute: Int = 0
    ) throws -> Date {
        var components = DateComponents()
        components.calendar = calendar
        components.timeZone = calendar.timeZone
        components.year = year
        components.month = month
        components.day = day
        components.hour = hour
        components.minute = minute
        components.second = 0
        return try XCTUnwrap(components.date)
    }

    private func record(
        id: UUID = UUID(),
        type: WorkoutType = .run,
        startedAt: Date,
        durationMinutes: Int = 30,
        distanceKilometres: Double? = nil,
        notes: String = ""
    ) -> WorkoutRecord {
        WorkoutRecord(
            id: id,
            type: type,
            startedAt: startedAt,
            durationMinutes: durationMinutes,
            distanceKilometres: distanceKilometres,
            notes: notes
        )
    }

    private func draft(
        type: WorkoutType = .run,
        startedAt: Date = Date(timeIntervalSince1970: 0),
        durationText: String = "30",
        distanceText: String = "",
        notes: String = ""
    ) -> WorkoutDraft {
        WorkoutDraft(
            type: type,
            startedAt: startedAt,
            durationText: durationText,
            distanceText: distanceText,
            notes: notes
        )
    }

    private func requireSuccess(
        _ draft: WorkoutDraft,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws -> ValidWorkout {
        switch validate(draft) {
        case .success(let valid):
            return valid
        case .failure(let error):
            XCTFail("Expected a valid workout, got \(error)", file: file, line: line)
            throw CheckError.failed
        }
    }

    private enum CheckError: Error {
        case failed
    }

    // MARK: Types

    func testWorkoutTypesStayInPickerOrder() {
        XCTAssertEqual(
            WorkoutType.allCases.map(\.title),
            ["Run", "Walk", "Cycle", "Strength", "Swim", "Yoga", "Other"]
        )
    }

    // MARK: Validation

    func testDurationMustBeGreaterThanZero() {
        XCTAssertEqual(validate(draft(durationText: "0")), .failure(.durationNotPositive))
        XCTAssertEqual(validate(draft(durationText: "000")), .failure(.durationNotPositive))
        XCTAssertEqual(validate(draft(durationText: "-5")), .failure(.durationNotPositive))
        XCTAssertEqual(validate(draft(durationText: "")), .failure(.durationNotPositive))
        XCTAssertEqual(validate(draft(durationText: "   ")), .failure(.durationNotPositive))
    }

    func testDurationMustBeAWholeNumberOfMinutes() {
        XCTAssertEqual(validate(draft(durationText: "4.5")), .failure(.durationNotAWholeNumber))
        XCTAssertEqual(validate(draft(durationText: "4,5")), .failure(.durationNotAWholeNumber))
        XCTAssertEqual(validate(draft(durationText: "45min")), .failure(.durationNotAWholeNumber))
        XCTAssertEqual(validate(draft(durationText: "+45")), .failure(.durationNotAWholeNumber))
    }

    func testDurationAllowsSpacesAndLeadingZeros() throws {
        let padded = try requireSuccess(draft(durationText: "  45 "))
        XCTAssertEqual(padded.durationMinutes, 45)

        let leadingZero = try requireSuccess(draft(durationText: "08"))
        XCTAssertEqual(leadingZero.durationMinutes, 8)
    }

    func testBlankDistanceIsOmitted() throws {
        let empty = try requireSuccess(draft(distanceText: ""))
        XCTAssertNil(empty.distanceKilometres)

        let spaces = try requireSuccess(draft(distanceText: "   "))
        XCTAssertNil(spaces.distanceKilometres)
    }

    func testDistanceMustBeGreaterThanZeroWhenEntered() {
        XCTAssertEqual(validate(draft(distanceText: "0")), .failure(.distanceNotPositive))
        XCTAssertEqual(validate(draft(distanceText: "0.0")), .failure(.distanceNotPositive))
        XCTAssertEqual(validate(draft(distanceText: "-2")), .failure(.distanceNotPositive))
    }

    func testDistanceAcceptsADotOrAComma() throws {
        let dotted = try requireSuccess(draft(distanceText: "8.5"))
        XCTAssertEqual(dotted.distanceKilometres, 8.5)

        let comma = try requireSuccess(draft(distanceText: "  8,5 "))
        XCTAssertEqual(comma.distanceKilometres, 8.5)

        let fivePointTwo = try requireSuccess(draft(distanceText: "5,2"))
        XCTAssertEqual(fivePointTwo.distanceKilometres ?? -1, 5.2, accuracy: 0.000_001)

        let trailingDot = try requireSuccess(draft(distanceText: "5."))
        XCTAssertEqual(trailingDot.distanceKilometres, 5)

        let leadingDot = try requireSuccess(draft(distanceText: ".5"))
        XCTAssertEqual(leadingDot.distanceKilometres, 0.5)
    }

    func testDistanceRejectsTextAndExtraDots() {
        XCTAssertEqual(validate(draft(distanceText: "abc")), .failure(.distanceNotANumber))
        XCTAssertEqual(validate(draft(distanceText: "1.2.3")), .failure(.distanceNotANumber))
        XCTAssertEqual(validate(draft(distanceText: "5 km")), .failure(.distanceNotANumber))
    }

    func testNotesAreTrimmedAndTheRestIsKept() throws {
        let start = try makeDate(utcCalendar(), year: 2026, month: 11, day: 15, hour: 7, minute: 30)
        let valid = try requireSuccess(
            draft(
                type: .swim,
                startedAt: start,
                durationText: "25",
                distanceText: "1.5",
                notes: "  lane swimming\ntoday  "
            )
        )
        XCTAssertEqual(valid.type, .swim)
        XCTAssertEqual(valid.startedAt, start)
        XCTAssertEqual(valid.durationMinutes, 25)
        XCTAssertEqual(valid.distanceKilometres, 1.5)
        XCTAssertEqual(valid.notes, "lane swimming\ntoday")
    }

    func testDurationErrorIsReportedBeforeADistanceError() {
        XCTAssertEqual(
            validate(draft(durationText: "0", distanceText: "abc")),
            .failure(.durationNotPositive)
        )
        XCTAssertEqual(
            validate(draft(durationText: "abc", distanceText: "abc")),
            .failure(.durationNotAWholeNumber)
        )
    }

    func testValidationMessagesUseKilometres() {
        XCTAssertEqual(
            WorkoutValidationError.durationNotAWholeNumber.message,
            "Enter the duration as a whole number of minutes."
        )
        XCTAssertEqual(
            WorkoutValidationError.durationNotPositive.message,
            "Duration must be greater than zero."
        )
        XCTAssertEqual(
            WorkoutValidationError.distanceNotANumber.message,
            "Enter the distance in kilometres, or leave it blank."
        )
        XCTAssertEqual(
            WorkoutValidationError.distanceNotPositive.message,
            "Distance must be greater than zero, or leave it blank."
        )
    }

    func testDraftRoundTripsASavedWorkout() throws {
        let start = try makeDate(utcCalendar(), year: 2026, month: 6, day: 2, hour: 18, minute: 5)
        let saved = record(
            type: .cycle,
            startedAt: start,
            durationMinutes: 90,
            distanceKilometres: 25.5,
            notes: "Into the wind"
        )
        let edited = WorkoutDraft(record: saved)
        XCTAssertEqual(edited.type, .cycle)
        XCTAssertEqual(edited.startedAt, start)
        XCTAssertEqual(edited.durationText, "90")
        XCTAssertEqual(edited.distanceText, "25.5")
        XCTAssertEqual(edited.notes, "Into the wind")

        let again = try requireSuccess(edited)
        XCTAssertEqual(again.durationMinutes, 90)
        XCTAssertEqual(again.distanceKilometres, 25.5)
        XCTAssertEqual(again.notes, "Into the wind")

        let noDistance = WorkoutDraft(record: record(startedAt: start, distanceKilometres: nil))
        XCTAssertEqual(noDistance.distanceText, "")
        XCTAssertNil(try requireSuccess(noDistance).distanceKilometres)
    }

    // MARK: Today and grouping

    func testTodayIncludesOnlyThatCivilDay() throws {
        let calendar = utcCalendar()
        let midnight = try makeDate(calendar, year: 2026, month: 11, day: 15, hour: 0, minute: 0)
        let late = try makeDate(calendar, year: 2026, month: 11, day: 15, hour: 23, minute: 59)
        let nextMidnight = try makeDate(calendar, year: 2026, month: 11, day: 16, hour: 0, minute: 0)
        let previous = try makeDate(calendar, year: 2026, month: 11, day: 14, hour: 23, minute: 59)

        let records = [
            record(type: .walk, startedAt: nextMidnight),
            record(type: .strength, startedAt: previous),
            record(type: .yoga, startedAt: late),
            record(type: .run, startedAt: midnight),
        ]

        XCTAssertEqual(
            workouts(on: midnight, from: records, calendar: calendar).map(\.type),
            [.run, .yoga]
        )
        XCTAssertEqual(workouts(on: midnight, from: [], calendar: calendar), [])
    }

    func testTodayFollowsTheCalendarTimeZone() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_GB")
        calendar.timeZone = try XCTUnwrap(TimeZone(secondsFromGMT: 10 * 60 * 60))

        // 15:00 UTC on 15 November is 01:00 on 16 November in UTC+10.
        let instant = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-11-15T15:00:00Z"))
        let logged = record(type: .cycle, startedAt: instant)
        let fifteenth = try makeDate(calendar, year: 2026, month: 11, day: 15, hour: 12)
        let sixteenth = try makeDate(calendar, year: 2026, month: 11, day: 16, hour: 12)

        XCTAssertTrue(workouts(on: fifteenth, from: [logged], calendar: calendar).isEmpty)
        XCTAssertEqual(
            workouts(on: sixteenth, from: [logged], calendar: calendar).map(\.type),
            [.cycle]
        )
    }

    func testCivilDayAcrossTheAutumnClockChange() throws {
        var calendar = Calendar(identifier: .gregorian)
        guard let london = TimeZone(identifier: "Europe/London") else {
            throw XCTSkip("Europe/London timezone data is not installed.")
        }
        calendar.locale = Locale(identifier: "en_GB")
        calendar.timeZone = london

        let early = try makeDate(calendar, year: 2026, month: 10, day: 25, hour: 0, minute: 30)
        let later = try makeDate(calendar, year: 2026, month: 10, day: 25, hour: 2, minute: 30)
        let nextDay = try makeDate(calendar, year: 2026, month: 10, day: 26, hour: 0, minute: 30)
        let previousEvening = try makeDate(calendar, year: 2026, month: 10, day: 24, hour: 23, minute: 0)

        let records = [
            record(type: .walk, startedAt: nextDay),
            record(type: .yoga, startedAt: later),
            record(type: .run, startedAt: early),
            record(type: .strength, startedAt: previousEvening),
        ]

        XCTAssertEqual(
            workouts(on: early, from: records, calendar: calendar).map(\.type),
            [.run, .yoga]
        )

        let groups = groupedWorkoutsByDay(records, calendar: calendar)
        XCTAssertEqual(groups.map { calendar.component(.day, from: $0.day) }, [26, 25, 24])
        XCTAssertEqual(groups[1].workouts.map(\.type), [.run, .yoga])
    }

    func testGroupingOrdersDaysNewestFirstAndWorkoutsEarliestFirst() throws {
        let calendar = utcCalendar()
        let day16Evening = try makeDate(calendar, year: 2026, month: 11, day: 16, hour: 18)
        let day15Morning = try makeDate(calendar, year: 2026, month: 11, day: 15, hour: 7)
        let day16Morning = try makeDate(calendar, year: 2026, month: 11, day: 16, hour: 8)
        let day14Night = try makeDate(calendar, year: 2026, month: 11, day: 14, hour: 21)

        let records = [
            record(type: .strength, startedAt: day16Evening),
            record(type: .run, startedAt: day15Morning),
            record(type: .yoga, startedAt: day16Morning),
            record(type: .walk, startedAt: day14Night),
        ]

        let groups = groupedWorkoutsByDay(records, calendar: calendar)
        XCTAssertEqual(groups.map { calendar.component(.day, from: $0.day) }, [16, 15, 14])
        XCTAssertEqual(groups[0].day, calendar.startOfDay(for: day16Morning))
        XCTAssertEqual(groups[0].workouts.map(\.type), [.yoga, .strength])
        XCTAssertEqual(groups[1].workouts.map(\.type), [.run])
        XCTAssertEqual(groups[2].workouts.map(\.type), [.walk])
        XCTAssertEqual(groupedWorkoutsByDay([], calendar: calendar), [])
    }

    func testEqualStartTimesAreOrderedByIdentity() throws {
        let calendar = utcCalendar()
        let start = try makeDate(calendar, year: 2026, month: 11, day: 15, hour: 9)
        let later = try makeDate(calendar, year: 2026, month: 11, day: 15, hour: 10)
        let lower = try XCTUnwrap(UUID(uuidString: "00000000-0000-0000-0000-00000000000A"))
        let higher = try XCTUnwrap(UUID(uuidString: "00000000-0000-0000-0000-00000000000B"))
        let lowButLater = try XCTUnwrap(UUID(uuidString: "00000000-0000-0000-0000-000000000001"))

        let records = [
            record(id: higher, type: .yoga, startedAt: start),
            record(id: lowButLater, type: .strength, startedAt: later),
            record(id: lower, type: .run, startedAt: start),
        ]

        XCTAssertEqual(
            workouts(on: start, from: records, calendar: calendar).map(\.type),
            [.run, .yoga, .strength]
        )
    }

    // MARK: Labels

    func testDayHeadings() throws {
        let calendar = utcCalendar()
        let today = try makeDate(calendar, year: 2026, month: 11, day: 17, hour: 8)
        let lateToday = try makeDate(calendar, year: 2026, month: 11, day: 17, hour: 23, minute: 30)
        let yesterday = try makeDate(calendar, year: 2026, month: 11, day: 16, hour: 21)
        let earlier = try makeDate(calendar, year: 2026, month: 11, day: 15, hour: 8)

        XCTAssertEqual(dayHeading(for: today, now: today, calendar: calendar), "Today")
        XCTAssertEqual(dayHeading(for: lateToday, now: today, calendar: calendar), "Today")
        XCTAssertEqual(dayHeading(for: yesterday, now: today, calendar: calendar), "Yesterday")
        XCTAssertEqual(dayHeading(for: earlier, now: today, calendar: calendar), "Sunday, 15 November 2026")
    }

    func testYesterdayAcrossAMonthBoundary() throws {
        let calendar = utcCalendar()
        let now = try makeDate(calendar, year: 2026, month: 11, day: 1, hour: 9)
        let yesterday = try makeDate(calendar, year: 2026, month: 10, day: 31, hour: 21)
        XCTAssertEqual(dayHeading(for: yesterday, now: now, calendar: calendar), "Yesterday")
        XCTAssertEqual(longDate(yesterday, calendar: calendar), "Saturday, 31 October 2026")
    }

    func testLongDateUsesBritishOrder() throws {
        let calendar = utcCalendar()
        let november = try makeDate(calendar, year: 2026, month: 11, day: 15, hour: 15)
        let newYear = try makeDate(calendar, year: 2026, month: 1, day: 1, hour: 0)
        XCTAssertEqual(longDate(november, calendar: calendar), "Sunday, 15 November 2026")
        XCTAssertEqual(longDate(newYear, calendar: calendar), "Thursday, 1 January 2026")
    }

    func testDurationLabels() {
        XCTAssertEqual(durationLabel(minutes: 0), "0 minutes")
        XCTAssertEqual(durationLabel(minutes: -5), "0 minutes")
        XCTAssertEqual(durationLabel(minutes: 1), "1 minute")
        XCTAssertEqual(durationLabel(minutes: 45), "45 minutes")
        XCTAssertEqual(durationLabel(minutes: 60), "1 hour")
        XCTAssertEqual(durationLabel(minutes: 61), "1 hour 1 minute")
        XCTAssertEqual(durationLabel(minutes: 90), "1 hour 30 minutes")
        XCTAssertEqual(durationLabel(minutes: 120), "2 hours")
        XCTAssertEqual(durationLabel(minutes: 121), "2 hours 1 minute")
    }

    func testDistanceFieldTextAndSummary() throws {
        XCTAssertEqual(distanceFieldText(5), "5")
        XCTAssertEqual(distanceFieldText(5.2), "5.2")
        XCTAssertEqual(distanceFieldText(5.25), "5.25")
        XCTAssertEqual(distanceFieldText(8.5), "8.5")
        XCTAssertEqual(distanceFieldText(0.5), "0.5")
        XCTAssertEqual(distanceFieldText(1000.5), "1000.5")
        XCTAssertEqual(distanceLabel(kilometres: 5.2), "5.2 km")

        let calendar = utcCalendar()
        let morning = try makeDate(calendar, year: 2026, month: 11, day: 15, hour: 7, minute: 5)
        let evening = try makeDate(calendar, year: 2026, month: 11, day: 15, hour: 18)
        let run = record(startedAt: morning, durationMinutes: 45, distanceKilometres: 5.2, notes: "park")
        let yoga = record(type: .yoga, startedAt: evening, durationMinutes: 40)

        XCTAssertEqual(timeLabel(morning, calendar: calendar), "07:05")
        XCTAssertEqual(workoutSummary(run, calendar: calendar), "07:05 · 45 minutes · 5.2 km")
        XCTAssertEqual(workoutSummary(yoga, calendar: calendar), "18:00 · 40 minutes")

        let parsed = try requireSuccess(draft(distanceText: distanceFieldText(1000.5)))
        XCTAssertEqual(parsed.distanceKilometres ?? -1, 1000.5, accuracy: 0.000_001)
    }
}
