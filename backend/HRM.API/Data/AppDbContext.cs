
using HRM.API.Models;
using Microsoft.EntityFrameworkCore;

namespace HRM.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(
        DbContextOptions<AppDbContext> options
    ) : base(options)
    {
    }

    public DbSet<Department> Departments
        => Set<Department>();

    public DbSet<Employee> Employees
        => Set<Employee>();

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Department>(entity =>
        {
            entity.ToTable("departments");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.DepartmentCode)
                .HasMaxLength(20)
                .IsRequired();

            entity.HasIndex(e => e.DepartmentCode)
                .IsUnique();

            entity.Property(e => e.DepartmentName)
                .HasMaxLength(150)
                .IsRequired();
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.ToTable("employees");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.EmployeeCode)
                .HasMaxLength(20)
                .IsRequired();

            entity.HasIndex(e => e.EmployeeCode)
                .IsUnique();

            entity.Property(e => e.FullName)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(e => e.Email)
                .HasMaxLength(255)
                .IsRequired();

            entity.HasIndex(e => e.Email)
                .IsUnique();

            entity.HasOne(e => e.Department)
                .WithMany(d => d.Employees)
                .HasForeignKey(e => e.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
