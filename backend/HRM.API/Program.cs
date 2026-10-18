
using HRM.API.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// MySQL
var connectionString = builder.Configuration
    .GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Missing MySQL connection string"
    );

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(
        connectionString,
        new MySqlServerVersion(new Version(8, 0, 36))
    )
);

var app = builder.Build();

// Kiểm tra Entity trong môi trường Development
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();

    var db = scope.ServiceProvider
        .GetRequiredService<AppDbContext>();

    var entities = db.Model.GetEntityTypes()
        .OrderBy(x => x.ClrType.Name)
        .ToList();

    Console.WriteLine("=================================");
    Console.WriteLine($"TOTAL ENTITIES: {entities.Count}");
    Console.WriteLine("=================================");

    foreach (var entity in entities)
    {
        Console.WriteLine(
            $"ENTITY: {entity.ClrType.Name} => {entity.GetTableName()}"
        );
    }

    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();

app.MapControllers();

app.Run();
