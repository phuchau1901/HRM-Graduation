using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Employees.Configurations;
public sealed class DocumentSequenceConfiguration : IEntityTypeConfiguration<DocumentSequence>
{
    public void Configure(EntityTypeBuilder<DocumentSequence> entity)
    {
        entity.ToTable("document_sequences");
        entity.HasKey(s => new { s.DocumentType, s.DocumentYear });
        entity.Property(s => s.DocumentType).HasColumnName("document_type").HasColumnType("varchar(30)").HasMaxLength(30);
        entity.Property(s => s.DocumentYear).HasColumnName("document_year").HasColumnType("int");
        entity.Property(s => s.LastNumber).HasColumnName("last_number").HasColumnType("bigint");
        entity.HasOne<ContractType>().WithMany().HasForeignKey(s => s.DocumentType).OnDelete(DeleteBehavior.Restrict);
    }
}
