using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRM.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(
        DbContextOptions<AppDbContext> options
    ) : base(options)
    {
    }
   
    public DbSet<Screen> Screens => Set<Screen>();
    public DbSet<RoleDetail> RoleDetails => Set<RoleDetail>();

    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Employee> Employees => Set<Employee>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(
            typeof(AppDbContext).Assembly
        );
    }
}