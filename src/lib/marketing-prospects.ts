export const prospectStages=["identified","contacted","responded","requirements_received","proposal_sent","negotiating","trial_order","recurring_customer","won","lost"] as const;
export type ProspectStage=(typeof prospectStages)[number];
export const prospectStageLabels:Record<ProspectStage,string>={identified:"Identified",contacted:"Contacted",responded:"Responded",requirements_received:"Requirements Received",proposal_sent:"Proposal Sent",negotiating:"Negotiating",trial_order:"Trial Order",recurring_customer:"Recurring Customer",won:"Won",lost:"Lost"};
export const normalProspectStages=prospectStages.filter((stage)=>stage!=="won"&&stage!=="lost");
export function nextProspectStage(stage:ProspectStage){const index=normalProspectStages.indexOf(stage as (typeof normalProspectStages)[number]);return index>=0&&index<normalProspectStages.length-1?normalProspectStages[index+1]:null;}
