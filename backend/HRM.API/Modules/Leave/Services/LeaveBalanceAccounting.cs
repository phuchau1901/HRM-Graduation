using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Leave.Services;
public sealed class LeaveBalanceAccounting(AppDbContext db, TimeProvider clock)
{
    private static string Json(object value) => JsonSerializer.Serialize(value, SettingsDefaults.Json);
    private static T Read<T>(string json) => JsonSerializer.Deserialize<T>(json, SettingsDefaults.Json) ?? throw BusinessException.Conflict("Invalid balance snapshot.");
    public void Record(string? actor, LeaveBalance balance, string action, string? before, string reason, Guid? operationId = null)
        => db.Add(new AuditLog { ActorUserID = actor, EntityType = "LeaveBalance", EntityID = balance.ID.ToString(global::System.Globalization.CultureInfo.InvariantCulture),
            Action = action, BeforeJSON = before, AfterJSON = Json(new { balance, reason, operationId }), CreatedAt = clock.GetUtcNow().UtcDateTime });
    public async Task ApplyAsync(LeaveRequest leave, string operation, string actor, CancellationToken ct)
    {
        if (leave.BalanceAllocationJson is null) throw BusinessException.Conflict("Legacy leave has no balance snapshot; operator review required.");
        foreach (var allocation in Read<BalanceAllocation[]>(leave.BalanceAllocationJson))
        {
            var balance = await db.Set<LeaveBalance>().FindAsync([allocation.BalanceId], ct) ?? throw BusinessException.Conflict("Balance no longer exists.");
            if (balance.EmployeeID != leave.EmployeeID || balance.LeaveTypeID != leave.LeaveTypeID) throw BusinessException.Conflict("Balance snapshot mismatch.");
            var before = Json(balance);
            if (operation == "REFUND")
            {
                if (balance.UsedDays < allocation.Days) throw BusinessException.Conflict("Insufficient used days to refund.");
                balance.UsedDays -= allocation.Days;
            }
            else
            {
                if (balance.ReservedDays < allocation.Days) throw BusinessException.Conflict("Reserved balance changed; operator review required.");
                balance.ReservedDays -= allocation.Days;
                if (operation == "USE") balance.UsedDays += allocation.Days;
            }
            balance.Version++;
            Record(actor, balance, "LEAVE_BALANCE_" + operation, before, $"Leave request #{leave.ID}: {operation}");
        }
    }
}
