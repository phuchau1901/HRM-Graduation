import React from 'react';
export function PerformanceDetails({details}) {
 if(!details)return <p>Không có chi tiết KPI.</p>;
 return <><p>Kỳ {details.periodKey} · {details.status} · Điểm {details.finalScore??'—'}</p><p>{details.reviewerComment}</p>{details.criteria.map(c=>{
  const result=details.results?.find(r=>(r.criterionID??r.criterionId)===c.criterionId);
  return <section className="card" key={c.criterionId}><h3>{c.metric.name}</h3><p>Trọng số {c.weightPercent}% · Mục tiêu {c.targetValue} {c.metric.unit}</p><p>Kết quả: {result?.actualValue??'—'} · Điểm nhân viên: {result?.selfScore??'—'} · Điểm quản lý: {result?.managerScore??'—'}</p><p>{result?.comment}</p>{/^https?:\/\//i.test(result?.evidenceUrl||'')&&<a href={result.evidenceUrl} target="_blank" rel="noreferrer">Xem bằng chứng</a>}</section>;
 })}</>;
}
