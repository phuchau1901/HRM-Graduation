using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Employees.Configurations;

public class ContractConfiguration : IEntityTypeConfiguration<Contract>
{
    public void Configure(EntityTypeBuilder<Contract> entity)
    {
        entity.ToTable("contracts");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.ContractNo).HasColumnName("contract_no").HasColumnType("varchar(50)").HasMaxLength(50).IsRequired();
        entity.Property(x => x.ContractType).HasColumnName("contract_type").HasColumnType("varchar(30)").HasMaxLength(30).IsRequired();
        entity.Property(x => x.StartDate).HasColumnName("start_date").HasColumnType("date").IsRequired();
        entity.Property(x => x.EndDate).HasColumnName("end_date").HasColumnType("date").IsRequired(false);
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.Property(x => x.AttachmentURL).HasColumnName("attachment_url").HasColumnType("varchar(500)").HasMaxLength(500).IsRequired(false);
        entity.HasIndex(x => new { x.ContractNo }).HasDatabaseName("uq_contracts_contract_no").IsUnique();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_contracts_employee_id");
    }
}
