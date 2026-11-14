using System.Globalization;
using HRM.API.Data;
using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Employees.Services;

/// <summary>Uses the database identity, never a code MAX or a process-local counter.</summary>
public sealed class EmployeeCodeGenerator(AppDbContext db)
{
    public static string Format(int id)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(id);
        return "TX" + id.ToString("D6", CultureInfo.InvariantCulture);
    }
    public async Task AddAsync(Employee employee, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Employee code generation requires an explicit transaction.");
        while (true)
        {
            // NOT NULL/unique stays enforced. This value is private to the uncommitted transaction.
            employee.EmployeeCode = "~" + Guid.NewGuid().ToString("N")[..19];
            db.Employees.Add(employee);
            await db.SaveChangesAsync(ct);
            var code = Format(employee.Id);
            if (await db.Employees.AnyAsync(x => x.EmployeeCode == code, ct))
            {
                // A legacy manually assigned code may occupy a future identity slot.
                // Consume only this provisional identity; never rewrite a legacy row.
                db.Employees.Remove(employee);
                await db.SaveChangesAsync(ct);
                employee.Id = 0;
                continue;
            }
            employee.EmployeeCode = code;
            await db.SaveChangesAsync(ct);
            return;
        }
    }
}
