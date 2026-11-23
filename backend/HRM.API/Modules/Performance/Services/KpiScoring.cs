using HRM.API.Common;
using HRM.API.Modules.Performance.DTOs;
namespace HRM.API.Modules.Performance.Services;
public static class KpiScoring {
 public static void Validate(MetricSnapshot m) {
  if(m.Milestones is null || m.Milestones.Any(x=>x is null)) throw BusinessException.Invalid("Invalid milestones.");
  if(m.Source!="MANUAL" || m.MaxScore is <1 or >200 || decimal.Round(m.MaxScore,2)!=m.MaxScore) throw BusinessException.Invalid("Unsupported KPI source or score limit.");
  if(m.Direction is "HIGHER" or "LOWER") { if(m.Method!="RATIO") throw BusinessException.Invalid("HIGHER/LOWER requires RATIO."); }
  else if(m.Direction=="QUALITATIVE") { if(m.Method!="DIRECT") throw BusinessException.Invalid("QUALITATIVE requires DIRECT."); }
  else if(m.Direction=="MILESTONE") {
   if(m.Method!="MILESTONE" || m.Milestones.Length==0 || m.Milestones.Select(x=>x.Threshold).Distinct().Count()!=m.Milestones.Length || m.Milestones.Any(x=>x.Threshold<0 || decimal.Round(x.Threshold,4)!=x.Threshold || decimal.Round(x.Score,2)!=x.Score || x.Score<0 || x.Score>m.MaxScore)) throw BusinessException.Invalid("Invalid KPI milestones.");
   var ordered=m.Milestones.OrderBy(x=>x.Threshold).ToArray();
   if(ordered.Zip(ordered.Skip(1)).Any(p=>p.First.Score>p.Second.Score)) throw BusinessException.Invalid("Milestone scores must be nondecreasing.");
  } else throw BusinessException.Invalid("Unsupported KPI direction.");
 }
 public static void ValidateWeights(IEnumerable<CriterionSnapshot> values) {
  var items=values.ToArray();
  if(items.Length==0 || items.Any(x=>x.WeightPercent<=0 || x.WeightPercent>100 || decimal.Round(x.WeightPercent,2)!=x.WeightPercent) || items.Sum(x=>x.WeightPercent)!=100) throw BusinessException.Invalid("KPI weights must total exactly 100%.");
  foreach(var x in items) { Validate(x.Metric); if(decimal.Round(x.TargetValue,4)!=x.TargetValue || x.TargetValue<0 || x.Metric.Method=="RATIO" && x.TargetValue<=0) throw BusinessException.Invalid("Ratio target must be positive."); }
 }
 public static decimal Score(CriterionSnapshot c, decimal actual) {
  if(actual<0 || decimal.Round(actual,4)!=actual) throw BusinessException.Invalid("Actual value must be nonnegative with at most four decimal places.");
  Validate(c.Metric); decimal score;
  if(c.Metric.Method=="RATIO") {
   if(c.TargetValue<=0) throw BusinessException.Invalid("Ratio target must be positive.");
   // Compare against the cap first to avoid decimal overflow on very small denominators.
   decimal Ratio(decimal numerator,decimal denominator)=> denominator==0 || numerator>=denominator*(c.Metric.MaxScore/100m)?c.Metric.MaxScore:numerator/denominator*100m;
   score=c.Metric.Direction=="HIGHER"?Ratio(actual,c.TargetValue):Ratio(c.TargetValue,actual);
  } else if(c.Metric.Method=="DIRECT") { if(actual>c.Metric.MaxScore) throw BusinessException.Invalid("Qualitative score exceeds configured maximum."); score=actual; }
  else score=c.Metric.Milestones.Where(x=>actual>=x.Threshold).Select(x=>x.Score).DefaultIfEmpty(0).Max();
  return Math.Round(Math.Clamp(score,0,c.Metric.MaxScore),2,MidpointRounding.AwayFromZero);
 }
 public static decimal Total(IEnumerable<(CriterionSnapshot Criterion,decimal Actual)> items)=>Math.Round(items.Sum(x=>Score(x.Criterion,x.Actual)*x.Criterion.WeightPercent/100m),2,MidpointRounding.AwayFromZero);
}
