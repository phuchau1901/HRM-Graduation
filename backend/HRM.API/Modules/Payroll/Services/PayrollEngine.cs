using HRM.API.Common;
using HRM.API.Modules.Payroll.DTOs;
namespace HRM.API.Modules.Payroll.Services;
public static class PayrollEngine
{
    public static readonly string[] OvertimeKinds = ["NORMAL", "NORMAL_NIGHT", "REST", "REST_NIGHT", "HOLIDAY", "HOLIDAY_NIGHT"];
    public static void Money(decimal value)
    {
        if(value < 0 || value > 1_000_000_000_000m || decimal.Round(value,2)!=value) throw BusinessException.Invalid("Money must be nonnegative, within supported bounds and have at most two decimal places.");
    }
    public static void Validate(PayrollRules r)
    {
        if(r.CurrencyCode?.Length!=3 || !r.CurrencyCode.All(char.IsAsciiLetterUpper) || r.HoursPerDay is <=0 or >24
            || r.StandardDays is <=0 or >31 || r.RoundingStep is <0.01m or >100000 || decimal.Round(r.RoundingStep,2)!=r.RoundingStep
            || r.RoundingMode is not ("AWAY_FROM_ZERO" or "TO_EVEN" or "DOWN" or "UP") || r.NightStart==r.NightEnd
            || r.NightWorkPremiumRate is <0 or >10 || r.OvertimeMultipliers is null || r.OvertimeMultipliers.Count!=OvertimeKinds.Length
            || OvertimeKinds.Any(k=>!r.OvertimeMultipliers.TryGetValue(k,out var rate) || rate is <=0 or >100)
            || r.OvertimeTaxMode is not ("FULL" or "BASE_ONLY" or "EXEMPT") || r.TaxMode is not ("NONE" or "FLAT" or "PROGRESSIVE")
            || r.FlatTaxRate is <0 or >1 || r.InsuranceBaseMode is not ("WEIGHTED" or "MONTH_END") || r.MinimumPaidDaysForInsurance is <0 or >31
            || r.KpiPeriodType is not ("MONTH" or "QUARTER" or "YEAR") || r.KpiScoreCap is <=0 or >200) throw BusinessException.Invalid("Invalid payroll policy rules.");
        Money(r.PersonalDeduction);Money(r.DependentDeduction);
        if(r.Insurance is null || r.Insurance.Length>20 || r.Insurance.Any(x=>x is null || string.IsNullOrWhiteSpace(x.Code) || x.Code.Length>30 || x.EmployeeRate is <0 or >1 || x.EmployerRate is <0 or >1 || x.BaseFloor<0 || x.BaseCap<=0 || x.BaseCap<x.BaseFloor)
            || r.Insurance.Select(x=>x.Code).Distinct().Count()!=r.Insurance.Length) throw BusinessException.Invalid("Invalid insurance policy.");
        foreach(var rule in r.Insurance) {Money(rule.BaseFloor);if(rule.BaseCap.HasValue)Money(rule.BaseCap.Value);}
        if(r.TaxBrackets is null || r.TaxBrackets.Length>30 || r.TaxBrackets.Any(x=>x is null || x.Rate is <0 or >1)) throw BusinessException.Invalid("Invalid tax brackets.");
        if(r.TaxMode=="PROGRESSIVE") {
            if(r.TaxBrackets.Length==0 || r.TaxBrackets[^1].UpTo!=null)throw BusinessException.Invalid("Progressive tax requires a final open-ended bracket.");
            decimal previous=0;
            for(var i=0;i<r.TaxBrackets.Length-1;i++) {var limit=r.TaxBrackets[i].UpTo;if(!limit.HasValue || limit<=previous)throw BusinessException.Invalid("Tax bracket limits must be strictly increasing.");Money(limit.Value);previous=limit.Value;}
        }
    }
    public static decimal Round(decimal amount,PayrollRules rules)
    {
        var units=amount/rules.RoundingStep;
        var rounded=rules.RoundingMode switch {"DOWN"=>decimal.Floor(units),"UP"=>decimal.Ceiling(units),"TO_EVEN"=>decimal.Round(units,0,MidpointRounding.ToEven),_=>decimal.Round(units,0,MidpointRounding.AwayFromZero)};
        var result=rounded*rules.RoundingStep;
        if(result<0 || result>9_999_999_999_999_999m)throw BusinessException.Invalid("Calculated amount exceeds payroll storage limits.");
        return result;
    }
    public static decimal Tax(decimal taxable,PayrollRules r)
    {
        taxable=Math.Max(0,taxable);
        if(r.TaxMode=="NONE")return 0;
        if(r.TaxMode=="FLAT")return taxable*r.FlatTaxRate;
        decimal tax=0,lower=0;
        foreach(var b in r.TaxBrackets) {var upper=b.UpTo??taxable;var width=Math.Max(0,Math.Min(taxable,upper)-lower);tax+=width*b.Rate;if(taxable<=upper)break;lower=upper;}
        return tax;
    }
    public static (string Key,bool Due) KpiPeriod(string month,string type)
    {
        var start=DateOnly.ParseExact(month+"-01","yyyy-MM-dd");
        return type switch {"QUARTER"=>($"{start.Year}-Q{(start.Month-1)/3+1}",start.Month%3==0),"YEAR"=>(start.Year.ToString(),start.Month==12),_=>(month,true)};
    }
    private static readonly TimeZoneInfo Zone=TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
    public static DateTime LocalUtc(DateOnly day,TimeOnly time)=>TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(time,DateTimeKind.Unspecified),Zone);
    public static DateOnly LocalDay(DateTime utc)=>DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc,DateTimeKind.Utc),Zone));
    private static bool Night(DateTime utc,PayrollRules r) {
        var time=TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc,DateTimeKind.Utc),Zone));
        return r.NightStart<r.NightEnd?time>=r.NightStart && time<r.NightEnd:time>=r.NightStart || time<r.NightEnd;
    }
    public static IEnumerable<(DateTime Start,DateTime End,bool Night)> Split(DateTime start,DateTime end,PayrollRules r)
    {
        var cuts=new SortedSet<DateTime>{start,end};
        for(var day=LocalDay(start);day<=LocalDay(end);day=day.AddDays(1))
            foreach(var time in new[]{TimeOnly.MinValue,r.NightStart,r.NightEnd}) {var cut=LocalUtc(day,time);if(cut>start && cut<end)cuts.Add(cut);}
        var values=cuts.ToArray();for(var i=1;i<values.Length;i++)yield return(values[i-1],values[i],Night(values[i-1],r));
    }
    public static PayrollCalculation Calculate(CalculationInput input)
    {
        var r=input.Rules;Validate(r);
        if(input.Profiles.Length==0)throw BusinessException.Invalid("A verified salary profile is required for each employee.");
        if(input.Timesheet.Errors.Length>0)throw BusinessException.Invalid("Timesheet contains unresolved errors.");
        var standard=r.StandardDays??input.Timesheet.StandardDays;if(standard<=0)throw BusinessException.Invalid("Standard working days must be positive.");
        var first=DateOnly.ParseExact(input.PeriodKey+"-01","yyyy-MM-dd");var last=first.AddMonths(1).AddDays(-1);
        if(input.Timesheet.PeriodKey!=input.PeriodKey || input.Timesheet.Days.Length!=last.Day)throw BusinessException.Invalid("Timesheet does not cover the complete payroll month.");
        SalarySlice? Profile(DateOnly day)=>input.Profiles.SingleOrDefault(p=>p.EffectiveFrom<=day && (!p.EffectiveTo.HasValue || p.EffectiveTo>=day));
        decimal paidDays=0,basePay=0,legacyAllowance=0,ot=0,otBase=0,nightPay=0,kpiPotential=0,insuranceWeighted=0;
        var componentAmounts=new Dictionary<CompensationItem,decimal>();
        foreach(var day in input.Timesheet.Days.OrderBy(x=>x.Date)) {
            if(!day.Eligible)continue;
            var profile=Profile(day.Date);
            var holiday=r.PayPublicHolidays && day.IsWorkingDay && day.IsHoliday;
            var worked=day.ScheduledMinutes>0?(decimal)day.WorkedMinutes/day.ScheduledMinutes:0;
            var fraction=holiday?1:worked+day.PaidLeave;
            if(fraction>1.00001m || fraction<0 || day.UnpaidLeave<0 || worked+day.PaidLeave+day.UnpaidLeave>1.00001m)throw BusinessException.Invalid("Overlapping work and leave allocations need reconciliation.");
            if(profile==null) {if(fraction>0 || day.Overtime.Length>0)throw BusinessException.Invalid("No effective salary profile for a payable date.");continue;}
            if(profile.CurrencyCode!=r.CurrencyCode || profile.PayBasis is not ("MONTH" or "DAY" or "HOUR"))throw BusinessException.Invalid("Salary currency or pay basis does not match policy.");
            paidDays+=fraction;insuranceWeighted+=profile.InsuranceBase/last.Day;
            var hourly=profile.PayBasis switch {"MONTH"=>profile.BaseSalary/standard/r.HoursPerDay,"DAY"=>profile.BaseSalary/r.HoursPerDay,_=>profile.BaseSalary};
            var paidHours=holiday?r.HoursPerDay:(day.WorkedMinutes+(day.PaidLeave*(day.ScheduledMinutes>0?day.ScheduledMinutes:r.HoursPerDay*60)))/60m;
            basePay+=profile.PayBasis=="HOUR"?hourly*paidHours:hourly*r.HoursPerDay*fraction;
            legacyAllowance+=profile.AllowanceAmount/standard*fraction;
            kpiPotential+=r.ProrateKpiBonus?profile.KpiBonusAmount/standard*fraction:profile.KpiBonusAmount/last.Day;
            var otHourly=hourly+(r.IncludeLegacyAllowanceInOvertime?profile.AllowanceAmount/standard/r.HoursPerDay:0);
            foreach(var item in profile.Items) {
                var amount=item.Prorate?item.Amount/standard*fraction:item.Amount/last.Day;
                componentAmounts[item]=componentAmounts.GetValueOrDefault(item)+amount;
                if(item.Kind=="EARNING" && item.OvertimeIncluded)otHourly+=item.Amount/standard/r.HoursPerDay;
            }
            if(day.RegularStartUtc.HasValue && day.RegularEndUtc>day.RegularStartUtc && day.WorkedMinutes>0) {
                var span=(decimal)(day.RegularEndUtc.Value-day.RegularStartUtc.Value).TotalMinutes;
                var nightMinutes=Split(day.RegularStartUtc.Value,day.RegularEndUtc.Value,r).Where(x=>x.Night).Sum(x=>(decimal)(x.End-x.Start).TotalMinutes)*day.WorkedMinutes/span;
                nightPay+=otHourly*nightMinutes/60*r.NightWorkPremiumRate;
            }
            foreach(var overtime in day.Overtime)foreach(var segment in Split(overtime.StartUtc,overtime.EndUtc,r)) {
                var local=LocalDay(segment.Start);var iso=local.DayOfWeek==DayOfWeek.Sunday?7:(int)local.DayOfWeek;
                var category=input.Timesheet.Holidays.Contains(local)?"HOLIDAY":!input.Timesheet.WorkingDays.Contains(iso)?"REST":"NORMAL";
                var hours=(decimal)(segment.End-segment.Start).TotalMinutes/60m;
                ot+=otHourly*hours*r.OvertimeMultipliers[category+(segment.Night?"_NIGHT":"")];otBase+=otHourly*hours;
            }
        }
        decimal kpi=0;
        var expectedKpi=KpiPeriod(input.PeriodKey,r.KpiPeriodType);
        if(expectedKpi.Due && kpiPotential>0) {
            if(input.Kpi is null || input.Kpi.Status!="APPROVED" || input.Kpi.Score is null || input.Kpi.PeriodKey!=expectedKpi.Key)throw BusinessException.Invalid("Approved KPI is required before calculating the configured KPI bonus.");
            kpi=kpiPotential*Math.Clamp(input.Kpi.Score.Value,0,r.KpiScoreCap)/100;
        }
        var lines=new List<PayslipLine>();
        void Add(string code,string name,string kind,decimal amount,decimal taxable,bool deductible,string formula) {
            var rounded=Round(amount,r);lines.Add(new(code,name,kind,rounded,Math.Min(rounded,Round(Math.Max(0,taxable),r)),deductible,formula));
        }
        Add("BASE","Lương theo công","EARNING",basePay,basePay,false,"Effective salary segments × payable work/paid leave/public holidays");
        Add("ALLOWANCE","Phụ cấp","EARNING",legacyAllowance,legacyAllowance,false,"Monthly allowance / standard days × payable days");
        Add("NIGHT","Phụ cấp làm đêm","EARNING",nightPay,nightPay,false,"Eligible night worked hours × hourly base × configured premium");
        Add("OVERTIME","Tiền tăng ca","EARNING",ot,r.OvertimeTaxMode=="FULL"?ot:r.OvertimeTaxMode=="BASE_ONLY"?otBase:0,false,"Actual approved overtime × configured day/night/rest/holiday multipliers");
        Add("KPI","Thưởng KPI","EARNING",kpi,kpi,false,"Configured eligible KPI bonus × approved score / 100");
        foreach(var item in componentAmounts)Add(item.Key.Code,item.Key.Name,item.Key.Kind,item.Value,item.Key.Taxable && item.Key.Kind=="EARNING"?item.Value:0,item.Key.TaxDeductible,"Effective profile component snapshot; prorated or calendar weighted");
        foreach(var item in input.Adjustments)Add(item.Code,item.Name,item.Kind,item.Amount,item.Taxable && item.Kind=="EARNING"?item.Amount:0,item.TaxDeductible,"Period adjustment snapshot");
        var insuranceBase=r.InsuranceBaseMode=="MONTH_END"?Profile(last)?.InsuranceBase??0:insuranceWeighted;
        decimal employerInsurance=0;
        if(paidDays>=r.MinimumPaidDaysForInsurance && insuranceBase>0)foreach(var rule in r.Insurance) {
            var basis=Math.Max(rule.BaseFloor,Math.Min(insuranceBase,rule.BaseCap??decimal.MaxValue));
            Add("INS_"+rule.Code,"Bảo hiểm "+rule.Code,"DEDUCTION",basis*rule.EmployeeRate,0,rule.TaxDeductible,"Configured insurance base/floor/cap × employee rate");
            employerInsurance+=Round(basis*rule.EmployerRate,r);
        }
        var dependents=Profile(last)?.Dependents??input.Profiles.OrderBy(p=>p.EffectiveFrom).LastOrDefault()?.Dependents??0;
        var taxableIncome=Math.Max(0,lines.Sum(l=>l.TaxableAmount)-lines.Where(l=>l.Kind=="DEDUCTION" && l.TaxDeductible).Sum(l=>l.Amount)-r.PersonalDeduction-dependents*r.DependentDeduction);
        Add("TAX","Thuế thu nhập cá nhân","DEDUCTION",Tax(taxableIncome,r),0,false,"Configured tax mode/brackets after deductions and relief");
        var gross=lines.Where(x=>x.Kind=="EARNING").Sum(x=>x.Amount);var deductions=lines.Where(x=>x.Kind=="DEDUCTION").Sum(x=>x.Amount);
        if(deductions>gross)throw BusinessException.Invalid("Net salary would be negative; reconcile deductions before approval.");
        var insurance=lines.Where(x=>x.Code.StartsWith("INS_",StringComparison.Ordinal)).Sum(x=>x.Amount);
        return new(lines[0].Amount,lines.Where(x=>x.Kind=="EARNING" && x.Code is not ("BASE" or "OVERTIME" or "KPI")).Sum(x=>x.Amount),lines[3].Amount,lines[4].Amount,
            Round(gross,r),lines[^1].Amount,insurance,employerInsurance,Round(deductions,r),gross-deductions,lines.ToArray());
    }
}
