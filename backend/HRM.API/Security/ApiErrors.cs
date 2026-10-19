namespace HRM.API.Security;
public static class ApiErrors
{
    public const string ErrorItem = "HRM.ErrorCode";
    public const string ValidatedUserItem = "HRM.ValidatedUser";
    public static object Create(HttpContext context, string code, string error, string message)
    {
        context.Items[ErrorItem] = code;
        return new { success = false, code, error, message, traceId = context.TraceIdentifier };
    }
    public static Task WriteAsync(HttpContext context, int status, string code, string error, string message)
    {
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(Create(context, code, error, message), context.RequestAborted);
    }
    public static Task DataScopeDeniedAsync(HttpContext context) => WriteAsync(context, 403,
        "HRM_AUTH_004", "DATA_SCOPE_DENIED", "Access to this data is denied.");
}
