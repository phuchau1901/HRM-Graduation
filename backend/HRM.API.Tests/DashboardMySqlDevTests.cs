using HRM.API.Data;
using HRM.API.Modules.Dashboard.DTOs;
using HRM.API.Modules.Dashboard.Services;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Notifications.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Xunit;
namespace HRM.API.Tests;
public sealed class DashboardDevFactAttribute:FactAttribute {
 public DashboardDevFactAttribute() {
  if(string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("HRM_DASHBOARD_DEV_CONNECTION"))||string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("HRM_DASHBOARD_DEV_ACTOR")))
   Skip="Opt-in Railway DEV read-only check: configure HRM_DASHBOARD_DEV_CONNECTION and HRM_DASHBOARD_DEV_ACTOR locally; never paste credentials.";
 }
}
public sealed class DashboardMySqlDevTests {
 private sealed class NoWritesAuthorization:IAuthorizationService {
  public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user,object? resource,IEnumerable<IAuthorizationRequirement> requirements)=>Task.FromResult(AuthorizationResult.Failed());
  public Task<AuthorizationResult> AuthorizeAsync(ClaimsPrincipal user,object? resource,string policyName)=>Task.FromResult(AuthorizationResult.Failed());
 }
 [DashboardDevFact]
 public async Task October2026ReadModelsUseExistingDevDataWithoutMigrationsOrWrites() {
  var connection=Environment.GetEnvironmentVariable("HRM_DASHBOARD_DEV_CONNECTION")!;
  var actor=Environment.GetEnvironmentVariable("HRM_DASHBOARD_DEV_ACTOR")!;
  var options=new DbContextOptionsBuilder<AppDbContext>().UseMySql(connection,new MySqlServerVersion(new Version(8,0,36))).Options;
  await using var db=new AppDbContext(options);
  await db.Database.OpenConnectionAsync();
  await db.Database.ExecuteSqlRawAsync("SET TRANSACTION READ ONLY");
  await using var tx=await db.Database.BeginTransactionAsync();
  var permissions=new PermissionService(db);var clock=TimeProvider.System;
  var service=new DashboardService(db,new EmployeeDataScope(db,permissions),permissions,new SystemSettingsService(db,permissions,clock),new NotificationService(db,new NoWritesAuthorization()),clock);
  var q=new DashboardQuery{Year=2026,Month=10};
  var summary=await service.Summary(actor,q,default);Assert.Equal("2026-10",summary.Period.PeriodKey);
  var mine=await service.Mine(actor,q,default);Assert.Equal("SELF",mine.Payroll?.Scope??"SELF");
  if(await permissions.HasPermissionAsync(actor,"WEB_EMPLOYEES","VIEW"))Assert.All(await service.Departments(actor,q,default),d=>Assert.True(d.Employees>=0));
  if(await permissions.HasPermissionAsync(actor,"WEB_ATTENDANCE","VIEW")) {
   var trend=await service.AttendanceTrend(actor,q,default);Assert.True(trend.Totals.Absent>=0);Assert.Equal(trend.Days.Sum(d=>d.Metrics.Scheduled),trend.Totals.Scheduled);
  }
  if(await permissions.HasPermissionAsync(actor,"WEB_APPROVALS","VIEW"))Assert.True((await service.Pending(actor,q,default)).Total>=0);
  if(await permissions.HasPermissionAsync(actor,"WEB_KPI_EVALUATION","VIEW"))Assert.True((await service.Kpi(actor,q,default)).Assigned>=0);
  if(await permissions.HasPermissionAsync(actor,"WEB_PAYROLL","VIEW")) {
   var payroll=await service.Payroll(actor,q,default);Assert.Equal(payroll.Statuses.Sum(s=>s.Net),payroll.Net);Assert.Equal(payroll.Gross-payroll.Deductions,payroll.Net);
  }
  await tx.RollbackAsync();
 }
}
