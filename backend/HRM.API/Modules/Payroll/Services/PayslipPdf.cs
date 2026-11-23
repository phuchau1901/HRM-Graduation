using System.Buffers.Binary;
using System.Globalization;
using System.Text;
namespace HRM.API.Modules.Payroll.Services;
// Small, dependency-free PDF writer. Embedded OFL Noto Sans + CID/ToUnicode preserve Vietnamese text and copy/paste.
internal static class PayslipPdf
{
    private static readonly byte[] Font=Load();
    private static byte[] Load() {using var s=typeof(PayslipPdf).Assembly.GetManifestResourceStream("HRM.API.Modules.Payroll.Assets.NotoSans-Regular.ttf")??throw new InvalidOperationException("Payslip font is missing.");using var m=new MemoryStream();s.CopyTo(m);return m.ToArray();}
    private static ushort U16(int offset)=>BinaryPrimitives.ReadUInt16BigEndian(Font.AsSpan(offset,2));
    private static uint U32(int offset)=>BinaryPrimitives.ReadUInt32BigEndian(Font.AsSpan(offset,4));
    private static int Table(string tag) {for(var i=0;i<U16(4);i++){var p=12+i*16;if(Encoding.ASCII.GetString(Font,p,4)==tag)return checked((int)U32(p+8));}throw new InvalidOperationException("Required font table missing.");}
    private static ushort Glyph(char c) {
        var cmap=Table("cmap");for(var i=0;i<U16(cmap+2);i++) {
            var p=cmap+4+i*8;var sub=cmap+checked((int)U32(p+4));if(U16(sub)!=4)continue;
            var count=U16(sub+6)/2;var ends=sub+14;var starts=ends+count*2+2;var deltas=starts+count*2;var ranges=deltas+count*2;
            for(var j=0;j<count;j++)if(c<=U16(ends+j*2)&&c>=U16(starts+j*2)) {
                var delta=unchecked((short)U16(deltas+j*2));var range=U16(ranges+j*2);
                if(range==0)return unchecked((ushort)(c+delta));var g=U16(ranges+j*2+range+(c-U16(starts+j*2))*2);return g==0?(ushort)0:unchecked((ushort)(g+delta));
            }
        }return 0;
    }
    private static byte[] Bytes(string s)=>Encoding.ASCII.GetBytes(s);
    private static byte[] Stream(byte[] value,string extra="") {using var m=new MemoryStream();m.Write(Bytes($"<< /Length {value.Length} {extra} >>\nstream\n"));m.Write(value);m.Write(Bytes("\nendstream"));return m.ToArray();}
    public static byte[] Create(IEnumerable<string> text) {
        // Wrap long business labels without interpreting PDF operators or control characters.
        var lines=text.SelectMany(l=>Enumerable.Range(0,Math.Max(1,(l.Length+79)/80)).Select(i=>l.Substring(Math.Min(i*80,l.Length),Math.Min(80,Math.Max(0,l.Length-i*80))))).ToArray();
        var map=lines.SelectMany(x=>x).Distinct().ToDictionary(c=>c,Glyph);var glyphs=map.GroupBy(x=>x.Value).ToArray();
        var units=U16(Table("head")+18);var metrics=U16(Table("hhea")+34);var hmtx=Table("hmtx");
        string Width(ushort glyph)=>(U16(hmtx+Math.Min(glyph,metrics-1)*4)*1000/units).ToString(CultureInfo.InvariantCulture);
        var widths=string.Join(" ",glyphs.Select(g=>$"{g.Key} [{Width(g.Key)}]"));
        var unicode=new StringBuilder("/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Unicode def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n");
        foreach(var group in glyphs.Chunk(100)){unicode.AppendLine($"{group.Length} beginbfchar");foreach(var g in group)unicode.AppendLine($"<{g.Key:X4}> <{(int)g.First().Key:X4}>");unicode.AppendLine("endbfchar");}unicode.Append("endcmap CMapName currentdict /CMap defineresource pop end end");
        var pages=lines.Chunk(47).ToArray();var objects=new List<byte[]> {
            Bytes("<< /Type /Catalog /Pages 2 0 R >>"),Bytes($"<< /Type /Pages /Count {pages.Length} /Kids [{string.Join(" ",Enumerable.Range(0,pages.Length).Select(i=>$"{8+i*2} 0 R"))}] >>"),
            Bytes("<< /Type /Font /Subtype /Type0 /BaseFont /NotoSans /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 7 0 R >>"),
            Bytes("<< /Type /FontDescriptor /FontName /NotoSans /Flags 32 /FontBBox [-1000 -1000 3000 3000] /ItalicAngle 0 /Ascent 1100 /Descent -300 /CapHeight 700 /StemV 80 /FontFile2 5 0 R >>"),
            Stream(Font,$"/Length1 {Font.Length}"),Bytes($"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /NotoSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 4 0 R /CIDToGIDMap /Identity /DW 600 /W [{widths}] >>"),Stream(Bytes(unicode.ToString()))};
        for(var i=0;i<pages.Length;i++) {
            objects.Add(Bytes($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {9+i*2} 0 R >>"));
            var content=new StringBuilder("BT /F1 10 Tf 16 TL 42 800 Td\n");foreach(var line in pages[i])content.AppendLine($"<{string.Concat(line.Select(c=>map[c].ToString("X4")))}> Tj T*");content.Append("ET");objects.Add(Stream(Bytes(content.ToString())));
        }
        using var output=new MemoryStream();output.Write(Bytes("%PDF-1.7\n"));var offsets=new List<long>{0};for(var i=0;i<objects.Count;i++){offsets.Add(output.Position);output.Write(Bytes($"{i+1} 0 obj\n"));output.Write(objects[i]);output.Write(Bytes("\nendobj\n"));}
        var xref=output.Position;output.Write(Bytes($"xref\n0 {offsets.Count}\n0000000000 65535 f \n"));foreach(var pos in offsets.Skip(1))output.Write(Bytes($"{pos:0000000000} 00000 n \n"));output.Write(Bytes($"trailer << /Size {offsets.Count} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"));return output.ToArray();
    }
}
