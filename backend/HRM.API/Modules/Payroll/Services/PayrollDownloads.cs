using System.Text.Json;
using HRM.API.Common;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Payroll.Services;
public sealed partial class PayrollService {
 public async Task<byte[]> Pdf(string actor,long id,CancellationToken ct) {
  var employee=await MyEmployee(actor,"EXPORT",ct);
  var row=await (await Rows(actor,new(),true,"EXPORT",ct)).SingleOrDefaultAsync(x=>x.Id==id&&x.EmployeeId==employee,ct)??throw BusinessException.Missing();
  var snapshot=await db.Set<PayrollDetail>().Where(x=>x.ID==id).Select(x=>x.CalculationSnapshot).SingleAsync(ct);
  using var json=global::System.Text.Json.JsonDocument.Parse(snapshot);var result=json.RootElement.GetProperty("result").Deserialize<PayrollCalculation>(JsonOptions)??throw BusinessException.Conflict("Invalid payslip.");
  var lines=new List<string>{"PHIẾU LƯƠNG / PAYSLIP",$"Kỳ: {row.PeriodKey}",$"Nhân viên: {row.EmployeeCode} - {row.EmployeeName}",$"Phòng ban: {row.DepartmentName}",""};
  var currency=json.RootElement.GetProperty("input").GetProperty("rules").GetProperty("currencyCode").GetString();
  foreach(var line in result.Lines)lines.Add($"{line.Name}: {(line.Kind=="DEDUCTION"?"-":"+")}{line.Amount:N2} {currency}");
  lines.Add("");lines.Add($"Tổng thu nhập: {result.Gross:N2} {currency}");lines.Add($"Tổng khấu trừ: {result.Deductions:N2} {currency}");lines.Add($"Thực lĩnh: {result.Net:N2} {currency}");return PayslipPdf.Create(lines);
 }
}
