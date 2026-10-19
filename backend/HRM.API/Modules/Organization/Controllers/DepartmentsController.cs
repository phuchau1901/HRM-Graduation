using HRM.API.Modules.Authorization.Policies;

using HRM.API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRM.API.Modules.Organization.Controllers;

[ApiController]
[Route("api/departments")]
public class DepartmentsController : ControllerBase
{
    private readonly AppDbContext _context;

    public DepartmentsController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/departments
    [HttpGet]
    [RequireScreenPermission("DEPARTMENTS", ScreenAction.View)]
    public async Task<IActionResult> GetDepartments()
    {
        var departments = await _context.Departments
            .AsNoTracking()
            .OrderBy(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.DepartmentCode,
                x.DepartmentName,
                x.Description,
                x.IsActive
            })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            total = departments.Count,
            data = departments
        });
    }
}
