using System.Data;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Employees.Services;

public sealed class ContractTypeService(AppDbContext db)
{
    private static ContractTypeDto Dto(ContractType type) => new(type.Code, type.Name, type.Description, type.IsActive, type.SortOrder, type.Prefix);
    public async Task<PageResult<ContractTypeDto>> ListAsync(ContractTypeQuery q, CancellationToken ct)
    {
        var query = db.Set<ContractType>().AsNoTracking();
        if (q.IsActive.HasValue) query = query.Where(t => t.IsActive == q.IsActive);
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(t => t.Code.Contains(q.Search) || t.Name.Contains(q.Search));
        var total = await query.CountAsync(ct);
        var rows = await query.OrderBy(t => t.SortOrder).ThenBy(t => t.Code).Skip(Paging.Offset(q)).Take(q.PageSize)
            .Select(t => new ContractTypeDto(t.Code, t.Name, t.Description, t.IsActive, t.SortOrder, t.Prefix)).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows);
    }
    public async Task<ContractTypeDto> GetAsync(string code, CancellationToken ct) =>
        Dto(await db.Set<ContractType>().AsNoTracking().SingleOrDefaultAsync(t => t.Code == code, ct) ?? throw BusinessException.Missing());
    public async Task<ContractTypeDto> SaveAsync(string actor, string? code, ContractTypeUpdateRequest request, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var requestedCode = code ?? (request as ContractTypeRequest)?.Code.Trim()
            ?? throw BusinessException.Invalid("Contract type code is required.");
        var type = code is null ? new ContractType { Code = requestedCode } :
            await db.Set<ContractType>().SingleOrDefaultAsync(t => t.Code == code, ct) ?? throw BusinessException.Missing();
        if (code is null && await db.Set<ContractType>().AnyAsync(t => t.Code == requestedCode, ct))
            throw BusinessException.Conflict("Contract type code already exists.");
        var before = code is null ? null : Dto(type);
        if (request.PrefixSpecified)
        {
            if (request.Prefix is not null && !ContractNumberGenerator.IsValidPrefix(request.Prefix))
                throw BusinessException.Invalid("Prefix must be 1-20 uppercase letters/digits, starting with a letter.");
            type.Prefix = request.Prefix;
        }
        type.Name = request.Name.Trim(); type.Description = request.Description?.Trim(); type.IsActive = request.IsActive; type.SortOrder = request.SortOrder;
        if (code is null) db.Add(type);
        Audit(actor, code is null ? "CONTRACT_TYPE_CREATED" : "CONTRACT_TYPE_UPDATED", type.Code, before, Dto(type));
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto(type);
    }
    public async Task DeleteAsync(string actor, string code, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var type = await db.Set<ContractType>().SingleOrDefaultAsync(t => t.Code == code, ct) ?? throw BusinessException.Missing();
        if (await db.Set<Contract>().AnyAsync(c => c.ContractType == type.Code, ct) || await db.Set<DocumentSequence>().AnyAsync(s => s.DocumentType == type.Code, ct))
            throw BusinessException.Conflict("Contract type is referenced; deactivate it instead of deleting it.");
        Audit(actor, "CONTRACT_TYPE_DELETED", type.Code, Dto(type), null);
        db.Remove(type); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    private void Audit(string actor, string action, string code, ContractTypeDto? before, ContractTypeDto? after) => db.Add(new AuditLog
    {
        ActorUserID = actor, Action = action, EntityType = "ContractType", EntityID = code, CreatedAt = DateTime.UtcNow,
        BeforeJSON = before is null ? null : JsonSerializer.Serialize(before), AfterJSON = after is null ? null : JsonSerializer.Serialize(after)
    });
}
