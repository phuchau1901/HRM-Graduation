using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;
namespace HRM.API.Common;
internal static class SpreadsheetWorkbook
{
    private static string Column(int value) { var text="";while(value>0) {value--;text=(char)('A'+value%26)+text;value/=26;}return text;}
    internal static byte[] Create(string sheetName, string[] headers, IReadOnlyList<string[]> rows, IReadOnlySet<int>? numericColumns = null)
    {
        using var stream=new MemoryStream();
        using(var zip=new ZipArchive(stream,ZipArchiveMode.Create,true))
        {
            void Text(string path,string contents) { using var writer=new StreamWriter(zip.CreateEntry(path).Open(),new UTF8Encoding(false)); writer.Write(contents); }
            Text("[Content_Types].xml","""<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>""");
            Text("_rels/.rels","""<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");
            Text("xl/workbook.xml",("""<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>""").Replace("name=\"Data\"", "name=\"" + global::System.Security.SecurityElement.Escape(sheetName) + "\""));
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
                    if(numeric && numericColumns?.Contains(column)==true && decimal.TryParse(safe,NumberStyles.Number,CultureInfo.InvariantCulture,out var number)) xml.WriteElementString("v",ns,number.ToString(CultureInfo.InvariantCulture));
                    else { xml.WriteAttributeString("t","inlineStr");xml.WriteStartElement("is",ns);xml.WriteElementString("t",ns,safe);xml.WriteEndElement(); }
                    xml.WriteEndElement();column++;
                }
                xml.WriteEndElement();
            }
            Row(headers);
            foreach(var row in rows) Row(row,true);
            xml.WriteEndElement();xml.WriteStartElement("autoFilter",ns);xml.WriteAttributeString("ref",$"A1:{Column(headers.Length)}{rows.Count+1}");xml.WriteEndElement();xml.WriteEndElement();xml.WriteEndDocument();
        }
        return stream.ToArray();
    }
}
