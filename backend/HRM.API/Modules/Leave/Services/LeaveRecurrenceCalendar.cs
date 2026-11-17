using HRM.API.Modules.Leave.DTOs;
namespace HRM.API.Modules.Leave.Services;
/// <summary>Calendar recurrence anchored at StartDate; cycle 1 occurs one full interval after that date.</summary>
public static class LeaveRecurrenceCalendar
{
    public static DateOnly? First(LeaveRecurrence? schedule) => schedule == null ? null : At(schedule, 1);
    public static DateOnly? Latest(LeaveRecurrence? schedule, DateOnly date)
    {
        if (schedule == null || schedule.Interval < 1 || schedule.StartDate > date) return null;
        var step = Months(schedule);
        var elapsed = (date.Year - schedule.StartDate.Year) * 12 + date.Month - schedule.StartDate.Month;
        var cycle = elapsed / step;
        if (cycle < 1) return null;
        var due = At(schedule, cycle);
        if (due > date) due = At(schedule, --cycle);
        return cycle >= 1 ? due : null;
    }
    public static DateOnly? After(LeaveRecurrence? schedule, DateOnly date)
    {
        if (schedule == null || schedule.Interval < 1) return null;
        var first = First(schedule);
        if (first == null || first > date) return first;
        var elapsed = (date.Year - schedule.StartDate.Year) * 12 + date.Month - schedule.StartDate.Month;
        var cycle = Math.Max(1, elapsed / Months(schedule));
        var next = At(schedule, cycle);
        return next <= date ? At(schedule, cycle + 1) : next;
    }
    private static int Months(LeaveRecurrence schedule) => schedule.Unit switch
    {
        "MONTH" => schedule.Interval,
        "YEAR" => checked(schedule.Interval * 12),
        _ => throw new ArgumentException("Unsupported recurrence unit.")
    };
    private static DateOnly? At(LeaveRecurrence schedule, int cycle)
    {
        if (cycle < 1 || schedule.Interval < 1) return null;
        var months = (long)Months(schedule) * cycle;
        if (months > (9999 - schedule.StartDate.Year) * 12L + 12 - schedule.StartDate.Month) return null;
        return schedule.StartDate.AddMonths((int)months);
    }
}
