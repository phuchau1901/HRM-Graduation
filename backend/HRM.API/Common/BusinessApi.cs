using System.ComponentModel.DataAnnotations;
using HRM.API.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
namespace HRM.API.Common;

public sealed class BusinessException(int status, string code, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public static BusinessException Missing() => new(404, "HRM_RESOURCE_404", "Resource not found.");
    public static BusinessException Conflict(string message) => new(409, "HRM_RESOURCE_409", message);
    public static BusinessException Invalid(string message) => new(400, "HRM_VALIDATION_400", message);
    public static BusinessException Scope() => new(403, "HRM_AUTH_004", "Access to this data is denied.");
}
// Applied only to new business controllers; existing Auth/Notification behavior is preserved.
public sealed class BusinessExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        var error = context.Exception as BusinessException;
        if (context.Exception is DbUpdateException { InnerException: MySqlException { Number: 1062 or 1451 or 1452 } })
            error = BusinessException.Conflict("A unique key or reference constraint prevents this operation.");
        if (error is null) return;
        context.Result = new ObjectResult(ApiErrors.Create(context.HttpContext, error.Code,
            error.Status == 403 ? "DATA_SCOPE_DENIED" : "BUSINESS_ERROR", error.Message)) { StatusCode = error.Status };
        context.ExceptionHandled = true;
    }
}
public class PageQuery
{
    [Range(1, int.MaxValue)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 30;
    [MaxLength(150)] public string? Search { get; set; }
}
public sealed record PageResult<T>(bool Success, int Total, int Page, int PageSize, IReadOnlyList<T> Data);
public static class Paging
{
    public static int Offset(PageQuery query)
    {
        var offset = ((long)query.Page - 1) * query.PageSize;
        if (offset > int.MaxValue) throw BusinessException.Invalid("Requested page is too large.");
        return (int)offset;
    }
}
