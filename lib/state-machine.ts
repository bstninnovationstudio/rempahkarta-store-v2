import type { FulfillmentState } from "@prisma/client";

const transitions:Record<FulfillmentState,FulfillmentState[]>={
  awaiting_payment:["awaiting_processing","cancelled"],
  awaiting_processing:["processing","cancel_requested","cancelled"],
  processing:["packed","cancel_requested","cancelled"],
  packed:["shipment_booked","handover_pending","cancel_requested","cancelled"],
  shipment_booked:["handover_pending","cancel_requested","cancelled"],
  handover_pending:["handed_over","cancel_requested","cancelled"],
  handed_over:["completed","return_in_transit"],
  completed:["return_requested"],
  cancel_requested:["cancelled","awaiting_processing","processing","packed","shipment_booked","handover_pending"],
  cancelled:["finished"],
  return_requested:["return_in_transit","completed"],
  return_in_transit:["returned","finished"],
  returned:["finished"],
  finished:[],
};
export function assertOrderTransition(from:FulfillmentState,to:FulfillmentState){if(!transitions[from].includes(to))throw new Error(`Transisi order tidak valid: ${from} → ${to}`)}
export function canOrderTransition(from:FulfillmentState,to:FulfillmentState){return transitions[from].includes(to)}
