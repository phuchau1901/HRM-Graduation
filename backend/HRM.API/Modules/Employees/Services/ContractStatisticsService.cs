using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Employees.Services;

public sealed class ContractStatisticsService(AppDbContext db, EmployeeDataScope scopes, TimeProvider clock)
{
    public async Task<ContractStatisticsResponse> GetAsync(string actor, ContractStatisticsQuery query, CancellationToken ct)
    {
        var access = await scopes.GetAsync(actor, "WEB_CONTRACTS", "VIEW", ct);
        var employees = access.Apply(db.Employees.AsNoTracking());
        var today = VietnamBusinessDate.Today(clock);
        var through = today.AddDays(query.ExpiringWithinDays);
        var contracts = from contract in db.Set<Contract>().AsNoTracking()
                        join employee in employees on contract.EmployeeID equals employee.Id
                        select contract;
        var totals = await Aggregate(contracts, today, through).SingleOrDefaultAsync(ct);
        return new(true, new(totals?.Active ?? 0, totals?.ExpiringSoon ?? 0, totals?.Expired ?? 0, query.ExpiringWithinDays, today));
    }

    // One SQL aggregate after the employee-scope filter; no contracts are materialized.
    internal static IQueryable<ContractStatisticsTotals> Aggregate(IQueryable<Contract> contracts, DateOnly today, DateOnly through) =>
        contracts.Where(c => c.StartDate <= today && (c.Status == "ACTIVE" || c.Status == "EXPIRED"))
            .GroupBy(c => 1).Select(g => new ContractStatisticsTotals(
                g.Count(c => c.Status == "ACTIVE" && (!c.EndDate.HasValue || c.EndDate > through)),
                g.Count(c => c.Status == "ACTIVE" && c.EndDate >= today && c.EndDate <= through),
                g.Count(c => c.EndDate < today)));
}
internal sealed record ContractStatisticsTotals(int Active, int ExpiringSoon, int Expired);
