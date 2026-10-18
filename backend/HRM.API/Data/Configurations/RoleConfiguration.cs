using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> entity)
    {
        entity.ToTable("roles");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.Code).HasColumnName("code").IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").IsRequired();
        entity.HasIndex(x => new { x.Code }).HasDatabaseName("uq_roles_code").IsUnique();
    }
}
