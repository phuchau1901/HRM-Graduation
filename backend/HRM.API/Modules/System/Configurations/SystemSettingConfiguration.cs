using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.System.Configurations;
public sealed class SystemSettingConfiguration : IEntityTypeConfiguration<SystemSetting>
{
    public void Configure(EntityTypeBuilder<SystemSetting> b)
    {
        b.ToTable("system_settings"); b.HasKey(x => x.Key);
        b.Property(x => x.Key).HasColumnName("setting_key").HasColumnType("varchar(40)").HasMaxLength(40);
        b.Property(x => x.JsonValue).HasColumnName("json_value").HasColumnType("longtext").IsRequired();
        b.Property(x => x.Version).HasColumnName("version").HasColumnType("bigint").IsConcurrencyToken();
        b.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at_utc").HasColumnType("datetime(6)");
        var initial = new DateTime(2026, 11, 14, 0, 0, 0, DateTimeKind.Utc);
        b.HasData(new SystemSetting { Key = SettingsDefaults.PasswordKey, JsonValue = SettingsDefaults.PasswordJson, Version = 1, UpdatedAtUtc = initial },
            new SystemSetting { Key = SettingsDefaults.AttendanceKey, JsonValue = SettingsDefaults.AttendanceJson, Version = 1, UpdatedAtUtc = initial });
    }
}
public sealed class PasswordHistoryConfiguration : IEntityTypeConfiguration<PasswordHistory>
{
    public void Configure(EntityTypeBuilder<PasswordHistory> b)
    {
        b.ToTable("password_histories"); b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").HasColumnType("bigint").ValueGeneratedOnAdd();
        b.Property(x => x.UserId).HasColumnName("user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        b.Property(x => x.PasswordHash).HasColumnName("password_hash").HasColumnType("varchar(500)").HasMaxLength(500).IsRequired();
        b.Property(x => x.Salt).HasColumnName("salt").HasColumnType("varchar(44)").HasMaxLength(44).IsRequired();
        b.Property(x => x.CreatedAtUtc).HasColumnName("created_at_utc").HasColumnType("datetime(6)");
        b.HasIndex(x => new { x.UserId, x.Id });
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}
