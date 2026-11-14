using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Organization.Configurations;

public sealed class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    public void Configure(EntityTypeBuilder<Team> builder)
    {
        builder.ToTable("teams");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("Id").HasColumnType("int").ValueGeneratedOnAdd();
        builder.Property(x => x.TeamCode).HasColumnName("TeamCode").HasColumnType("varchar(30)").HasMaxLength(30).IsRequired();
        builder.Property(x => x.TeamName).HasColumnName("TeamName").HasColumnType("varchar(150)").HasMaxLength(150).IsRequired();
        builder.Property(x => x.DepartmentId).HasColumnName("DepartmentId").HasColumnType("int");
        builder.Property(x => x.Description).HasColumnName("Description").HasColumnType("varchar(500)").HasMaxLength(500);
        builder.Property(x => x.IsActive).HasColumnName("IsActive").HasColumnType("tinyint(1)");
        builder.Property(x => x.CreatedAt).HasColumnName("CreatedAt").HasColumnType("datetime(6)");
        builder.HasIndex(x => x.TeamCode).IsUnique();
        builder.HasIndex(x => new { x.DepartmentId, x.IsActive });
        builder.HasAlternateKey(x => new { x.Id, x.DepartmentId });
        builder.HasOne(x => x.Department).WithMany(x => x.Teams).HasForeignKey(x => x.DepartmentId).OnDelete(DeleteBehavior.Restrict);
    }
}
