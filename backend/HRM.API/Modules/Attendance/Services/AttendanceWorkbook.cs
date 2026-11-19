using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;
using HRM.API.Modules.Attendance.DTOs;
namespace HRM.API.Modules.Attendance.Services;
internal static class AttendanceWorkbook
{
    internal static byte[] Create(IReadOnlyList<DailyAttendanceRow> rows)
    {
        using var stream=new MemoryStream();
        using(var zip=new ZipArchive(stream,ZipArchiveMode.Create,true))
        {
            void Text(string path,string contents) { using var writer=new StreamWriter(zip.CreateEntry(path).Open(),new UTF8Encoding(false)); writer.Write(contents); }
            Text("[Content_Types].xml","""<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>""");
            Text("_rels/.rels","""<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");
            Text("xl/workbook.xml","""<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Attendance" sheetId="1" r:id="rId1"/></sheets></workbook>""");
            Text("xl/_rels/workbook.xml.rels","""<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>""");
            using var xml=XmlWriter.Create(zip.CreateEntry("xl/worksheets/sheet1.xml").Open(),new XmlWriterSettings { Encoding=new UTF8Encoding(false),CloseOutput=true });
            const string ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            xml.WriteStartDocument(); xml.WriteStartElement("worksheet",ns); xml.WriteStartElement("sheetData",ns);
            void Row(IEnumerable<string> values, bool numeric = false)
            {
                xml.WriteStartElement("row",ns);
                var column=0;
                foreach(var value in values)
                {
                    // Inline strings never become executable formulas, even when names start with '='.
                    var safe=new string(value.Where(XmlConvert.IsXmlChar).ToArray());
                    xml.WriteStartElement("c",ns);
                    if(numeric && column is >=10 and <=12 && decimal.TryParse(safe,NumberStyles.Number,CultureInfo.InvariantCulture,out var number)) xml.WriteElementString("v",ns,number.ToString(CultureInfo.InvariantCulture));
                    else { xml.WriteAttributeString("t","inlineStr");xml.WriteStartElement("is",ns);xml.WriteElementString("t",ns,safe);xml.WriteEndElement(); }
                    xml.WriteEndElement();column++;
                }
                xml.WriteEndElement();
            }
            Row(["Ngày","Mã nhân viên","Họ tên","Phòng ban","Team","Ca","Bắt đầu ca","Kết thúc ca","Check-in","Check-out","Phút làm việc","Phút trễ","Phút về sớm","Trạng thái","Nghỉ phép","Kỳ khóa"]);
            var zone=TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
            string Time(DateTime? value)=>value.HasValue?TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(value.Value,DateTimeKind.Utc),zone).ToString("yyyy-MM-dd HH:mm:ss",CultureInfo.InvariantCulture):"";
            foreach(var r in rows)Row([r.WorkDate.ToString("yyyy-MM-dd",CultureInfo.InvariantCulture),r.EmployeeCode,r.EmployeeName,r.DepartmentName,r.TeamName??"",r.ShiftCode??"",Time(r.ShiftStartAtUtc),Time(r.ShiftEndAtUtc),Time(r.CheckInAtUtc),Time(r.CheckOutAtUtc),r.WorkedMinutes?.ToString(CultureInfo.InvariantCulture)??"",r.LateMinutes.ToString(CultureInfo.InvariantCulture),r.EarlyMinutes.ToString(CultureInfo.InvariantCulture),r.Status,r.IsOnLeave?"Có":"",r.IsPeriodLocked?"Có":""],true);
            xml.WriteEndElement();xml.WriteStartElement("autoFilter",ns);xml.WriteAttributeString("ref",$"A1:P{rows.Count+1}");xml.WriteEndElement();xml.WriteEndElement();xml.WriteEndDocument();
        }
        return stream.ToArray();
    }
}
