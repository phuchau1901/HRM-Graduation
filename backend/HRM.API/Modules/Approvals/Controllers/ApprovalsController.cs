using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Approvals.DTOs;
using HRM.API.Modules.Approvals.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Approvals.Controllers;
[ApiController, Authorize, ServiceFilter(typeof(BusinessExceptionFilter))]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ApprovalsController(ApprovalWorkflowService service) : ControllerBase
{
    private string Actor => User.FindFirst("sub")!.Value;
    [HttpGet("api/approvals"), ScreenPermission(ApprovalWorkflowService.Approvals, "VIEW")]
    public async Task<IActionResult> Approvals([FromQuery] ApprovalQuery q, CancellationToken ct) => Ok(await service.ApprovalList(Actor, q, ct));
    [HttpGet("api/approvals/{id:long}"), ScreenPermission(ApprovalWorkflowService.Approvals, "VIEW")]
    public async Task<IActionResult> Approval(long id, CancellationToken ct) => Ok(await service.ApprovalGet(Actor, id, ct));
    [HttpPost("api/approvals/{id:long}/approve"), ScreenPermission(ApprovalWorkflowService.Approvals, "APPROVE")]
    public async Task<IActionResult> Approve(long id, WorkflowActionRequest r, CancellationToken ct) => Ok(await service.Decide(Actor, id, r, true, ct));
    [HttpPost("api/approvals/{id:long}/reject"), ScreenPermission(ApprovalWorkflowService.Approvals, "APPROVE")]
    public async Task<IActionResult> Reject(long id, WorkflowActionRequest r, CancellationToken ct) => Ok(await service.Decide(Actor, id, r, false, ct));
    [HttpGet("api/approvals/{id:long}/history"), ScreenPermission(ApprovalWorkflowService.Approvals, "VIEW")]
    public async Task<IActionResult> History(long id, [FromQuery] ApprovalQuery q, CancellationToken ct) => Ok(await service.History(Actor, id, q, ct));
    [HttpGet("api/approval-workflow-settings"), ScreenPermission(ApprovalWorkflowService.Configuration, "VIEW")]
    public async Task<IActionResult> Settings(CancellationToken ct) => Ok(await service.GetSettings(Actor, ct));
    [HttpPut("api/approval-workflow-settings"), ScreenPermission(ApprovalWorkflowService.Configuration, "UPDATE")]
    public async Task<IActionResult> SaveSettings(WorkflowSettingsRequest r, CancellationToken ct) => Ok(await service.SaveSettings(Actor, r, ct));
}
