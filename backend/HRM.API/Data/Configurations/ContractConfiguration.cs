using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class ContractConfiguration : IEntityTypeConfiguration<Contract>
{
    public void Configure(EntityTypeBuilder<Contract> entity)
    {
        entity.ToTable("contracts");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.ContractNo).HasColumnName("contract_no").IsRequired();
        entity.Property(x => x.ContractType).HasColumnName("contract_type").IsRequired();
        entity.Property(x => x.StartDate).HasColumnName("start_date").IsRequired();
        entity.Property(x => x.EndDate).HasColumnName("end_date");
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.Property(x => x.AttachmentURL).HasColumnName("attachment_url");
        entity.HasIndex(x => new { x.ContractNo }).HasDatabaseName("uq_contracts_contract_no").IsUnique();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_contracts_employee_id");
    }
}
