using HRM.API.Common;
using HRM.API.Modules.Performance.DTOs;
using System.Globalization;
namespace HRM.API.Modules.Performance.Services;
public static class KpiWorkbook {
 public static byte[] Create(IReadOnlyList<KpiRow> rows)=>SpreadsheetWorkbook.Create("KPI",["Mã nhân viên","Họ tên","Phòng ban","Team","Kỳ KPI","Trạng thái","Điểm"],rows.Select(x=>new[]{x.EmployeeCode,x.EmployeeName,x.DepartmentName,x.TeamName??"",x.PeriodKey,x.Status,x.FinalScore?.ToString(CultureInfo.InvariantCulture)??""}).ToArray(),new HashSet<int>{6});
}
