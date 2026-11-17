using HRM.API.Modules.Approvals.DTOs;
using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Leave.Controllers;
[ApiController, Authorize, ServiceFilter(typeof(BusinessExceptionFilter))]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class LeaveWorkflowController(LeaveWorkflowService service) : ControllerBase
{
    private string Actor => User.FindFirst("sub")!.Value;
    [HttpGet("api/system-settings/leave-accrual"), ScreenPermission(LeaveWorkflowService.AccrualSettingsScreen, "VIEW")]
    public async Task<IActionResult> AccrualSettings(CancellationToken ct) => Ok(await service.GetAccrualSettings(Actor, ct));
    [HttpPut("api/system-settings/leave-accrual"), ScreenPermission(LeaveWorkflowService.AccrualSettingsScreen, "UPDATE")]
    public async Task<IActionResult> SaveAccrualSettings(LeaveAccrualSettingsRequest r, CancellationToken ct) => Ok(await service.SaveAccrualSettings(Actor, r, ct));
    [HttpPost("api/system-settings/leave-accrual/run"), ScreenPermission(LeaveWorkflowService.AccrualSettingsScreen, "UPDATE")]
    public async Task<IActionResult> RunAccrual(CancellationToken ct) => Ok(await service.RunAccrualNow(Actor, ct));
    [HttpGet("api/leave-types"), ScreenPermission(LeaveWorkflowService.Types, "VIEW")]
    public async Task<IActionResult> Types([FromQuery] WorkflowQuery q, CancellationToken ct) => Ok(await service.LeaveTypes(Actor, q, ct));
    [HttpPost("api/leave-types"), ScreenPermission(LeaveWorkflowService.Types, "NEW")]
    public async Task<IActionResult> CreateType(LeaveTypeRequest r, CancellationToken ct) => StatusCode(201, await service.SaveType(Actor, null, r, ct));
    [HttpPut("api/leave-types/{id:long}"), ScreenPermission(LeaveWorkflowService.Types, "UPDATE")]
    public async Task<IActionResult> UpdateType(long id, LeaveTypeRequest r, CancellationToken ct) => Ok(await service.SaveType(Actor, id, r, ct));
    [HttpGet("api/leave-balances"), ScreenPermission(LeaveWorkflowService.Balances, "VIEW")]
    public async Task<IActionResult> Balances([FromQuery] WorkflowQuery q, CancellationToken ct) => Ok(await service.LeaveBalances(Actor, q, ct));
    [HttpGet("api/leave-balances/me"), ScreenPermission(LeaveWorkflowService.Balances, "VIEW")]
    public async Task<IActionResult> MyBalances([FromQuery] MyBalanceQuery q, CancellationToken ct) => Ok(new { success = true, data = await service.MyLeaveBalances(Actor, q, ct) });
    [HttpPut("api/leave-balances"), ScreenPermission(LeaveWorkflowService.Balances, "UPDATE")]
    public async Task<IActionResult> Balance(BalanceRequest r, CancellationToken ct) => Ok(await service.SaveBalance(Actor, r, ct));
    [HttpPost("api/leave-balances/grants"), ScreenPermission(LeaveWorkflowService.Balances, "UPDATE")]
    public async Task<IActionResult> GrantBalances(BalanceGrantRequest r, CancellationToken ct) => Ok(await service.GrantLeaveBalances(Actor, r, ct));
    [HttpPost("api/leave-balances/{id:long}/adjustments"), ScreenPermission(LeaveWorkflowService.Balances, "UPDATE")]
    public async Task<IActionResult> AdjustBalance(long id, BalanceAdjustmentRequest r, CancellationToken ct) => Ok(await service.AdjustLeaveBalance(Actor, id, r, ct));
    [HttpGet("api/leave-balances/{id:long}/history"), ScreenPermission(LeaveWorkflowService.Balances, "VIEW")]
    public async Task<IActionResult> BalanceHistory(long id, [FromQuery] WorkflowQuery q, CancellationToken ct) => Ok(await service.LeaveBalanceHistory(Actor, id, q, ct));
    [HttpGet("api/leave-requests"), ScreenPermission(LeaveWorkflowService.Leave, "VIEW")]
    public async Task<IActionResult> Leaves([FromQuery] WorkflowQuery q, CancellationToken ct) => Ok(await service.Leaves(Actor, q, ct));
    [HttpGet("api/leave-requests/{id:long}"), ScreenPermission(LeaveWorkflowService.Leave, "VIEW")]
    public async Task<IActionResult> Leave(long id, CancellationToken ct) => Ok(await service.LeaveDetail(Actor, id, ct));
    [HttpPost("api/leave-requests"), ScreenPermission(LeaveWorkflowService.Leave, "NEW")]
    public async Task<IActionResult> CreateLeave(LeaveCreateRequest r, CancellationToken ct) { var result = await service.CreateLeave(Actor, r, ct); return CreatedAtAction(nameof(Leave), new { id = result.Id }, result); }
    [HttpPost("api/leave-requests/{id:long}/cancel"), ScreenPermission(LeaveWorkflowService.Leave, "UPDATE")]
    public async Task<IActionResult> CancelLeave(long id, WorkflowActionRequest r, CancellationToken ct) => Ok(await service.Cancel(Actor, "LEAVE", id, r, ct));
    [HttpGet("api/overtime-requests"), ScreenPermission(LeaveWorkflowService.Overtime, "VIEW")]
    public async Task<IActionResult> Overtimes([FromQuery] WorkflowQuery q, CancellationToken ct) => Ok(await service.Overtimes(Actor, q, ct));
    [HttpGet("api/overtime-requests/{id:long}"), ScreenPermission(LeaveWorkflowService.Overtime, "VIEW")]
    public async Task<IActionResult> Overtime(long id, CancellationToken ct) => Ok(await service.OvertimeDetail(Actor, id, ct));
    [HttpPost("api/overtime-requests"), ScreenPermission(LeaveWorkflowService.Overtime, "NEW")]
    public async Task<IActionResult> CreateOvertime(OvertimeCreateRequest r, CancellationToken ct) { var result = await service.CreateOvertime(Actor, r, ct); return CreatedAtAction(nameof(Overtime), new { id = result.Id }, result); }
    [HttpPost("api/overtime-requests/{id:long}/cancel"), ScreenPermission(LeaveWorkflowService.Overtime, "UPDATE")]
    public async Task<IActionResult> CancelOvertime(long id, WorkflowActionRequest r, CancellationToken ct) => Ok(await service.Cancel(Actor, "OVERTIME", id, r, ct));
    [HttpGet("api/attendance-adjustments"), ScreenPermission(LeaveWorkflowService.Adjustments, "VIEW")]
    public async Task<IActionResult> Adjustments([FromQuery] WorkflowQuery q, CancellationToken ct) => Ok(await service.AdjustmentList(Actor, q, ct));
    [HttpPost("api/attendance-adjustments"), ScreenPermission(LeaveWorkflowService.Adjustments, "NEW")]
    public async Task<IActionResult> CreateAdjustment(AdjustmentCreateRequest r, CancellationToken ct) => StatusCode(201, await service.CreateAdjustment(Actor, r, ct));
    [HttpPost("api/attendance-adjustments/{id:long}/cancel"), ScreenPermission(LeaveWorkflowService.Adjustments, "UPDATE")]
    public async Task<IActionResult> CancelAdjustment(long id, WorkflowActionRequest r, CancellationToken ct) => Ok(await service.Cancel(Actor, "ATTENDANCE_ADJUSTMENT", id, r, ct));
}
